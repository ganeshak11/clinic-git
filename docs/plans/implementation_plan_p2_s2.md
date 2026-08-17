# Phase 2, Sub-phase 2 — Branch Resolve & Read

**Phase:** 2 — Branching & Merge/Close
**Sub-phase:** 2 of 2 (Phase 2 completion)
**Depends on:** P2.S1 (Branch creation and interpretation linking working)
**Exit criterion:** Create a branch with 3 competing interpretations, resolve one as confirmed — the other two become `RuledOut`, the branch becomes `Closed`. Ruled-out interpretations are still queryable. Resolving an already-closed branch returns `409`. Confirming an interpretation not on the branch returns `400`.

---

## Context

Branches exist and have interpretations linked via `BELONGS_TO` (P2.S1). This sub-phase implements the merge/close operation — the project's core differentiator — and a read endpoint for branch details.

---

## Proposed Changes

### [NEW] src/app/api/branch/[id]/resolve/route.ts — Branch Resolve

Implements the merge/close Cypher from architecture.md §5:

```typescript
// POST /api/branch/:id/resolve
// Body: { confirmedInterpretationId: string }
//
// Cypher:
//   MATCH (b:Branch {id: $branchId})<-[:BELONGS_TO]-(i:Interpretation)
//   WHERE b.status = 'Open'
//   WITH b, i, collect(i) AS allInterps
//   // Verify confirmedInterpretationId is actually on this branch
//   WHERE any(x IN allInterps WHERE x.id = $confirmedId)
//   SET i.status = CASE WHEN i.id = $confirmedId THEN 'Confirmed' ELSE 'RuledOut' END
//   WITH b
//   SET b.status = 'Closed'
//
// Validations:
//   - Branch not found → 404
//   - Branch already Closed → 409
//   - confirmedInterpretationId not on this branch → 400
//   - All IDs are string comparisons (not number — codeexamples.md #3)
//   - All values parameterized (invariant #5)
```

**Critical design points:**
- Ruled-out interpretations are SET to `RuledOut`, never deleted — per PRD §6.3
- The `CASE WHEN` approach sets all statuses atomically in one query — no partial state
- Uses `canTransitionInterpretation` check: only `Hypothesis` interpretations on the branch should be transitioned. If an interpretation on the branch is already `Confirmed` or `Retracted`, this is an error
- All IDs compared as strings, never numbers (codeexamples.md #3)

### [NEW] src/app/api/branch/[id]/route.ts — Branch Detail

```typescript
// GET /api/branch/:id
// Returns: Branch with all attached interpretations and their statuses
//
// Cypher:
//   MATCH (b:Branch {id: $id})
//   OPTIONAL MATCH (i:Interpretation)-[:BELONGS_TO]->(b)
//   RETURN b, collect(i) AS interpretations
//
// Response shape (per api-spec.md):
// {
//   id, patientId, question, status,
//   interpretations: Interpretation[]
// }
```

### [NEW] Integration Tests

```typescript
// src/app/api/__tests__/branch-lifecycle.integration.test.ts

describe('Branch lifecycle', () => {
  it('creates a branch and attaches interpretations', () => { /* ... */ });
  it('resolves branch: one Confirmed, rest RuledOut, branch Closed', () => { /* ... */ });
  it('ruled-out interpretations are still queryable via GET /api/branch/:id', () => { /* ... */ });
  it('rejects resolving an already-closed branch → 409', () => { /* ... */ });
  it('rejects confirming an interpretation not on the branch → 400', () => { /* ... */ });
  it('GET /api/branch/:id returns branch with all interpretations', () => { /* ... */ });
});
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/branch/[id]/resolve/route.ts` | Branch merge/close |
| NEW | `src/app/api/branch/[id]/route.ts` | Branch detail read |
| NEW | Integration test file | Branch lifecycle tests |

---

## Verification

```bash
# Full branch lifecycle:
# 1. Create branch (from P2.S1)
# 2. Create 3 interpretations on branch (TB, cancer, fungal)

# 3. Resolve — confirm TB
curl -X POST http://localhost:3000/api/branch/<id>/resolve \
  -H 'Content-Type: application/json' \
  -d '{"confirmedInterpretationId": "<tb-interpretation-id>"}'

# 4. Read branch
curl http://localhost:3000/api/branch/<id>
# Expected: TB = Confirmed, cancer = RuledOut, fungal = RuledOut, branch = Closed

# 5. Double-resolve → 409
curl -X POST http://localhost:3000/api/branch/<id>/resolve \
  -H 'Content-Type: application/json' \
  -d '{"confirmedInterpretationId": "<any-id>"}'
# Expected: 409

npm run test:integration
```

**Phase 2 is complete when all integration tests pass.**
