import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString, validateIdArray } from '@/lib/validation';
import { logger } from '@/lib/logger';
import type { InterpretationStatus } from '@/lib/types';

/**
 * POST /api/interpretation/:id/supersede
 *
 * Atomic supersede — reads old status, checks transition, creates new,
 * and sets old to Superseded ALL in one Cypher statement.
 * Fixes C-1, C-2, C-3, C-4, C-5, invariant #3.
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

    let newSummary: string, reason: string, supportingFactIds: string[];
    try {
      newSummary = validateString(body.newSummary, 'newSummary');
      reason = validateString(body.reason, 'reason');
      supportingFactIds = validateIdArray(body.supportingFactIds, 'supportingFactIds');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const newId = generateId();
    const createdAt = new Date().toISOString();

    // Atomic: check old status + create new + supersede link in single query
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (old:Interpretation {id: $oldId})
         WHERE old.status = 'Confirmed'
         MATCH (doc:Doctor {id: $authorId})
         WITH old, doc
         UNWIND $factIds AS factId
         MATCH (f:Fact {id: factId})
         WITH old, doc, collect(f) AS facts
         WHERE size(facts) = size($factIds)

         SET old.status = 'Superseded'

         CREATE (new:Interpretation {
           id: $newId,
           patientId: old.patientId,
           summary: $newSummary,
           status: 'Hypothesis',
           authorId: $authorId,
           supersedesId: $oldId,
           createdAt: $createdAt
         })
         CREATE (new)-[:AUTHORED_BY]->(doc)
         CREATE (new)-[:SUPERSEDES]->(old)

         WITH new, facts
         UNWIND facts AS f
         MERGE (f)-[:SUPPORTS]->(new)

         RETURN new`,
        {
          oldId,
          authorId: auth.userId,
          factIds: supportingFactIds,
          newId,
          newSummary,
          createdAt,
        },
      );
      return res.records[0]?.get('new').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'interpretation.superseded', actorId: auth.userId, interpretationId: oldId, newInterpretationId: result.id, fromStatus: 'Confirmed', toStatus: 'Superseded' });
      return NextResponse.json(result, { status: 201 });
    }

    // Distinguish failure reasons
    const existing = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        'MATCH (i:Interpretation {id: $oldId}) RETURN i.status AS status',
        { oldId },
      );
      return res.records[0]?.get('status') as InterpretationStatus | undefined;
    });

    if (!existing) {
      return NextResponse.json({ error: 'Old interpretation not found' }, { status: 404 });
    }
    if (existing !== 'Confirmed') {
      return NextResponse.json(
        { error: `Cannot transition from ${existing} to Superseded` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to supersede. Doctor or facts may not exist.' },
      { status: 400 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
