import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interpretationId: string }> },
) {
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { interpretationId } = await params;

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (i:Interpretation {id: $id})
       OPTIONAL MATCH (i)-[:SUPERSEDES*0..5]->(prior:Interpretation)
       MATCH (f:Fact)-[:SUPPORTS]->(i)
       MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
       RETURN i,
              collect(DISTINCT prior) AS priorChain,
              collect(DISTINCT f) AS facts,
              doc`,
      { id: interpretationId },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json(
      { error: 'Interpretation not found' },
      { status: 404 },
    );
  }

  const interpretation = record.get('i').properties;
  
  // Extract prior chain and exclude the current interpretation (from 0-length match)
  const rawPriorChain = record.get('priorChain');
  const priorChain = rawPriorChain
    .filter((p: any) => p !== null)
    .map((p: any) => p.properties)
    .filter((p: any) => p.id !== interpretation.id);
    
  const supportingFacts = record.get('facts').map((f: any) => f.properties);
  const authoredBy = record.get('doc').properties;

  return NextResponse.json({
    interpretation,
    priorChain,
    supportingFacts,
    authoredBy: { id: authoredBy.id, name: authoredBy.name },
  });
}
