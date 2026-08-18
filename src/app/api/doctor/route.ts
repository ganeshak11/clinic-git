import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';

/**
 * POST /api/doctor
 *
 * Creates a new Doctor.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let name: string;
    try {
      name = validateString(body.name, 'name');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const isSupervisor = body.isSupervisor === true;
    const id = generateId();

    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `CREATE (d:Doctor {id: $id, name: $name, isSupervisor: $isSupervisor})
         RETURN d`,
        { id, name, isSupervisor },
      );
      return res.records[0]?.get('d').properties ?? null;
    });

    if (!result) {
      return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
