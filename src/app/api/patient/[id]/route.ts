import { NextRequest, NextResponse } from 'next/server';
import { withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const result = await withReadTransaction(async (tx) => {
      // H-6 related: Avoid cartesian product in the fetch
      return tx.run(
        `MATCH (p:Patient {id: $id})
         OPTIONAL MATCH (p)-[:HAS_FACT]->(f:Fact)
         WITH p, collect(DISTINCT f) AS facts
         OPTIONAL MATCH (p)-[:HAS_FACT]->(:Fact)-[:SUPPORTS]->(i:Interpretation)
         WITH p, facts, collect(DISTINCT i) AS interpretations
         RETURN p, facts, interpretations`,
        { id },
      );
    });

    const record = result.records[0];
    if (!record) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const skip = parseInt(request.nextUrl.searchParams.get('skip') || '0', 10);

    return NextResponse.json({
      ...record.get('p').properties,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      facts: record.get('facts').filter((f: any) => f !== null).map((f: any) => f.properties).slice(skip, skip + limit),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      interpretations: record.get('interpretations').filter((i: any) => i !== null).map((i: any) => i.properties).slice(skip, skip + limit),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
