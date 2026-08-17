# Phase 1, Sub-phase 3 — Interpretation Creation & Evidence Linking

**Phase:** 1 — Facts & Interpretations
**Sub-phase:** 3 of 4
**Depends on:** P1.S2 (Patient and Fact endpoints working, schema constraints applied)
**Exit criterion:** Via `curl`, create an Interpretation citing two Facts, confirm `SUPPORTS` and `AUTHORED_BY` relationships exist in Neo4j. Empty `supportingFactIds` returns `400`. Nonexistent fact IDs return `404`.

---

## Context

Patients and Facts exist (P1.S2). This sub-phase adds the second core node type — Interpretation — and the evidence-linking relationships that enforce PRD §6.1 ("no diagnosis without evidence"). Also adds a Doctor creation endpoint since Interpretations require an author.

---

## Proposed Changes

### [NEW] src/app/api/doctor/route.ts — Create Doctor

Doctors must exist before Interpretations can reference them. Minimal endpoint to seed Doctor nodes:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, isSupervisor } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const id = generateId();

  const result = await withSession(async (session) => {
    return session.run(
      `CREATE (d:Doctor {id: $id, name: $name, isSupervisor: $isSupervisor})
       RETURN d`,
      { id, name, isSupervisor: isSupervisor === true },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
  }

  return NextResponse.json(record.get('d').properties, { status: 201 });
}
```

### [NEW] src/app/api/interpretation/route.ts — Create Interpretation

Per api-spec.md. This is the most relationship-heavy creation endpoint:
- `(Fact)-[:SUPPORTS]->(Interpretation)` for each cited fact
- `(Interpretation)-[:AUTHORED_BY]->(Doctor)`
- Default status `Hypothesis`
- `branchId` is optional (used in Phase 2)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { patientId, summary, supportingFactIds, authorId, branchId } = body;

  // Validate required fields before touching DB
  if (!patientId || !summary || !authorId) {
    return NextResponse.json(
      { error: 'patientId, summary, and authorId are required' },
      { status: 400 },
    );
  }

  // PRD §6.1: no diagnosis without evidence — enforced at API boundary
  if (!Array.isArray(supportingFactIds) || supportingFactIds.length === 0) {
    return NextResponse.json(
      { error: 'supportingFactIds must be a non-empty array' },
      { status: 400 },
    );
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // Verify patient, doctor, and all facts exist in a single query
    // All values parameterized (invariant #5)
    return session.run(
      `MATCH (p:Patient {id: $patientId})
       MATCH (doc:Doctor {id: $authorId})
       WITH p, doc
       UNWIND $factIds AS factId
       MATCH (f:Fact {id: factId})
       WITH p, doc, collect(f) AS facts
       WHERE size(facts) = size($factIds)
       CREATE (i:Interpretation {
         id: $id,
         patientId: $patientId,
         summary: $summary,
         status: 'Hypothesis',
         authorId: $authorId,
         createdAt: $createdAt
       })
       CREATE (i)-[:AUTHORED_BY]->(doc)
       WITH i, facts
       UNWIND facts AS f
       CREATE (f)-[:SUPPORTS]->(i)
       RETURN i`,
      {
        patientId,
        authorId,
        factIds: supportingFactIds,
        id,
        summary,
        createdAt,
      },
    );
  });

  const record = result.records[0];
  if (!record) {
    // If no record returned, either patient, doctor, or some facts don't exist
    return NextResponse.json(
      { error: 'Patient, doctor, or one or more supporting facts not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(record.get('i').properties, { status: 201 });
}
```

**Design decisions:**
- Single Cypher query verifies all referenced entities exist and creates all relationships atomically — no partial writes
- `WHERE size(facts) = size($factIds)` ensures ALL referenced facts were found, not just some
- `branchId` linking is deferred to P2.S1 to keep this sub-phase focused
- Status defaults to `Hypothesis` in the Cypher CREATE, not passed from the client

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/doctor/route.ts` | `POST /api/doctor` |
| NEW | `src/app/api/interpretation/route.ts` | `POST /api/interpretation` |

---

## Verification

```bash
# Create a doctor
curl -X POST http://localhost:3000/api/doctor \
  -H 'Content-Type: application/json' \
  -d '{"name": "Dr. Smith", "isSupervisor": false}'

# Create an interpretation citing two facts
curl -X POST http://localhost:3000/api/interpretation \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "<patient-id>",
    "summary": "Suspected Type 2 Diabetes",
    "supportingFactIds": ["<fact-1-id>", "<fact-2-id>"],
    "authorId": "<doctor-id>"
  }'

# Verify relationships in Neo4j Browser:
# MATCH (f:Fact)-[:SUPPORTS]->(i:Interpretation)-[:AUTHORED_BY]->(d:Doctor) RETURN f, i, d

# Test empty facts → 400
curl -X POST http://localhost:3000/api/interpretation \
  -H 'Content-Type: application/json' \
  -d '{"patientId": "x", "summary": "test", "supportingFactIds": [], "authorId": "y"}'
# Expected: 400

# Test nonexistent fact → 404
curl -X POST http://localhost:3000/api/interpretation \
  -H 'Content-Type: application/json' \
  -d '{"patientId": "<real>", "summary": "test", "supportingFactIds": ["nonexistent"], "authorId": "<real>"}'
# Expected: 404
```
