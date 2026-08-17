# Bug-Finding Practice: ClinicalGit Code Examples

Ten snippets, all strongly-typed TypeScript pulled from the shape of the ClinicalGit backend (status transitions, Cypher builders, session handling, permission checks). Every snippet has exactly one planted bug. Some are logic bugs a type checker will never catch; a few are places where *weak* typing is itself the bug, and tightening the types would have caught it.

**How to use this:** read the code, form a hypothesis about the bug before expanding the answer. Most of these won't throw — they'll silently do the wrong thing, which is the harder (and more realistic) case.

---

## 1. Status transition guard

```typescript
type InterpretationStatus = 'Hypothesis' | 'Confirmed' | 'RuledOut' | 'Retracted' | 'Superseded';

function canTransition(from: InterpretationStatus, to: InterpretationStatus): boolean {
  const validTransitions: Record<InterpretationStatus, InterpretationStatus[]> = {
    Hypothesis: ['Confirmed', 'RuledOut'],
    Confirmed: ['Retracted', 'Superseded'],
    RuledOut: [],
    Retracted: [],
    Superseded: [],
  };
  return validTransitions[from].includes(to) || from === to;
}
```

<details><summary>Answer</summary>

`|| from === to` makes every status a no-op "valid" transition to itself — including `RuledOut → RuledOut` and `Retracted → Retracted`. That sounds harmless until you notice it means the retract endpoint will happily "retract" an already-retracted interpretation and return success, silently swallowing the double-retraction case that PRD §8's permission model assumes gets rejected. The fix is to drop the `|| from === to` entirely and let same-state calls fail the transition check like any other invalid one.

</details>

---

## 2. Neo4j session handling

```typescript
async function getPatientFacts(patientId: string): Promise<Fact[]> {
  const session = driver.session();
  const result = await session.run(
    'MATCH (p:Patient {id: $id})-[:HAS_FACT]->(f:Fact) RETURN f',
    { id: patientId }
  );
  return result.records.map(r => r.get('f').properties as Fact);
}
```

<details><summary>Answer</summary>

`session.close()` is never called. Every call to this function leaks a session; under demo load (or just a reviewer clicking around for five minutes) you'll exhaust the driver's connection pool and start seeing timeouts with no obvious cause. Needs a `try { ... } finally { await session.close(); }` wrapper — and this bug is easy to miss precisely because the happy path works perfectly in every manual test.

</details>

---

## 3. Branch resolve — ID comparison

```typescript
interface ResolveBranchInput {
  branchId: string;
  confirmedInterpretationId: number;
}

function buildResolveQuery(input: ResolveBranchInput): string {
  return `
    MATCH (b:Branch {id: '${input.branchId}'})<-[:BELONGS_TO]-(i:Interpretation)
    SET i.status = CASE WHEN i.id = ${input.confirmedInterpretationId} THEN 'Confirmed' ELSE 'RuledOut' END
    SET b.status = 'Closed'
  `;
}
```

<details><summary>Answer</summary>

Two bugs stacked here, but the planted one is the type mismatch: `confirmedInterpretationId` is typed `number`, but every other ID in the schema (Patient, Fact, Branch) is a `string`. If interpretation IDs are actually generated as strings (e.g. UUIDs, as they should be for consistency with the rest of the model), `i.id = ${input.confirmedInterpretationId}` compares a string property to an interpolated number literal and never matches — every interpretation silently becomes `RuledOut`, including the one meant to be confirmed. Fixing the type to `string` end-to-end would have surfaced this at the call site instead of at demo time. (The second bug — raw string interpolation into Cypher instead of parameterized queries — is a real injection risk too, but the ID-type mismatch is the one that actually breaks the merge/close feature.)

</details>

---

## 4. Blame — supersede-chain walk

