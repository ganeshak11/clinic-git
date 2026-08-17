# Phase 3, Sub-phase 1 — Blame Query & Endpoint

**Phase:** 3 — Blame
**Sub-phase:** 1 of 2
**Depends on:** P2.S2 (Branching complete, interpretations have SUPERSEDES chains)
**Exit criterion:** Given an Interpretation that superseded a prior one, the blame query returns both the current and prior Interpretations, the supporting Facts, and the authoring Doctor. The `SUPERSEDES` walk direction is correct (newer → older). The query uses bounded variable-length paths (`*0..5`).

---

## Context

The branching feature is complete (Phase 2). This sub-phase implements the "clinical blame" query — the demo centerpiece per architecture.md §4. The blame query walks the `SUPERSEDES` chain from a current interpretation back to the original reasoning.

Pre-Phase 4, blame targets an Interpretation directly (retargeted to Decision in P4.S3).

---

## Proposed Changes

### Blame Cypher Query Development

**Step 1:** Write and test in Neo4j Browser (`http://localhost:7474`) against seeded test data first — per TODO.md Phase 3.

```cypher
MATCH (i:Interpretation {id: $id})
OPTIONAL MATCH (i)-[:SUPERSEDES*0..5]->(prior:Interpretation)
MATCH (f:Fact)-[:SUPPORTS]->(i)
MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
RETURN i,
       collect(DISTINCT prior) AS priorChain,
       collect(DISTINCT f) AS facts,
       doc
```

**Critical design points:**
- `(i)-[:SUPERSEDES*0..5]->(prior)` — walks newer → older (invariant #3). This is the CORRECT direction per architecture.md: `(newerInterpretation)-[:SUPERSEDES]->(olderInterpretation)`
- `*0..5` not bare `*` — bounded variable-length path per coding-standards.md
- `*0..` means the current interpretation itself is included when chain length is 0 (no supersede)
- The codeexamples.md #4 bug was `(i)<-[:SUPERSEDES]-(prior)` — the WRONG direction, which looks for things that supersede `i` (newer), not things `i` superseded (older)

### [NEW] src/app/api/blame/[interpretationId]/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';

export async function GET(
  request: NextRequest,
  { params }: { params: { interpretationId: string } },
) {
  const { interpretationId } = params;

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (i:Interpretation {id: $id})
       OPTIONAL MATCH (i)-[:SUPERSEDES*0..5]->(prior:Interpretation)
       MATCH (f:Fact)-[:SUPPORTS]->(i)
       MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
       RETURN i,
              collect(DISTINCT prior) AS priorChain,
              collect(DISTINCT f) AS facts,
              doc`,
      { id: interpretationId },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json(
      { error: 'Interpretation not found' },
      { status: 404 },
    );
  }

  const interpretation = record.get('i').properties;
  const priorChain = record.get('priorChain')
    .map((p: any) => p.properties)
    .filter((p: any) => p.id !== interpretation.id); // exclude self from 0-length match
  const supportingFacts = record.get('facts').map((f: any) => f.properties);
  const authoredBy = record.get('doc').properties;

  return NextResponse.json({
    interpretation,
    priorChain,
    supportingFacts,
    authoredBy: { id: authoredBy.id, name: authoredBy.name },
  });
}
```

**Note:** This endpoint targets Interpretation for now. In P4.S3, it will be retargeted to accept a Decision ID and walk `BASED_ON → Interpretation → SUPERSEDES chain`.

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/blame/[interpretationId]/route.ts` | Blame query endpoint (Interpretation-targeted) |

---

## Verification

```bash
# Set up test data:
# 1. Create patient, doctor, facts
# 2. Create Interpretation A citing facts → confirm
# 3. Supersede A with B (new interpretation)
# 4. Run blame on B

curl http://localhost:3000/api/blame/<interpretation-B-id>
# Expected: {
#   interpretation: { id: B, status: 'Hypothesis', ... },
#   priorChain: [{ id: A, status: 'Superseded', ... }],
#   supportingFacts: [...],
#   authoredBy: { id: '...', name: 'Dr. Smith' }
# }

# Test simple case (no supersede chain)
curl http://localhost:3000/api/blame/<fresh-interpretation-id>
# Expected: priorChain = []

# Verify in Neo4j Browser that SUPERSEDES direction is correct:
# MATCH (new:Interpretation)-[:SUPERSEDES]->(old:Interpretation) RETURN new.id, old.id
# new should be the more recent interpretation
```
