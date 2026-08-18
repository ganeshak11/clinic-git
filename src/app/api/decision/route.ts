import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction, withReadTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString } from '@/lib/validation';

/**
 * POST /api/decision
 *
 * Creates a new Decision with status 'Active'.
 * Author is derived from session, never from request body (C-4).
 * Enforces cross-patient validation (M-3).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let patientId: string, interpretationId: string, action: string;
    try {
      patientId = validateString(body.patientId, 'patientId');
      interpretationId = validateString(body.interpretationId, 'interpretationId');
      action = validateString(body.action, 'action');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    const result = await withWriteTransaction(async (tx) => {
      // Verify interpretation exists, is Confirmed, AND belongs to the same patient (M-3)
      const res = await tx.run(
        `MATCH (i:Interpretation {id: $interpretationId})
         WHERE i.status = 'Confirmed' AND i.patientId = $patientId
         MATCH (doc:Doctor {id: $authorId})
         CREATE (d:Decision {
           id: $id,
           patientId: $patientId,
           interpretationId: $interpretationId,
           action: $action,
           status: 'Active',
           authorId: $authorId,
           createdAt: $createdAt
         })
         CREATE (d)-[:BASED_ON]->(i)
         CREATE (d)-[:AUTHORED_BY]->(doc)
         RETURN d`,
        { interpretationId, authorId: auth.userId, id, patientId, action, createdAt },
      );
      return res.records[0]?.get('d').properties ?? null;
    });

    if (result) {
      return NextResponse.json(result, { status: 201 });
    }

    const diagnostics = await withReadTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (i:Interpretation {id: $interpretationId})
         RETURN i.status AS status, i.patientId AS patientId`,
        { interpretationId }
      );
      return res.records[0];
    });

    if (!diagnostics) {
      return NextResponse.json({ error: 'Interpretation not found' }, { status: 404 });
    }

    if (diagnostics.get('patientId') !== patientId) {
      return NextResponse.json({ error: 'Interpretation does not belong to patient' }, { status: 400 });
    }

    if (diagnostics.get('status') !== 'Confirmed') {
      return NextResponse.json({ error: 'Interpretation is not Confirmed' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Doctor not found or unknown error' },
      { status: 404 },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