```typescript
async function getBlameChain(decisionId: string): Promise<BlameResult> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (d:Decision {id: $id})-[:BASED_ON]->(i:Interpretation)
       OPTIONAL MATCH (i)<-[:SUPERSEDES*0..]-(prior:Interpretation)
       MATCH (f:Fact)-[:SUPPORTS]->(i)
       MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
       RETURN d, i, collect(prior) AS priorChain, collect(f) AS facts, doc`,
      { id: decisionId }
    );
    return parseBlameResult(result.records[0]);
  } finally {
    await session.close();
  }
}
```

<details><summary>Answer</summary>

The arrow direction on the `SUPERSEDES` walk is flipped. The schema is `(newer)-[:SUPERSEDES]->(older)` — a new interpretation points *at* the one it replaces. Walking `(i)<-[:SUPERSEDES]-(prior)` therefore looks for interpretations that supersede `i`, i.e. anything *newer* than the current one — the opposite of what blame needs, which is to walk backward to what `i` itself superseded. Against a decision based on the *current* (non-superseded) interpretation, this returns an empty `priorChain` and looks correct in the simple case — exactly the scenario flagged in architecture.md as needing a specific test against a genuinely superseded chain, not just the happy path.

</details>

---

## 5. Permission check on retract

```typescript
interface RetractRequest {
  interpretationId: string;
  requestingUserId: string;
  reason: string;
}

function canRetract(node: Interpretation, req: RetractRequest, requestorIsSupervisor: boolean): boolean {
  if (node.status !== 'Confirmed') return false;
  if (node.authorId === req.requestingUserId) return true;
  if (requestorIsSupervisor) return true;
  return true;
}
```

<details><summary>Answer</summary>

The final `return true;` is unreachable dead code that also happens to be the actual bug: it means *any* request reaches `true` regardless of authorship or supervisor status, because there's no `else` — the two prior `return true` branches only short-circuit the true cases, but any request that fails both checks still falls through to the last line and returns `true` anyway. The whole permission model from architecture.md §3 is silently bypassed. Should be `return false;` at the end (or, more robustly, `return node.authorId === req.requestingUserId || requestorIsSupervisor;` as a single expression with no trailing fallback).

</details>

---

## 6. Missing await

```typescript
async function createInterpretation(input: NewInterpretationInput): Promise<Interpretation> {
  const session = driver.session();
  try {
    const result = session.run(
      `CREATE (i:Interpretation {id: $id, status: 'Hypothesis', summary: $summary})
       RETURN i`,
      { id: input.id, summary: input.summary }
    );
    return result.records[0].get('i').properties as Interpretation;
  } finally {
    await session.close();
  }
}
```

<details><summary>Answer</summary>

`session.run(...)` is missing `await`. `result` is a `Promise<QueryResult>`, not a `QueryResult`, so `result.records` is `undefined` and the function throws `Cannot read properties of undefined (reading '0')` on the very next line. TypeScript's inferred type for `result` would actually be `Promise<QueryResult>` here, and `.records` on a `Promise` is a type error — so with `strict` mode and no `any` escape hatches, this one *should* be caught at compile time. If it wasn't caught, check whether `noImplicitAny`/strict promise checking is actually enabled in `tsconfig.json` — the type system only protects you if you've turned the strictness on.

</details>

---

## 7. Status as a bare string

```typescript
interface Decision {
  id: string;
  status: string; // 'Active' | 'Retracted' | 'Superseded'
  interpretationId: string;
}

function retractDecision(decision: Decision): Decision {
  return { ...decision, status: 'Retracted' };
}

function isActive(decision: Decision): boolean {
  return decision.status === 'Active';
}

// elsewhere in the codebase, written by someone in a hurry:
function reactivate(decision: Decision): Decision {
  return { ...decision, status: 'Actve' };
}
```

<details><summary>Answer</summary>

`status: string` with the valid values only noted in a comment is the actual bug — not the typo itself, but the type that allowed the typo to compile. `'Actve'` is a plain string, so TypeScript accepts it without complaint, and `isActive()` will return `false` for a decision that was just "reactivated," because `'Actve' !== 'Active'`. Changing `status` to the union type `'Active' | 'Retracted' | 'Superseded'` (as done correctly in Exercise 1's `InterpretationStatus`) would make `'Actve'` a compile error instead of a silent runtime bug. This is the clearest example in this set of weak typing itself being the vulnerability.

</details>

---

## 8. React status badge

```typescript
type Status = 'Confirmed' | 'RuledOut' | 'Retracted' | 'Superseded' | 'Active';

