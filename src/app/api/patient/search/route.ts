import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withSession } from '@/lib/neo4j';

export async function GET(request: Request) {
  try {
    const sessionAuth = await getServerSession(authOptions);
    if (!sessionAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Missing search query (q parameter)' }, { status: 400 });
    }

    const result = await withSession(async (session) => {
      // Invariant #5: Parameterized Cypher
      // Search by exact ID or partial name
      return session.run(
        `
        MATCH (p:Patient)
        WHERE p.id = $query OR toLower(p.name) CONTAINS toLower($query)
        RETURN p.id AS id, p.name AS name, p.dateOfBirth AS dateOfBirth
        LIMIT 20
        `,
        { query }
      );
    });

    const patients = result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      dateOfBirth: record.get('dateOfBirth'),
    }));

    return NextResponse.json(patients);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
