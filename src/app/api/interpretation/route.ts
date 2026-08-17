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

  const body = await request.json();
  const { patientId, summary, supportingFactIds, authorId, branchId } = body;

  // Validate required fields before touching DB
  if (!patientId || !summary || !authorId) {
    return NextResponse.json(
      { error: 'patientId, summary, and authorId are required' },
      { status: 400 },
    );
  }

  // PRD §6.1: no diagnosis without evidence — enforced at API boundary
  if (!Array.isArray(supportingFactIds) || supportingFactIds.length === 0) {
    return NextResponse.json(
      { error: 'supportingFactIds must be a non-empty array' },
      { status: 400 },
    );
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // Verify patient, doctor, and all facts exist in a single query
    // All values parameterized (invariant #5)
    return session.run(
      `MATCH (p:Patient {id: $patientId})
       MATCH (doc:Doctor {id: $authorId})
       WITH p, doc
       UNWIND $factIds AS factId
       MATCH (f:Fact {id: factId})
       WITH p, doc, collect(f) AS facts
       WHERE size(facts) = size($factIds)
       CREATE (i:Interpretation {
         id: $id,
         patientId: $patientId,
         summary: $summary,
         status: 'Hypothesis',
         authorId: $authorId,
         createdAt: $createdAt
       })
       CREATE (i)-[:AUTHORED_BY]->(doc)
       WITH i, facts
       UNWIND facts AS f
       CREATE (f)-[:SUPPORTS]->(i)
       RETURN i`,
      {
        patientId,
        authorId,
        factIds: supportingFactIds,
        id,
        summary,
        createdAt,
      },
    );
  });

  const record = result.records[0];
  if (!record) {
    // If no record returned, either patient, doctor, or some facts don't exist
    return NextResponse.json(
      { error: 'Patient, doctor, or one or more supporting facts not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(record.get('i').properties, { status: 201 });
}
