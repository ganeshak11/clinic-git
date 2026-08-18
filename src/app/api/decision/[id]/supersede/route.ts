import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { canTransitionDecision } from '@/lib/transitions';
import type { DecisionStatus } from '@/lib/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestingUserId: string;

  const sessionAuth = await getServerSession(authOptions);
  if (sessionAuth && sessionAuth.user) {
    requestingUserId = (sessionAuth.user as any).id;
  } else if (process.env.NODE_ENV === 'development') {
    requestingUserId = request.headers.get('x-user-id') || '';
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!requestingUserId) {
    return NextResponse.json({ error: 'User ID is missing' }, { status: 400 });
  }

  const { id: oldId } = await params;
  
  const body = await request.json().catch(() => ({}));
  const { newAction, interpretationId, reason } = body;

  if (!newAction || !interpretationId || !reason) {
    return NextResponse.json(
      { error: 'newAction, interpretationId, and reason are required' },
      { status: 400 },
    );
  }

  const newId = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // 1. Fetch old status
    const existing = await session.run(
      'MATCH (d:Decision {id: $oldId}) RETURN d.status AS status, d.patientId AS patientId',
      { oldId },
    );

    const record = existing.records[0];
    if (!record) {
      return { error: 'Old decision not found', status: 404 };
    }

    const currentStatus = record.get('status') as DecisionStatus;
    const patientId = record.get('patientId');

    // 2. Check transition
    if (!canTransitionDecision(currentStatus, 'Superseded')) {
      return {
        error: `Cannot transition from ${currentStatus} to Superseded`,
        status: 409,
      };
    }

    // 3. Atomically supersede (Invariant #3: newer -> older)
    // Also verify that interpretation exists and is Confirmed
    const txRes = await session.run(
      `MATCH (old:Decision {id: $oldId})
       MATCH (i:Interpretation {id: $interpretationId})
       WHERE i.status = 'Confirmed'
       MATCH (doc:Doctor {id: $authorId})
       WITH old, doc, i
       
       SET old.status = 'Superseded'
       
       CREATE (new:Decision {
         id: $newId,
         patientId: $patientId,
         interpretationId: $interpretationId,
         action: $newAction,
         status: 'Active',
         authorId: $authorId,
         supersedesId: $oldId,
         createdAt: $createdAt
       })
       CREATE (new)-[:AUTHORED_BY]->(doc)
       CREATE (new)-[:SUPERSEDES]->(old)
       CREATE (new)-[:BASED_ON]->(i)
       
       RETURN new`,
      {
        oldId,
        authorId: requestingUserId,
        newId,
        patientId,
        interpretationId,
        newAction,
        createdAt
      },
    );

    if (txRes.records.length === 0) {
      return { error: 'Failed to supersede. Interpretation may not be Confirmed, or Doctor missing.', status: 400 };
    }

    return { data: txRes.records[0].get('new').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
