import { NextRequest, NextResponse } from 'next/server';
import { withWriteTransaction } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { requireAuth, AuthError } from '@/lib/auth-guard';
import { parseBody, validateString, validateIdArray, validateOptionalString } from '@/lib/validation';

/**
 * POST /api/interpretation
 *
 * Creates a new Interpretation with status 'Hypothesis'.
 * Author is derived from session, never from request body.
 * Branch validation is embedded in the same Cypher query (single transaction).
 * Fixes C-3, C-4, M-7 (multiple withSession calls).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const body = await parseBody(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let patientId: string, summary: string, supportingFactIds: string[];
    let branchId: string | null;
    try {
      patientId = validateString(body.patientId, 'patientId');
      summary = validateString(body.summary, 'summary');
      supportingFactIds = validateIdArray(body.supportingFactIds, 'supportingFactIds');
      branchId = validateOptionalString(body.branchId, 'branchId');
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    // Single transaction: validates patient, doctor, facts, and optional branch
    const result = await withWriteTransaction(async (tx) => {
      const res = await tx.run(
        `MATCH (p:Patient {id: $patientId})
         MATCH (doc:Doctor {id: $authorId})
         WITH p, doc
         UNWIND $factIds AS factId
         MATCH (f:Fact {id: factId})
         WITH p, doc, collect(f) AS facts
         WHERE size(facts) = size($factIds)

         // Branch validation: if branchId provided, must exist, be Open, and belong to patient
         OPTIONAL MATCH (b:Branch {id: $branchId})
         WHERE $branchId IS NOT NULL
         WITH p, doc, facts, b
         WHERE ($branchId IS NULL)
            OR (b IS NOT NULL AND b.status = 'Open' AND b.patientId = $patientId)

         CREATE (i:Interpretation {
           id: $id,
           patientId: $patientId,
           summary: $summary,
           status: 'Hypothesis',
           authorId: $authorId,
           createdAt: $createdAt
         })

         FOREACH (_ IN CASE WHEN $branchId IS NOT NULL THEN [1] ELSE [] END |
           SET i.branchId = $branchId
         )

         CREATE (i)-[:AUTHORED_BY]->(doc)

         FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END |
           CREATE (i)-[:BELONGS_TO]->(b)
         )

         WITH i, facts
         UNWIND facts AS f
         MERGE (f)-[:SUPPORTS]->(i)
         RETURN i`,
        {
          patientId,
          authorId: auth.userId,
          factIds: supportingFactIds,
          branchId: branchId ?? null,
          id,
          summary,
          createdAt,
        },
      );
      return res.records[0]?.get('i').properties ?? null;
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Patient, doctor, facts, or branch not found (or branch is closed/wrong patient)' },
        { status: 404 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
