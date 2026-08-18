import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import type { InterpretationStatus } from '@/lib/types';

/**
 * POST /api/interpretation/:id/confirm
 *
 * Atomic confirm — single Cypher query checks status AND writes in one step.
 * Fixes C-1 (atomicity), C-2 (TOCTOU), M-2 (records confirming actor).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    // Atomic: read status + write in single query. No TOCTOU.
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (i:Interpretation {id: $id})
         WHERE i.status = 'Hypothesis'
         SET i.status = 'Confirmed', i.confirmedBy = $userId, i.confirmedAt = $now
         RETURN i`,
        { id, userId: auth.userId, now: new Date().toISOString() },
      );
      return res.records[0]?.get('i').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'interpretation.confirmed', actorId: auth.userId, interpretationId: id, fromStatus: 'Hypothesis', toStatus: 'Confirmed' });
      return NextResponse.json(result);
    }

    // Distinguish 404 vs 409 with a read
    const existing = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        'MATCH (i:Interpretation {id: $id}) RETURN i.status AS status',
        { id },
      );
      return res.records[0]?.get('status') as InterpretationStatus | undefined;
    });

    if (!existing) {
      return NextResponse.json({ error: 'Interpretation not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Cannot transition from ${existing} to Confirmed` },
      { status: 409 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
