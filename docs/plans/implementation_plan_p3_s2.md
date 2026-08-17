# Phase 3, Sub-phase 2 — Patient Log & Supersede Chain Tests

**Phase:** 3 — Blame
**Sub-phase:** 2 of 2 (Phase 3 completion)
**Depends on:** P3.S1 (Blame query and endpoint working)
**Exit criterion:** Log endpoint returns chronologically ordered entries. Integration tests verify: A confirmed → superseded by B → blame on B returns both A and B in `priorChain`.

---

## Context

The blame query works against Interpretations (P3.S1). This sub-phase adds the patient log endpoint (chronological timeline) and writes rigorous integration tests — specifically against superseded chains, which is the case that distinguishes this from a flat audit log.

---

## Proposed Changes

### [NEW] src/app/api/patient/[id]/log/route.ts — Patient Log

Per api-spec.md — chronological timeline of all clinical events:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import type { LogEntry } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const result = await withSession(async (session) => {
    return session.run(
      `MATCH (p:Patient {id: $id})
       OPTIONAL MATCH (p)-[:HAS_FACT]->(f:Fact)
       WITH p, collect({
         type: 'fact',
         timestamp: f.recordedAt,
         nodeId: f.id,
         summary: f.type + ': ' + f.value
       }) AS factEntries
       OPTIONAL MATCH (f2:Fact)-[:SUPPORTS]->(i:Interpretation {patientId: $id})
       WITH p, factEntries, collect(DISTINCT {
         type: 'interpretation',
         timestamp: i.createdAt,
         nodeId: i.id,
         summary: i.summary + ' [' + i.status + ']'
       }) AS interpEntries
       RETURN factEntries + interpEntries AS entries`,
      { id },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const entries: LogEntry[] = record.get('entries')
    .filter((e: any) => e.nodeId !== null) // filter out null entries from OPTIONAL MATCH
    .sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  return NextResponse.json(entries);
}
```

**Note:** Decision entries will be added to this query in P4.S3 when the Decision node exists.

### [NEW] Integration Tests — Superseded Chain Verification

These are the critical tests from testing.md that specifically catch the bugs in codeexamples.md:

```typescript
// src/app/api/__tests__/blame-chain.integration.test.ts

describe('Blame against superseded chains', () => {
  it('returns both A and B when A was superseded by B', async () => {
    // 1. Create patient, doctor, facts
    // 2. Create Interpretation A → confirm it
    // 3. Supersede A with B (A becomes 'Superseded', B gets 'Hypothesis')
    // 4. Run blame on B
    // 5. Assert priorChain contains A
    // This is the test that catches the flipped SUPERSEDES direction (codeexamples.md #4)
  });

  it('returns full chain when A → superseded by B → superseded by C', async () => {
    // Three-deep chain: blame on C should return both B and A
  });

  it('returns empty priorChain for an interpretation with no supersede history', async () => {
    // Simple case — no chain
  });

  it('blame returns supporting facts for the targeted interpretation', async () => {
    // Verify facts are linked correctly
  });

  it('blame returns the authoring doctor', async () => {
    // Verify AUTHORED_BY link
  });
});

describe('Patient log', () => {
  it('returns entries in chronological order', async () => {
    // Create facts and interpretations with known timestamps
    // Verify ordering
  });

  it('includes all node types', async () => {
    // Verify both 'fact' and 'interpretation' types appear
  });

  it('returns 404 for nonexistent patient', async () => { /* ... */ });
});
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/api/patient/[id]/log/route.ts` | Patient log timeline |
| NEW | `src/app/api/__tests__/blame-chain.integration.test.ts` | Superseded chain tests |

---

## Verification

```bash
# Patient log
curl http://localhost:3000/api/patient/<id>/log
# Expected: chronologically ordered entries

# Blame against superseded chain:
# 1. Create interpretation A → confirm → supersede with B
# 2. blame on B
curl http://localhost:3000/api/blame/<B-id>
# Expected: priorChain includes A

npm run test:integration
```

**Phase 3 is complete when all integration tests pass, particularly the superseded-chain blame tests.**
