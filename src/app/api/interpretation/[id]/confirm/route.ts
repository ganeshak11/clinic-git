import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { canTransitionInterpretation } from '@/lib/transitions';
import type { InterpretationStatus } from '@/lib/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Enforce authentication
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const result = await withSession(async (session) => {
    // Fetch current status
    const existing = await session.run(
      'MATCH (i:Interpretation {id: $id}) RETURN i.status AS status',
      { id },
    );

    const record = existing.records[0];
    if (!record) {
      return { error: 'Interpretation not found', status: 404 };
    }

    const currentStatus = record.get('status') as InterpretationStatus;

    if (!canTransitionInterpretation(currentStatus, 'Confirmed')) {
      return {
        error: `Cannot transition from ${currentStatus} to Confirmed`,
        status: 409,
      };
    }

    // Apply transition
    const updated = await session.run(
      `MATCH (i:Interpretation {id: $id})
       SET i.status = 'Confirmed'
       RETURN i`,
      { id },
    );

    return { data: updated.records[0]?.get('i').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
