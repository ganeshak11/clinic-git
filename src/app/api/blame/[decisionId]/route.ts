import { NextRequest, NextResponse } from 'next/server';
import { withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';

/**
 * GET /api/blame/:decisionId
 *
 * Retrieves the reasoning chain for a decision.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  try {
    await requireAuth(request);
    const { decisionId } = await params;

    const result = await withReadTransaction(async (tx) => {
      // H-6 fix: Avoid Cartesian product by collecting prior chain first, then facts.
      // We also make the SUPPORTS match OPTIONAL to handle edge case L-10.
      return tx.run(
        `MATCH (d:Decision {id: $id})-[:BASED_ON]->(i:Interpretation)
         MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
         
         OPTIONAL MATCH (i)-[:SUPERSEDES*0..5]->(prior:Interpretation)
         WITH d, i, doc, collect(DISTINCT prior) AS priorChain
         
         OPTIONAL MATCH (f:Fact)-[:SUPPORTS]->(i)
         WITH d, i, doc, priorChain, collect(DISTINCT f) AS facts
         
         RETURN d, i, doc, priorChain, facts`,
        { id: decisionId },
      );
    });

    const record = result.records[0];
    if (!record) {
      return NextResponse.json(
        { error: 'Decision not found or missing relations' },
        { status: 404 },
      );
    }

    const decision = record.get('d').properties;
    const interpretation = record.get('i').properties;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPriorChain = record.get('priorChain');
    const priorChain = rawPriorChain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p !== null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p.properties)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p.id !== interpretation.id);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supportingFacts = record.get('facts').filter((f: any) => f !== null).map((f: any) => f.properties);
    const authoredBy = record.get('doc').properties;

    return NextResponse.json({
      decision,
      interpretation,
      priorChain,
      supportingFacts,
      authoredBy: { id: authoredBy.id, name: authoredBy.name },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
