import { NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';

export async function GET() {
  try {
    const result = await withSession(async (session) => {
      // Invariant #5: all Cypher is parameterized, even trivial queries
      return session.run('RETURN $value AS result', { value: 1 });
    });

    const record = result.records[0];
    if (!record) {
      return NextResponse.json(
        { status: 'error', message: 'No records returned' },
        { status: 500 },
      );
    }

    const value = Number(record.get('result'));
    return NextResponse.json({
      status: 'ok',
      neo4j: 'connected',
      testQuery: value,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
