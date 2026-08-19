import { NextRequest, NextResponse } from 'next/server';
import { withReadTransaction } from '@/lib/neo4j';
import type { LogEntry } from '@/lib/types';
import { requireAuth, AuthError } from '@/lib/auth-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const result = await withReadTransaction(async (tx) => {
      // H-5 partial fix: The indices will be created in Wave 2.
      // This query uses OPTIONAL MATCH (i:Interpretation {patientId: $id}) which relies on the index.
      return tx.run(
        `MATCH (p:Patient {id: $id})
         OPTIONAL MATCH (p)-[:HAS_FACT]->(f:Fact)
         WITH p, collect({
           type: 'fact',
           timestamp: f.recordedAt,
           nodeId: f.id,
           summary: f.type + ': ' + f.value
         }) AS factEntries
         OPTIONAL MATCH (b:Branch {patientId: $id})
         WITH p, factEntries, collect(DISTINCT {
           type: 'branch',
           timestamp: b.createdAt,
           nodeId: b.id,
           summary: b.question + ' [' + b.status + ']'
         }) AS branchEntries
         OPTIONAL MATCH (i:Interpretation {patientId: $id})
         OPTIONAL MATCH (i)-[:AUTHORED_BY]->(dI:Doctor)
         OPTIONAL MATCH (f:Fact)-[:SUPPORTS]->(i)
         WITH p, factEntries, branchEntries, i, dI, collect(CASE WHEN f IS NOT NULL THEN { id: f.id, value: f.value, url: f.attachmentUrl } END) AS evidence
         WITH p, factEntries, branchEntries, collect(DISTINCT {
           type: 'interpretation',
           timestamp: i.createdAt,
           nodeId: i.id,
           summary: i.summary + ' [' + i.status + ']',
           author: dI.name,
           branchId: i.branchId,
           supersedesId: i.supersedesId,
           evidence: evidence
         }) AS interpEntries
         OPTIONAL MATCH (dec:Decision {patientId: $id})
         OPTIONAL MATCH (dec)-[:AUTHORED_BY]->(dD:Doctor)
         WITH p, factEntries, branchEntries, interpEntries, collect(DISTINCT {
           type: 'decision',
           timestamp: dec.createdAt,
           nodeId: dec.id,
           summary: dec.action + ' [' + dec.status + ']',
           author: dD.name,
           interpretationId: dec.interpretationId
         }) AS decisionEntries
         RETURN factEntries + branchEntries + interpEntries + decisionEntries AS entries`,
        { id },
      );
    });

    const record = result.records[0];
    if (!record) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const skip = parseInt(request.nextUrl.searchParams.get('skip') || '0', 10);

    const entries: LogEntry[] = record.get('entries')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => e.nodeId !== null) // filter out null entries from OPTIONAL MATCH
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    return NextResponse.json(entries.slice(skip, skip + limit));
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
