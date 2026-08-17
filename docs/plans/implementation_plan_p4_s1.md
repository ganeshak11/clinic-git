# Phase 4, Sub-phase 1 — Decision Node & Creation

**Phase:** 4 — Decisions
**Sub-phase:** 1 of 3
**Depends on:** P3.S2 (Blame and log working)
**Exit criterion:** A Decision can be created referencing a Confirmed Interpretation. Attempting to base a Decision on a non-Confirmed Interpretation returns `400`. The Decision has status `Active` by default.

---

## Context

This sub-phase adds the Decision node — the gap identified in architecture.md §2.3 that earlier drafts missed. Decisions represent treatments/prescriptions/procedures based on a confirmed diagnosis. They have their own status lifecycle (`Active → Retracted / Superseded`) mirroring Interpretations.

---

## Proposed Changes

### [MODIFY] src/lib/transitions.ts

Add Decision-specific transition guard (likely already scaffolded in P1.S1, now wired to the endpoint):

```typescript
// canTransitionDecision() already defined — verify it matches:
// Active → Retracted, Active → Superseded
// Same-state rejected
```

### [MODIFY] src/lib/schema.ts

Add Decision uniqueness constraint (if not already present):
```typescript
'CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (dec:Decision) REQUIRE dec.id IS UNIQUE',
```

### [NEW] src/app/api/decision/route.ts — Create Decision

Per api-spec.md:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { patientId, interpretationId, action, authorId } = body;

  // Validate required fields
  if (!patientId || !interpretationId || !action || !authorId) {
    return NextResponse.json(
      { error: 'patientId, interpretationId, action, and authorId are required' },
      { status: 400 },
    );
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // Verify interpretation exists AND is Confirmed — api-spec.md requirement
    return session.run(
      `MATCH (i:Interpretation {id: $interpretationId})
       WHERE i.status = 'Confirmed'
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
      { interpretationId, authorId, id, patientId, action, createdAt },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json(
      { error: 'Interpretation not found, not Confirmed, or Doctor not found' },
      { status: 400 },
    );
  }

  return NextResponse.json(record.get('d').properties, { status: 201 });
}
```

**Key:** `WHERE i.status = 'Confirmed'` in the Cypher ensures the Decision can only be based on a Confirmed interpretation. If the interpretation is `Hypothesis`, `RuledOut`, `Retracted`, or `Superseded`, the MATCH returns nothing and the endpoint returns 400.

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/lib/schema.ts` | Add Decision constraint |
| NEW | `src/app/api/decision/route.ts` | `POST /api/decision` |

---

## Verification

```bash
# Apply updated schema
curl -X POST http://localhost:3000/api/schema

# Create a decision on a confirmed interpretation
curl -X POST http://localhost:3000/api/decision \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "<id>",
    "interpretationId": "<confirmed-interp-id>",
    "action": "Start Metformin 500mg twice daily",
    "authorId": "<doctor-id>"
  }'
# Expected: 201 with decision data, status = Active

# Reject decision on non-confirmed interpretation
curl -X POST http://localhost:3000/api/decision \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "<id>",
    "interpretationId": "<hypothesis-interp-id>",
    "action": "Start treatment",
    "authorId": "<doctor-id>"
  }'
# Expected: 400

# Verify in Neo4j Browser:
# MATCH (d:Decision)-[:BASED_ON]->(i:Interpretation) RETURN d, i
```
