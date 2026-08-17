import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { canTransitionInterpretation } from '@/lib/transitions';
import type { InterpretationStatus } from '@/lib/types';
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
  const { newSummary, supportingFactIds, reason } = body;

  if (!newSummary || !reason) {
    return NextResponse.json({ error: 'newSummary and reason are required' }, { status: 400 });
  }

  if (!Array.isArray(supportingFactIds) || supportingFactIds.length === 0) {
    return NextResponse.json({ error: 'supportingFactIds must be a non-empty array' }, { status: 400 });
  }

  const newId = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // 1. Fetch old status
    const existing = await session.run(
      'MATCH (i:Interpretation {id: $oldId}) RETURN i.status AS status, i.patientId AS patientId',
      { oldId },
    );

    const record = existing.records[0];
    if (!record) {
      return { error: 'Old interpretation not found', status: 404 };
    }

    const currentStatus = record.get('status') as InterpretationStatus;
    const patientId = record.get('patientId');

    // 2. Check transition
    if (!canTransitionInterpretation(currentStatus, 'Superseded')) {
      return {
        error: `Cannot transition from ${currentStatus} to Superseded`,
        status: 409,
      };
    }

    // 3. Atomically supersede (Invariant #3: newer -> older)
    const txRes = await session.run(
      `MATCH (old:Interpretation {id: $oldId})
       MATCH (doc:Doctor {id: $authorId})
       WITH old, doc
       UNWIND $factIds AS factId
       MATCH (f:Fact {id: factId})
       WITH old, doc, collect(f) AS facts
       WHERE size(facts) = size($factIds)
       
       SET old.status = 'Superseded'
       
       CREATE (new:Interpretation {
         id: $newId,
         patientId: $patientId,
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
       CREATE (f)-[:SUPPORTS]->(new)
       
       RETURN new`,
      {
        oldId,
        authorId: requestingUserId,
        factIds: supportingFactIds,
        newId,
        patientId,
        newSummary,
        createdAt
      },
    );

    if (txRes.records.length === 0) {
      return { error: 'Failed to supersede. Doctor or facts may not exist.', status: 400 };
    }

    return { data: txRes.records[0].get('new').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
