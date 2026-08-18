import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * POST /api/decision/:id/retract
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
        `MATCH (d:Decision {id: $id})
         WHERE d.status = 'Active'
           AND (d.authorId = $userId OR $isSupervisor = true)
         SET d.status = 'Retracted', d.retractedReason = $reason, d.retractedBy = $userId
         RETURN d`,
        { id, userId: auth.userId, isSupervisor: auth.isSupervisor, reason },
      );
      return res.records[0]?.get('d').properties ?? null;
    });

    if (result) {
      logger.info({ event: 'decision.retracted', actorId: auth.userId, decisionId: id, fromStatus: 'Active', toStatus: 'Retracted' });
      return NextResponse.json(result);
    }

    // Distinguish 404 vs 409 vs 403
    const existing = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        'MATCH (d:Decision {id: $id}) RETURN d.status AS status, d.authorId AS authorId',
        { id },
      );
      const rec = res.records[0];
      if (!rec) return null;
      return { status: rec.get('status') as string, authorId: rec.get('authorId') as string };
    });

    if (!existing) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    if (existing.status !== 'Active') {
      return NextResponse.json(
        { error: `Cannot transition from ${existing.status} to Retracted` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Only the author or a supervisor can retract this decision' },
      { status: 403 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
