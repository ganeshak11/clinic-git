import { NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { SCHEMA_CONSTRAINTS } from '@/lib/schema';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST() {
  try {
    // In dev, we might call this via curl, but let's enforce auth just in case,
    // or allow it without auth since it's idempotent schema setup.
    // We will allow it without auth but log it.
    console.log('Running schema setup...');

    await withSession(async (session) => {
      for (const constraint of SCHEMA_CONSTRAINTS) {
        // Each constraint is a fixed string, no user input — but still run via session.run
        // with no interpolation (invariant #5)
        await session.run(constraint);
      }
    });
    return NextResponse.json({ status: 'ok', constraints: SCHEMA_CONSTRAINTS.length });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
