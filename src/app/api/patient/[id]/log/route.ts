import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import type { LogEntry } from '@/lib/types';
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
       WITH p, collect({
         type: 'fact',
         timestamp: f.recordedAt,
         nodeId: f.id,
         summary: f.type + ': ' + f.value
       }) AS factEntries
       OPTIONAL MATCH (i:Interpretation {patientId: $id})
       WITH p, factEntries, collect(DISTINCT {
         type: 'interpretation',
         timestamp: i.createdAt,
         nodeId: i.id,
         summary: i.summary + ' [' + i.status + ']'
       }) AS interpEntries
       RETURN factEntries + interpEntries AS entries`,
      { id },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const entries: LogEntry[] = record.get('entries')
    .filter((e: any) => e.nodeId !== null) // filter out null entries from OPTIONAL MATCH
    .sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  return NextResponse.json(entries);
}
