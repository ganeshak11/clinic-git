import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { withReadTransaction } from '@/lib/neo4j';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Missing search query (q parameter)' }, { status: 400 });
    }

    const result = await withReadTransaction(async (tx) => {
      // Invariant #5: Parameterized Cypher
      // Search by exact ID or partial name
      return tx.run(
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
