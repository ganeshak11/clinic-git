import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString, validateOptionalString } from '@/lib/validation';

/**
 * POST /api/patient
 *
 * Creates a new Patient.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let name: string, dateOfBirth: string | null;
    try {
      name = validateString(body.name, 'name');
      dateOfBirth = validateOptionalString(body.dateOfBirth, 'dateOfBirth');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `CREATE (p:Patient {id: $id, name: $name, dateOfBirth: $dateOfBirth, createdAt: $createdAt})
         RETURN p`,
        { id, name, dateOfBirth: dateOfBirth ?? null, createdAt },
      );
      return res.records[0]?.get('p').properties ?? null;
    });

    if (!result) {
      return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
