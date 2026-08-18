import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canTransitionInterpretation } from '@/lib/transitions';
import type { InterpretationStatus } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { confirmedInterpretationId } = body;

  if (!confirmedInterpretationId || typeof confirmedInterpretationId !== 'string') {
    return NextResponse.json({ error: 'confirmedInterpretationId is required' }, { status: 400 });
  }

  const result = await withSession(async (session) => {
    // 1. Check branch status and existence
    const branchRes = await session.run(
      'MATCH (b:Branch {id: $id}) RETURN b.status AS status',
      { id }
    );
    if (branchRes.records.length === 0) {
      return { error: 'Branch not found', status: 404 };
    }
    if (branchRes.records[0].get('status') === 'Closed') {
      return { error: 'Branch already closed', status: 409 };
    }

    // 2. Fetch all interpretations on the branch to validate
    const interpsRes = await session.run(
      'MATCH (i:Interpretation)-[:BELONGS_TO]->(b:Branch {id: $id}) RETURN i.id AS id, i.status AS status',
      { id }
    );
    const interps = interpsRes.records.map(r => ({ id: r.get('id') as string, status: r.get('status') as InterpretationStatus }));
    
    if (!interps.some(i => i.id === confirmedInterpretationId)) {
      return { error: 'confirmedInterpretationId not on this branch', status: 400 };
    }

    // Verify all interpretations can transition to Confirmed/RuledOut
    for (const interp of interps) {
      const targetStatus = interp.id === confirmedInterpretationId ? 'Confirmed' : 'RuledOut';
      if (!canTransitionInterpretation(interp.status, targetStatus)) {
         return { error: `Interpretation ${interp.id} cannot transition from ${interp.status} to ${targetStatus}`, status: 409 };
      }
    }

    // 3. Apply the transaction atomically
    const txRes = await session.run(
      `MATCH (b:Branch {id: $id})<-[:BELONGS_TO]-(i:Interpretation)
       SET i.status = CASE WHEN i.id = $confirmedId THEN 'Confirmed' ELSE 'RuledOut' END
       WITH b
       SET b.status = 'Closed'
       RETURN b`,
      { id, confirmedId: confirmedInterpretationId }
    );

    return { data: txRes.records[0].get('b').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
