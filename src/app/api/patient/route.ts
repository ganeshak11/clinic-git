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
    let age: number | null, gender: string | null, weight: string | null, height: string | null;
    try {
      name = validateString(body.name, 'name');
      dateOfBirth = validateOptionalString(body.dateOfBirth, 'dateOfBirth');
      age = body.age !== undefined && body.age !== "" ? Number(body.age) : null;
      if (age !== null && isNaN(age)) throw new Error("Invalid age format");
      gender = validateOptionalString(body.gender, 'gender');
      weight = validateOptionalString(body.weight, 'weight');
      height = validateOptionalString(body.height, 'height');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `CREATE (p:Patient {
           id: $id, 
           name: $name, 
           dateOfBirth: $dateOfBirth,
           age: $age,
           gender: $gender,
           weight: $weight,
           height: $height,
           createdAt: $createdAt
         })
         RETURN p`,
        { id, name, dateOfBirth: dateOfBirth ?? null, age, gender, weight, height, createdAt },
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
