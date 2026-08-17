import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (p:Patient {id: $id})
       OPTIONAL MATCH (p)-[:HAS_FACT]->(f:Fact)
       OPTIONAL MATCH (p)-[:HAS_FACT]->(f2:Fact)-[:SUPPORTS]->(i:Interpretation)
       RETURN p,
              collect(DISTINCT f) AS facts,
              collect(DISTINCT i) AS interpretations`,
      { id },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...record.get('p').properties,
    // Safely filter out nulls in case the OPTIONAL MATCH found nothing
    facts: record.get('facts').filter((f: any) => f !== null).map((f: any) => f.properties),
    interpretations: record.get('interpretations').filter((i: any) => i !== null).map((i: any) => i.properties),
  });
}
