# Phase 1, Sub-phase 4 — Status Transitions & Patient Read

**Phase:** 1 — Facts & Interpretations
**Sub-phase:** 4 of 4 (Phase 1 completion)
**Depends on:** P1.S3 (Interpretation creation working)
**Exit criterion:** Full lifecycle via API: create patient → add facts → create interpretation → confirm → retract with reason. Invalid transitions return `409`. Supersede creates a new Interpretation with `SUPERSEDES` pointing newer → older. `GET /api/patient/:id` returns patient with all facts and interpretations.

---

## Context

Interpretations exist (P1.S3) but can only be created with status `Hypothesis`. This sub-phase adds the three status-transition endpoints (confirm, retract, supersede) and the patient read endpoint. Completing this sub-phase completes Phase 1.

---

## Proposed Changes

### [NEW] src/app/api/interpretation/[id]/confirm/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { canTransitionInterpretation } from '@/lib/transitions';
import type { InterpretationStatus } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const result = await withSession(async (session) => {
    // Fetch current status
    const existing = await session.run(
      'MATCH (i:Interpretation {id: $id}) RETURN i.status AS status',
      { id },
    );

    const record = existing.records[0];
    if (!record) {
      return { error: 'Interpretation not found', status: 404 };
    }

    const currentStatus = record.get('status') as InterpretationStatus;

    if (!canTransitionInterpretation(currentStatus, 'Confirmed')) {
      return {
        error: `Cannot transition from ${currentStatus} to Confirmed`,
        status: 409,
      };
    }

    // Apply transition
    const updated = await session.run(
      `MATCH (i:Interpretation {id: $id})
       SET i.status = 'Confirmed'
       RETURN i`,
      { id },
    );

    return { data: updated.records[0]?.get('i').properties };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
```

### [NEW] src/app/api/interpretation/[id]/retract/route.ts

Supervisor-gated per api-spec.md. Uses both `canTransition` and `canRetract`.

```typescript
// Uses canTransitionInterpretation (from → 'Retracted')
// Uses canRetract (nodeAuthorId, requestingUserId, isSupervisor)
// Requires { reason: string } in body
// 409 for invalid transition, 403 for permission failure
// Stores retractedReason on the node
```

**Permission enforcement:** The `canRetract` check uses the session's `userId` and `isSupervisor`, NOT client-supplied values — per security.md. For Phase 1 (no auth yet), `userId` and `isSupervisor` are passed via request headers as a temporary mechanism, documented clearly as "replace with session-based auth before Phase 5."

### [NEW] src/app/api/interpretation/[id]/supersede/route.ts

Per api-spec.md:
- Creates a NEW Interpretation with `(new)-[:SUPERSEDES]->(old)` — **newer → older** (invariant #3)
- Sets old interpretation status to `Superseded`
- Old node is never mutated beyond its status field
- New interpretation has its own supporting facts and defaults to `Hypothesis`

```typescript
// Key Cypher:
// MATCH (old:Interpretation {id: $oldId})
// WHERE old.status = 'Confirmed'
// SET old.status = 'Superseded'
// CREATE (new:Interpretation { ... status: 'Hypothesis' ... })
// CREATE (new)-[:SUPERSEDES]->(old)    ← newer → older (invariant #3)
// WITH new
// UNWIND $factIds AS factId
// MATCH (f:Fact {id: factId})
// CREATE (f)-[:SUPPORTS]->(new)
// RETURN new
```

**Critical:** The `SUPERSEDES` relationship points from the NEW interpretation to the OLD one. Getting this backwards is the exact bug from codeexamples.md #4 — blame would silently return incomplete chains without erroring.

### [NEW] src/app/api/patient/[id]/route.ts — Patient Read

Per api-spec.md:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (p:Patient {id: $id})
       OPTIONAL MATCH (p)-[:HAS_FACT]->(f:Fact)
       OPTIONAL MATCH (f)-[:SUPPORTS]->(i:Interpretation)
       RETURN p,
              collect(DISTINCT f) AS facts,
              collect(DISTINCT i) AS interpretations`,
      { id },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...record.get('p').properties,
    facts: record.get('facts').map((f: any) => f.properties),
    interpretations: record.get('interpretations').map((i: any) => i.properties),
  });
}
```

### [NEW] Integration Tests

```typescript
// src/app/api/__tests__/interpretation-lifecycle.integration.test.ts

describe('Interpretation lifecycle', () => {
  it('full lifecycle: create → confirm → retract', () => { /* ... */ });
  it('rejects Hypothesis → Superseded (invalid skip)', () => { /* ... */ });
  it('rejects Hypothesis → Retracted (invalid skip)', () => { /* ... */ });
  it('rejects Confirmed → Confirmed (same-state)', () => { /* ... */ });
  it('rejects Retracted → Retracted (double retraction)', () => { /* ... */ });
  it('supersede creates new interpretation with SUPERSEDES link', () => { /* ... */ });
  it('SUPERSEDES points newer → older (invariant #3)', () => { /* ... */ });
  it('GET /api/patient/:id returns facts and interpretations', () => { /* ... */ });
});
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/interpretation/[id]/confirm/route.ts` | Confirm endpoint |
| NEW | `src/app/api/interpretation/[id]/retract/route.ts` | Retract endpoint (supervisor-gated) |
| NEW | `src/app/api/interpretation/[id]/supersede/route.ts` | Supersede endpoint |
| NEW | `src/app/api/patient/[id]/route.ts` | Patient read endpoint |
| NEW | Integration test file | Full lifecycle testing |

---

## Verification

```bash
# Full lifecycle test
# 1. Create patient, doctor, facts (from P1.S2/P1.S3)
# 2. Create interpretation
curl -X POST http://localhost:3000/api/interpretation/...

# 3. Confirm
curl -X POST http://localhost:3000/api/interpretation/<id>/confirm

# 4. Retract
curl -X POST http://localhost:3000/api/interpretation/<id>/retract \
  -H 'Content-Type: application/json' \
  -d '{"reason": "Diagnosis was incorrect based on new evidence"}'

# 5. Verify invalid transition
curl -X POST http://localhost:3000/api/interpretation/<new-id>/supersede
# Expected: 409 (Hypothesis → Superseded is invalid)

# 6. Read patient
curl http://localhost:3000/api/patient/<id>
# Expected: patient with facts and interpretations

# Run integration tests
npm run test:integration
```

**Phase 1 is complete when all integration tests pass.**
