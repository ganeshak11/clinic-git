# Phase 2, Sub-phase 1 — Branch Creation & Interpretation Linking

**Phase:** 2 — Branching & Merge/Close
**Sub-phase:** 1 of 2
**Depends on:** P1.S4 (Interpretation lifecycle complete)
**Exit criterion:** A Branch can be created for a patient. An Interpretation can be created with a `branchId`, producing a `BELONGS_TO` relationship. Multiple Interpretations can belong to the same Branch.

---

## Context

Phase 1 is complete — Facts and Interpretations work. This sub-phase adds the Branch node type and modifies Interpretation creation to optionally link to a branch. This is the setup for the merge/close feature (P2.S2), which is the project's core differentiator.

---

## Proposed Changes

### [MODIFY] src/lib/types.ts

Add Branch-related types (if not already present from P1.S1):
- `Branch` interface with `BranchStatus = 'Open' | 'Closed'`
- `CreateBranchInput` interface

### [MODIFY] src/lib/schema.ts

Add Branch uniqueness constraint:
```typescript
'CREATE CONSTRAINT branch_id_unique IF NOT EXISTS FOR (b:Branch) REQUIRE b.id IS UNIQUE',
```

### [NEW] src/app/api/branch/route.ts — Create Branch

```typescript
// POST /api/branch
// Body: { patientId: string, question: string }
// Creates: (Branch {id, patientId, question, status: 'Open', createdAt})
// Validates: patient exists → 404 if not
// Returns: 201 with branch data
```

### [MODIFY] src/app/api/interpretation/route.ts — Add branchId Support

Modify the existing POST handler to accept optional `branchId`:
- If `branchId` is provided, verify the branch exists and is `Open`
- Create `(Interpretation)-[:BELONGS_TO]->(Branch)` relationship
- Branch must belong to the same patient as the interpretation

```typescript
// Added to the existing Cypher query:
// OPTIONAL MATCH (b:Branch {id: $branchId})
// WHERE $branchId IS NOT NULL AND b.status = 'Open'
// ...
// FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END |
//   CREATE (i)-[:BELONGS_TO]->(b)
// )
```

**Validation:**
- If `branchId` is provided but branch not found → 404
- If branch is `Closed` → 409
- If branch's `patientId` doesn't match → 400

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/lib/schema.ts` | Add Branch constraint |
| NEW | `src/app/api/branch/route.ts` | `POST /api/branch` |
| MODIFY | `src/app/api/interpretation/route.ts` | Add optional `branchId` linking |

---

## Verification

```bash
# Apply updated schema
curl -X POST http://localhost:3000/api/schema

# Create a branch
curl -X POST http://localhost:3000/api/branch \
  -H 'Content-Type: application/json' \
  -d '{"patientId": "<id>", "question": "Cause of lung lesion"}'

# Create interpretations on the branch
curl -X POST http://localhost:3000/api/interpretation \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "<id>",
    "summary": "Tuberculosis",
    "supportingFactIds": ["<fact-id>"],
    "authorId": "<doc-id>",
    "branchId": "<branch-id>"
  }'

# Repeat for "Lung cancer" and "Fungal infection"

# Verify in Neo4j Browser:
# MATCH (i:Interpretation)-[:BELONGS_TO]->(b:Branch) RETURN i, b
```
