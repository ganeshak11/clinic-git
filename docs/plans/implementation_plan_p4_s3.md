# Phase 4, Sub-phase 3 — Blame Retargeting & End-to-End Tests

**Phase:** 4 — Decisions
**Sub-phase:** 3 of 3 (Phase 4 completion)
**Depends on:** P4.S2 (Decision transitions and permissions working)
**Exit criterion:** Blame takes a Decision ID, walks `BASED_ON` → Interpretation → `SUPERSEDES` chain → Facts → Doctor. End-to-end test: fact → interpretation → confirm → decision → retract decision → blame still resolves correctly.

---

## Context

This sub-phase retargets the blame endpoint from P3.S1 to accept a Decision ID (the final API shape per architecture.md §4), updates the patient log to include Decision entries, and runs comprehensive end-to-end tests covering the full lifecycle.

---

## Proposed Changes

### [MODIFY] Blame Endpoint — Retarget to Decision

Move/rename from `src/app/api/blame/[interpretationId]/` to `src/app/api/blame/[decisionId]/`:

```typescript
// GET /api/blame/:decisionId
// Final Cypher query from architecture.md §4:

const BLAME_QUERY = `
  MATCH (d:Decision {id: $id})-[:BASED_ON]->(i:Interpretation)
  OPTIONAL MATCH (i)-[:SUPERSEDES*0..5]->(prior:Interpretation)
  MATCH (f:Fact)-[:SUPPORTS]->(i)
  MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
  RETURN d, i, collect(DISTINCT prior) AS priorChain,
         collect(DISTINCT f) AS facts, doc
`;
```

**Response shape (per api-spec.md):**
```typescript
{
  decision: Decision;
  interpretation: Interpretation;
  priorChain: Interpretation[];     // walked via SUPERSEDES, oldest last
  supportingFacts: Fact[];
  authoredBy: { id: string; name: string };
}
```

### [MODIFY] Patient Log — Add Decision Entries

Update `src/app/api/patient/[id]/log/route.ts` to include Decision entries in the chronological timeline:

```typescript
// Add to the existing Cypher query:
// OPTIONAL MATCH (dec:Decision {patientId: $id})
// WITH ..., collect({
//   type: 'decision',
//   timestamp: dec.createdAt,
//   nodeId: dec.id,
//   summary: dec.action + ' [' + dec.status + ']'
// }) AS decisionEntries
// RETURN factEntries + interpEntries + decisionEntries AS entries
```

### [MODIFY] api-spec.md — Doc-Sync

If the blame endpoint path changed (e.g., parameter name), update the API spec in the same commit per the doc-sync rule (AGENTS.md).

### [NEW] End-to-End Integration Tests

The definitive test suite for the complete system:

```typescript
// src/app/api/__tests__/end-to-end.integration.test.ts

describe('Full lifecycle end-to-end', () => {
  it('fact → interpretation → confirm → decision → retract → blame resolves', async () => {
    // 1. Create patient, doctor
    // 2. Create 2 facts
    // 3. Create interpretation citing both facts
    // 4. Confirm interpretation
    // 5. Create decision based on confirmed interpretation
    // 6. Retract decision (by author)
    // 7. Run blame on decision
    // 8. Assert: blame returns decision, interpretation, facts, doctor
  });

  it('superseded chain: blame walks through all prior interpretations', async () => {
    // 1. Create interpretation A → confirm
    // 2. Supersede A with B → confirm B
    // 3. Create decision based on B
    // 4. Blame on decision → returns B, priorChain=[A], facts, doctor
  });

  it('branched case: branch → resolve → decision → blame', async () => {
    // 1. Create branch with 3 interpretations
    // 2. Resolve branch (one confirmed, two ruled-out)
    // 3. Create decision based on confirmed interpretation
    // 4. Blame on decision → returns full chain
    // 5. Ruled-out interpretations still queryable via branch read
  });

  it('patient log includes facts, interpretations, and decisions chronologically', async () => {
    // Verify all three node types appear in correct order
  });

  it('permission enforcement across the full stack', async () => {
    // Non-author, non-supervisor retract on both Interpretation and Decision → 403
  });
});
```

---

## Files Modified

| Action | File | Purpose |
|--------|------|---------|
| MODIFY/MOVE | `src/app/api/blame/[decisionId]/route.ts` | Retarget blame to Decision |
| MODIFY | `src/app/api/patient/[id]/log/route.ts` | Add Decision entries |
| MODIFY | `docs/architecture/api-spec.md` | Doc-sync if blame path changed |
| NEW | `src/app/api/__tests__/end-to-end.integration.test.ts` | Full lifecycle tests |

---

## Verification

```bash
# End-to-end blame
curl http://localhost:3000/api/blame/<decision-id>
# Expected: full BlameResult with decision, interpretation, priorChain, facts, author

# Patient log with decisions
curl http://localhost:3000/api/patient/<id>/log
# Expected: entries include type='decision'

# Full integration suite
npm run test:integration
```

**Phase 4 is complete when all end-to-end integration tests pass. The entire backend API is now feature-complete.**
