import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';
import { logger } from '@/lib/logger';
import type { InterpretationStatus } from '@/lib/types';

/**
 * POST /api/interpretation/:id/retract
 *
 * Atomic retract — single Cypher query checks status, permission, and writes.
 * Fixes C-1, C-2, C-3, C-4, C-5.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let reason: string;
    try {
      reason = validateString(body.reason, 'reason');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    // Atomic: check status + permission + write in single query
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (i:Interpretation {id: $id})
         WHERE i.status = 'Confirmed'
           AND (i.authorId = $userId OR $isSupervisor = true)
         SET i.status = 'Retracted', i.retractedReason = $reason, i.retractedBy = $userId
         RETURN i`,
        { id, userId: auth.userId, isSupervisor: auth.isSupervisor, reason },
      );
      return res.records[0]?.get('i').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'interpretation.retracted', actorId: auth.userId, interpretationId: id, fromStatus: 'Confirmed', toStatus: 'Retracted' });
      return NextResponse.json(result);
    }

    // Distinguish 404 vs 409 vs 403
    const existing = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        'MATCH (i:Interpretation {id: $id}) RETURN i.status AS status, i.authorId AS authorId',
        { id },
      );
      const rec = res.records[0];
      if (!rec) return null;
      return { status: rec.get('status') as string, authorId: rec.get('authorId') as string };
    });

    if (!existing) {
      return NextResponse.json({ error: 'Interpretation not found' }, { status: 404 });
    }
    if (existing.status !== 'Confirmed') {
      return NextResponse.json(
        { error: `Cannot transition from ${existing.status} to Retracted` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Only the author or a supervisor can retract this interpretation' },
      { status: 403 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
