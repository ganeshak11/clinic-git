import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * POST /api/decision/:id/supersede
 *
 * Atomic supersede — reads old status, checks transition, creates new,
 * and sets old to Superseded ALL in one Cypher statement.
 * Fixes C-1, C-2, C-3, C-4, C-5, invariant #3.
 * Cross-patient validation included.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id: oldId } = await params;

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let newAction: string, reason: string, interpretationId: string;
    try {
      newAction = validateString(body.newAction, 'newAction');
      reason = validateString(body.reason, 'reason');
      interpretationId = validateString(body.interpretationId, 'interpretationId');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const newId = generateId();
    const createdAt = new Date().toISOString();

    // Atomic: check old status + cross-patient check + create new + supersede link in single query
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (old:Decision {id: $oldId})
         WHERE old.status = 'Active'
         
         // Verify interpretation exists, is Confirmed, and belongs to same patient
         MATCH (i:Interpretation {id: $interpretationId})
         WHERE i.status = 'Confirmed' AND i.patientId = old.patientId
         
         MATCH (doc:Doctor {id: $authorId})
         
         WITH old, i, doc
         SET old.status = 'Superseded'

         CREATE (new:Decision {
           id: $newId,
           patientId: old.patientId,
           interpretationId: $interpretationId,
           action: $newAction,
           status: 'Active',
           authorId: $authorId,
           supersedesId: $oldId,
           createdAt: $createdAt
         })
         CREATE (new)-[:BASED_ON]->(i)
         CREATE (new)-[:AUTHORED_BY]->(doc)
         CREATE (new)-[:SUPERSEDES]->(old)

         RETURN new`,
        {
          oldId,
          authorId: auth.userId,
          interpretationId,
          newId,
          newAction,
          createdAt,
        },
      );
      return res.records[0]?.get('new').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'decision.superseded', actorId: auth.userId, decisionId: oldId, newDecisionId: result.id, fromStatus: 'Active', toStatus: 'Superseded' });
      return NextResponse.json(result, { status: 201 });
    }

    // Distinguish failure reasons
    const existing = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        'MATCH (d:Decision {id: $oldId}) RETURN d.status AS status',
        { oldId },
      );
      return res.records[0]?.get('status') as string | undefined;
    });

    if (!existing) {
      return NextResponse.json({ error: 'Old decision not found' }, { status: 404 });
    }
    if (existing !== 'Active') {
      return NextResponse.json(
        { error: `Cannot transition from ${existing} to Superseded` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to supersede. Doctor or interpretation may not exist, not be Confirmed, or patient mismatch.' },
      { status: 400 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
