import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Enforce authentication
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { patientId, question } = body;

  if (!patientId || !question) {
    return NextResponse.json({ error: 'patientId and question are required' }, { status: 400 });
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (p:Patient {id: $patientId})
       CREATE (b:Branch {
         id: $id,
         patientId: $patientId,
         question: $question,
         status: 'Open',
         createdAt: $createdAt
       })
       CREATE (p)-[:HAS_BRANCH]->(b)
       RETURN b`,
      { patientId, question, id, createdAt },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  return NextResponse.json(record.get('b').properties, { status: 201 });
}
