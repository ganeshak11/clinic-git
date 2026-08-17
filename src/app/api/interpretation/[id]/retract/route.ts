import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { canTransitionInterpretation } from '@/lib/transitions';
import { canRetract } from '@/lib/permissions';
import type { InterpretationStatus } from '@/lib/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestingUserId: string;
  let isSupervisor: boolean;

  const sessionAuth = await getServerSession(authOptions);
  if (sessionAuth && sessionAuth.user) {
    requestingUserId = (sessionAuth.user as any).id;
    isSupervisor = (sessionAuth.user as any).isSupervisor === true;
  } else if (process.env.NODE_ENV === 'development') {
    // Fallback for curl tests
    requestingUserId = request.headers.get('x-user-id') || '';
    isSupervisor = request.headers.get('x-is-supervisor') === 'true';
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  
  const body = await request.json().catch(() => ({}));
  const { reason } = body;

  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const result = await withSession(async (session) => {
    // Fetch current status and author
    const existing = await session.run(
      'MATCH (i:Interpretation {id: $id}) RETURN i.status AS status, i.authorId AS authorId',
      { id },
    );

    const record = existing.records[0];
    if (!record) {
      return { error: 'Interpretation not found', status: 404 };
    }

    const currentStatus = record.get('status') as InterpretationStatus;
    const authorId = record.get('authorId');

    // Check transition validity
    if (!canTransitionInterpretation(currentStatus, 'Retracted')) {
      return {
        error: `Cannot transition from ${currentStatus} to Retracted`,
        status: 409,
      };
    }

    // Check permissions
    if (!canRetract(authorId, requestingUserId, isSupervisor)) {
      return {
        error: 'Only the author or a supervisor can retract this interpretation',
        status: 403,
      };
    }

    // Apply transition
    const updated = await session.run(
      `MATCH (i:Interpretation {id: $id})
       SET i.status = 'Retracted', i.retractedReason = $reason
       RETURN i`,
      { id, reason },
    );

    return { data: updated.records[0]?.get('i').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
