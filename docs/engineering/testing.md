# Testing Strategy: ClinicalGit

The point of this doc isn't "write tests" — it's the specific cases that must be tested, because several of them are exactly the bugs already identified as likely in `docs/practice/codeexamples.md`. A naive happy-path test suite will pass while several of these are silently broken.

## Layers

**Unit tests** — pure logic, no database required, fast:
- `canTransition()` (status guard) — every valid transition, and explicitly every *invalid* one, including same-state (`Confirmed → Confirmed` must be rejected, not treated as a no-op).
- `canRetract()` (permission check) — author, supervisor, and neither — all three cases, not just the success case.
- Cypher query *builders*, where queries are constructed from input (test that parameters are passed as query params, never interpolated into the query string).

**Integration tests** — against a real, ephemeral Neo4j instance (Testcontainers, or a docker-compose test service spun up in CI), hitting actual API routes:
- Full lifecycle: create fact → create interpretation citing it → confirm → retract with reason.
- Branch resolve: create a branch with 3 competing interpretations, resolve one, assert the other two are `RuledOut` and still queryable (not deleted).
- Blame against a **superseded chain**, not just a fresh interpretation — this is the case that would have caught the flipped `SUPERSEDES` direction bug. Create A, supersede it with B, create a decision based on B, run blame, assert both A and B appear in `priorChain`.
- Fact immutability: assert no route exists to update or delete a Fact (`PATCH /api/fact/:id` should 404/405, not silently succeed).
- Double-action rejection: retracting an already-retracted node, resolving an already-closed branch — both should return `409`, not silently succeed.

## Tools

- **Vitest** (or Jest) for unit tests.
- **Testcontainers (Neo4j module)** for integration tests, or a `docker-compose.test.yml` spinning up a throwaway Neo4j instance if Testcontainers adds too much setup overhead for the timeframe.
- Next.js's built-in route handler testing (or `supertest` against a running dev server) for hitting API routes directly.

## What "done" means for a PR

A PR that touches the data model, a status transition, or a permission check is not done until:
1. The specific edge case it affects is covered by a test that would fail without the fix (write the failing test first if you're fixing a bug).
2. If it's one of the cases listed above, that test is not skipped or left as a TODO.

## What's explicitly not required for MVP

End-to-end browser tests (Playwright/Cypress) — the manual demo rehearsal in `docs/planning/todo.md` Phase 6 covers this instead. Load testing. Multi-user concurrency testing — out of scope per the non-goals in the PRD.
