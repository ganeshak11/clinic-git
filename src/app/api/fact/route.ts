import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import type { FactType } from '@/lib/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const VALID_FACT_TYPES: FactType[] = ['lab', 'imaging', 'vital', 'observation'];

export async function POST(request: NextRequest) {
  // Enforce authentication
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { patientId, type, value, recordedAt, attachmentUrl } = body;

  // Validate before touching DB — coding-standards.md
  if (!patientId || !type || !value || !recordedAt) {
    return NextResponse.json(
      { error: 'patientId, type, value, and recordedAt are required' },
      { status: 400 },
    );
  }

  if (!VALID_FACT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_FACT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const id = generateId();

  const result = await withSession(async (session) => {
    // Verify patient exists, create Fact, link via HAS_FACT — all parameterized (invariant #5)
    return session.run(
      `MATCH (p:Patient {id: $patientId})
       CREATE (f:Fact {id: $id, type: $type, value: $value, recordedAt: $recordedAt, attachmentUrl: $attachmentUrl})
       CREATE (p)-[:HAS_FACT]->(f)
       RETURN f`,
      { patientId, id, type, value, recordedAt, attachmentUrl: attachmentUrl ?? null },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  return NextResponse.json(record.get('f').properties, { status: 201 });
}
