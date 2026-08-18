import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { SCHEMA_CONSTRAINTS, SCHEMA_INDEXES } from '@/lib/schema';
import { requireAuth, AuthError } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  try {
    // Require auth (H-7)
    await requireAuth(request);

    console.log('Running schema setup (constraints and indexes)...');

    await withSession(async (session) => {
      // Run constraints
      for (const constraint of SCHEMA_CONSTRAINTS) {
        await session.run(constraint);
      }
      // Run indexes
      for (const index of SCHEMA_INDEXES) {
        await session.run(index);
      }
    });

    return NextResponse.json({ 
      status: 'ok', 
      constraints: SCHEMA_CONSTRAINTS.length,
      indexes: SCHEMA_INDEXES.length 
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
