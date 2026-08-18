import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * POST /api/branch/:id/resolve
 *
 * Atomic branch resolve — single Cypher query checks branch status,
 * verifies all interpretation statuses, and applies updates.
 * Fixes C-1 (atomicity), C-2 (TOCTOU), H-4 (stale-state branch resolution).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let confirmedInterpretationId: string;
    try {
      confirmedInterpretationId = validateString(body.confirmedInterpretationId, 'confirmedInterpretationId');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    // Atomic: check branch status + verify all interps are Hypothesis + confirm one is the target + update all
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (b:Branch {id: $id})<-[:BELONGS_TO]-(i:Interpretation)
         WHERE b.status = 'Open'
         WITH b, collect(i) AS interps
         // H-4 fix: ensure all are still Hypothesis at write time, and target exists
         WHERE ALL(interp IN interps WHERE interp.status = 'Hypothesis')
           AND ANY(interp IN interps WHERE interp.id = $confirmedId)
         
         UNWIND interps AS i
         SET i.status = CASE WHEN i.id = $confirmedId THEN 'Confirmed' ELSE 'RuledOut' END,
             i.confirmedBy = CASE WHEN i.id = $confirmedId THEN $userId ELSE NULL END
             
         WITH b
         SET b.status = 'Closed'
         RETURN b`,
        { id, confirmedId: confirmedInterpretationId, userId: auth.userId }
      );
      return res.records[0]?.get('b').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'branch.resolved', actorId: auth.userId, branchId: id, confirmedInterpretationId: confirmedInterpretationId });
      return NextResponse.json(result);
    }

    // Distinguish failure reasons
    const diagnostics = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (b:Branch {id: $id})
         OPTIONAL MATCH (i:Interpretation)-[:BELONGS_TO]->(b)
         RETURN b.status AS status, collect(i.id) AS interpIds, collect(i.status) AS interpStatuses`,
        { id }
      );
      return res.records[0];
    });

    if (!diagnostics) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const branchStatus = diagnostics.get('status') as string;
    if (branchStatus === 'Closed') {
      return NextResponse.json({ error: 'Branch already closed' }, { status: 409 });
    }

    const interpIds = diagnostics.get('interpIds') as string[];
    if (!interpIds.includes(confirmedInterpretationId)) {
      return NextResponse.json({ error: 'confirmedInterpretationId not on this branch' }, { status: 400 });
    }

    // If we got here, one of the interpretations wasn't in Hypothesis state
    return NextResponse.json(
      { error: 'One or more interpretations on this branch are no longer in Hypothesis state' },
      { status: 409 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
