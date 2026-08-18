import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';

/**
 * POST /api/branch
 *
 * Creates a new diagnostic branch.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let patientId: string, question: string;
    try {
      patientId = validateString(body.patientId, 'patientId');
      question = validateString(body.question, 'question');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (p:Patient {id: $patientId})
         CREATE (b:Branch {
           id: $id,
           patientId: $patientId,
           question: $question,
           status: 'Open',
           createdAt: $createdAt
         })
         CREATE (p)-[:HAS_BRANCH]->(b)
         RETURN b`,
        { patientId, question, id, createdAt },
      );
      return res.records[0]?.get('b').properties ?? null;
    });

    if (!result) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
