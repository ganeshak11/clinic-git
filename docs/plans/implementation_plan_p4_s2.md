# Phase 4, Sub-phase 2 — Decision Transitions & Permissions

**Phase:** 4 — Decisions
**Sub-phase:** 2 of 3
**Depends on:** P4.S1 (Decision creation working)
**Exit criterion:** Decision retract/supersede work with the transition guard. `canRetract` is enforced server-side on both Interpretation and Decision retract endpoints. Non-author/non-supervisor retract returns `403`.

---

## Context

Decisions exist (P4.S1) but can only have status `Active`. This sub-phase adds retract and supersede transitions, and — critically — enforces the `canRetract` permission check on BOTH Interpretation retract (backfilling if it was loosely gated in Phase 1) and Decision retract.

---

## Proposed Changes

### [NEW] src/app/api/decision/[id]/retract/route.ts — Decision Retract

Supervisor-gated per api-spec.md. Same shape as interpretation retract:

```typescript
// POST /api/decision/:id/retract
// Body: { reason: string }
// Headers (temporary until auth): x-user-id, x-is-supervisor
//
// Steps:
// 1. Fetch decision from DB
// 2. canTransitionDecision(current.status, 'Retracted') → 409 if false
// 3. canRetract(decision.authorId, requestUserId, isSupervisor) → 403 if false
// 4. SET decision.status = 'Retracted', decision.retractedReason = reason
//
// Permission check uses SERVER-SIDE session values, NOT client body — security.md
```

### [NEW] src/app/api/decision/[id]/supersede/route.ts — Decision Supersede

```typescript
// POST /api/decision/:id/supersede
// Body: { newAction: string, interpretationId: string, reason: string }
//
// Steps:
// 1. Verify old decision exists and status allows transition (Active → Superseded)
// 2. SET old.status = 'Superseded'
// 3. CREATE new Decision with (new)-[:SUPERSEDES]->(old) — newer → older (invariant #3)
// 4. new decision defaults to Active, linked to same or new interpretation
```

### [MODIFY] src/app/api/interpretation/[id]/retract/route.ts — Enforce canRetract

**Backfill if needed:** Verify that the Phase 1 retract endpoint actually calls `canRetract()` from `src/lib/permissions.ts` and checks the session's `userId`/`isSupervisor`, not client-supplied values. If the Phase 1 implementation used a placeholder, replace it now.

```typescript
// Both endpoints must use this pattern:
const userId = request.headers.get('x-user-id'); // temp until auth
const isSupervisor = request.headers.get('x-is-supervisor') === 'true'; // temp

if (!canRetract(node.authorId, userId, isSupervisor)) {
  return NextResponse.json(
    { error: 'Only the author or a supervisor can retract' },
    { status: 403 },
  );
}
```

### [NEW] Integration Tests

```typescript
// src/app/api/__tests__/decision-permissions.integration.test.ts

describe('Decision retract permissions', () => {
  it('allows the original author to retract', () => { /* ... */ });
  it('allows a supervisor to retract', () => { /* ... */ });
  it('rejects non-author, non-supervisor → 403', () => { /* ... */ });
  it('rejects double-retraction → 409', () => { /* ... */ });
});

describe('Interpretation retract permissions (backfill verification)', () => {
  it('rejects non-author, non-supervisor → 403', () => { /* ... */ });
});

describe('Decision supersede', () => {
  it('creates new decision with SUPERSEDES link', () => { /* ... */ });
  it('old decision becomes Superseded', () => { /* ... */ });
  it('SUPERSEDES points newer → older', () => { /* ... */ });
});
```

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/decision/[id]/retract/route.ts` | Decision retract (supervisor-gated) |
| NEW | `src/app/api/decision/[id]/supersede/route.ts` | Decision supersede |
| MODIFY | `src/app/api/interpretation/[id]/retract/route.ts` | Enforce `canRetract` if not already |
| NEW | Integration test file | Permission and transition tests |

---

## Verification

```bash
# Retract by author
curl -X POST http://localhost:3000/api/decision/<id>/retract \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <author-doctor-id>' \
  -H 'x-is-supervisor: false' \
  -d '{"reason": "Wrong dosage prescribed"}'
# Expected: 200

# Retract by non-author, non-supervisor → 403
curl -X POST http://localhost:3000/api/decision/<id>/retract \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <other-doctor-id>' \
  -H 'x-is-supervisor: false' \
  -d '{"reason": "Should not work"}'
# Expected: 403

npm run test:integration
```