function badgeColor(status: Status): string {
  switch (status) {
    case 'Confirmed':
    case 'Active':
      return 'green';
    case 'RuledOut':
      return 'gray';
    case 'Retracted':
      return 'red';
    case 'Superseded':
      return 'red';
    default:
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
```

<details><summary>Answer</summary>

Not a crash bug, but a UX/legibility bug flagged in your own todo.md ("status badges consistently styled so a reviewer can read status at a glance"): `Retracted` and `Superseded` both render red, even though PRD §7 treats them as meaningfully different events — one is an error correction, the other is a refinement. A reviewer scanning the demo can't visually distinguish "this diagnosis was wrong" from "this diagnosis was refined" without reading the text, which undercuts the exact distinction the whole facts-vs-interpretations pitch is built on. (The `never`-typed exhaustiveness check at the bottom is correct and good practice — that part isn't the bug, it's what *would* catch you forgetting a case entirely if a new status were added later.)

</details>

---

## 9. Fact immutability

```typescript
// PATCH /api/fact/:id
async function updateFact(factId: string, updates: Partial<Fact>): Promise<Fact> {
  const session = driver.session();
  try {
    const setClauses = Object.keys(updates)
      .map(key => `f.${key} = $${key}`)
      .join(', ');
    const result = await session.run(
      `MATCH (f:Fact {id: $factId}) SET ${setClauses} RETURN f`,
      { factId, ...updates }
    );
    return result.records[0].get('f').properties as Fact;
  } finally {
    await session.close();
  }
}
```

<details><summary>Answer</summary>

This endpoint shouldn't exist at all. Facts are defined in prd.md §5 and architecture.md §2.3 as immutable by design — "never edited or deleted" — and this function is a generic PATCH that lets any field on a Fact be silently rewritten. This isn't a coding-style bug, it's an architectural invariant violated in code: the moment this route ships, a reviewer who reads your own PRD and then tests `PATCH /api/fact/:id` against your API will find the exact gap between what you claimed and what you built. Facts should have no update endpoint at all — only creation.

</details>

---

## 10. Unbounded variable-length traversal

```typescript
const BLAME_QUERY = `
  MATCH (d:Decision {id: $id})-[:BASED_ON]->(i:Interpretation)
  OPTIONAL MATCH (i)-[:SUPERSEDES*]->(prior:Interpretation)
  MATCH (f:Fact)-[:SUPPORTS]->(i)
  MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
  RETURN d, i, collect(prior) AS priorChain, collect(f) AS facts, doc
`;
```

<details><summary>Answer</summary>

`[:SUPERSEDES*]` with no bounds is a variable-length path with no upper limit — on a deep enough supersede chain (or, worse, if bad data ever produces a cycle, which nothing in this schema currently prevents at the database level) this can become a very expensive or non-terminating traversal. The version in architecture.md §4 specifies `[:SUPERSEDES*0..]` — the `0` lower bound is what allows an interpretation with *no* supersede history to still match (returning zero prior nodes instead of failing the whole `OPTIONAL MATCH`), but it still has no upper bound either. For a demo this is unlikely to bite you given how few supersede-hops you'll seed, but it's worth capping explicitly (`*0..5`, say) rather than relying on your data staying small by accident.

</details>

---

## Pattern across all ten

Roughly half of these (2, 5, 6, 9) are logic/process bugs that better types can't fully save you from — session lifecycle, control flow, and architectural invariants have to be gotten right by reasoning, not by the compiler. The other half (3, 7, and arguably 1) are cases where a *looser* type than necessary (`number` where it should be `string`, `string` where it should be a union, an `||` clause that shouldn't exist) is what let the bug through in the first place. Worth scanning your actual codebase for anywhere a type is wider than the values it should ever hold — that's usually where the next one of these is hiding.
