import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString, validateFactType, validateISODate, validateOptionalString } from '@/lib/validation';
import type { FactType } from '@/lib/types';

/**
 * POST /api/fact
 *
 * Creates a new Fact and links it to a Patient.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let patientId: string, type: FactType, value: string, recordedAt: string, attachmentUrl: string | null;
    try {
      patientId = validateString(body.patientId, 'patientId');
      type = validateFactType(body.type);
      value = validateString(body.value, 'value');
      recordedAt = validateISODate(body.recordedAt, 'recordedAt');
      attachmentUrl = validateOptionalString(body.attachmentUrl, 'attachmentUrl');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();

    const result = await withWriteTransaction(async (tx) => {
      // H-1 fix: store patientId on the Fact node
      const res = await tx.run(
        `MATCH (p:Patient {id: $patientId})
         CREATE (f:Fact {
           id: $id, 
           patientId: $patientId,
           type: $type, 
           value: $value, 
           recordedAt: $recordedAt, 
           attachmentUrl: $attachmentUrl
         })
         CREATE (p)-[:HAS_FACT]->(f)
         RETURN f`,
        { patientId, id, type, value, recordedAt, attachmentUrl: attachmentUrl ?? null },
      );
      return res.records[0]?.get('f').properties ?? null;
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
