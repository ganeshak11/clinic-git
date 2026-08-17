# Agent Instructions

Read this before touching code. This file exists because context resets between sessions — the invariants below have already been violated once each in early drafts of this project (see `practice/codeexamples.md` for the exact bugs). Don't reintroduce them.

## What this project is

One sentence: a graph-native system tracking clinical hypotheses, evidence, decisions, and retractions — see `docs/product/prd.md` for the full picture, but don't re-read it every session unless you're touching product scope.

## Current status

The project is built in **7 phases (0–6)**, each broken into **sub-phases** with individual exit criteria. See `docs/planning/phases.md` for the full breakdown and `docs/planning/TODO.md` for concrete tasks.

Each sub-phase has a **detailed implementation plan** in `docs/plans/implementation_plan_p{phase}_s{sub}.md` — read the relevant plan before starting work on any sub-phase. These plans specify exact files to create/modify, code patterns, invariant cross-references, and verification steps.

**Sub-phase summary (19 total):**

| Phase | Sub-phases | Scope |
|-------|-----------|-------|
| **0 — Setup** | S1 Scaffolding, S2 Neo4j + Tests | Next.js + Neo4j connection |
| **1 — Facts & Interpretations** | S1 Types/Guards, S2 Schema/Facts, S3 Interpretation, S4 Transitions | Core data model |
| **2 — Branching** | S1 Branch Create, S2 Branch Resolve | Differentiator feature |
| **3 — Blame** | S1 Blame Query, S2 Log + Tests | Reasoning-chain trace |
| **4 — Decisions** | S1 Decision Create, S2 Transitions/Perms, S3 Blame Retarget | Decision lifecycle |
| **5 — UI** | S1 Design System, S2 Patient View, S3 Branch View, S4 Log/Blame | Frontend |
| **6 — Demo Prep** | S1 Seed Script, S2 Rehearsal | Demo readiness |

## Non-negotiable invariants

These are architectural decisions, not style preferences. Violating any of them is a correctness bug even if the code compiles and the happy-path test passes.

1. **Facts are immutable.** No update or delete endpoint for `Fact` nodes, ever. If a fact was recorded wrong, that's a data-entry correction handled outside this system's model — not a feature to build here.
2. **Interpretation and Decision status transitions must go through the guard function**, never set directly. Valid transitions only: `Hypothesis → Confirmed/RuledOut`, `Confirmed → Retracted/Superseded` (same shape for `Decision`, starting from `Active`). Same-state transitions (`X → X`) are invalid, not a no-op.
3. **`SUPERSEDES` points from newer to older**: `(newerInterpretation)-[:SUPERSEDES]->(olderInterpretation)`. The blame query walks this direction to find what a current interpretation replaced. Get this backwards and blame silently returns incomplete chains — it won't error, it'll just be wrong. Always test blame against a genuinely superseded chain, not just a fresh interpretation.
4. **Retract requires the author-or-supervisor check**, every time, on both `Interpretation` and `Decision`. No fallback `return true`. See `docs/engineering/security.md`.
5. **All Cypher is parameterized.** Never string-interpolate a value into a query, including IDs. This is both a security rule (injection) and a correctness rule (type coercion bugs hide in string interpolation).
6. **One database. Neo4j only.** No Postgres, no dual-write. See `docs/architecture/adr/0001-single-database-neo4j.md` before proposing otherwise.
7. **Status fields are union types, never bare `string`.** `'Confirmed' | 'RuledOut' | ...`, not `string` with the valid values left in a comment.
8. **Every Neo4j session is closed in a `finally` block.** No exceptions.

## Doc-sync rule

**Any change to the data model, API contract, or permission logic must update the corresponding doc in the same commit** — `docs/architecture/architecture.md`, `docs/architecture/api-spec.md`, or `docs/engineering/security.md` respectively. An AI agent will not otherwise notice docs have drifted from code, and nothing else will catch it either.

## Phase completion rule

**After completing each sub-phase, write a detailed description of what was built, what was tested, and what the exit criterion result was.** Update these two places:

1. **`CHANGELOG.md`** — Add a dated entry under the appropriate phase/sub-phase section with:
   - What was added/changed
   - Which invariants were verified
   - Exit criterion pass/fail result
   - Any bugs found and fixed during the sub-phase

2. **`docs/planning/TODO.md`** — Mark completed tasks with `[x]` and add a brief completion note below each sub-phase section:
   ```
   **Completed:** YYYY-MM-DD — [one-sentence summary of what shipped and what was verified]
   ```

3. **Version & Commit** — We have automated the versioning process. Run `./version.sh` in the terminal to automatically bump the version in `package.json`, commit the code, tag the release (e.g., `v1.2.0`), and push both the commit and tag to GitHub. You will be prompted to enter the new version and commit message interactively.

This post-completion write-up is not optional — it's how the next agent session (or a different agent) picks up context without re-reading all the code. If a sub-phase is done but has no write-up, the next session will waste time figuring out what was already built.

## Run / test

```bash
docker compose up -d                # Neo4j via docker-compose.yml
npm run dev                         # app at localhost:3000
npm run test                        # unit tests — pure logic, no DB needed
npm run test:integration            # requires the Neo4j container running
```

Full command list and per-sub-phase setup: `docs/planning/TODO.md`.

## Where things live

```
docs/plans/                   — implementation plans per sub-phase (read before starting work)
docs/planning/phases.md       — phase/sub-phase definitions with exit criteria
docs/planning/TODO.md         — concrete tasks, marked complete as work progresses

src/lib/neo4j.ts              — driver singleton, session helper (withSession)
src/lib/types.ts              — all domain types, status union types
src/lib/transitions.ts        — status transition guards (Interpretation + Decision)
src/lib/permissions.ts        — retract permission check (canRetract)
src/lib/schema.ts             — Cypher constraint definitions
src/lib/ids.ts                — ID generation helper
src/lib/constants.ts          — status colors, UI constants
src/lib/api.ts                — client-side API helpers (Phase 5+)

src/app/api/                  — route handlers, one per endpoint in api-spec.md
src/app/api/health/           — connection health check (Phase 0 exit criterion)
src/app/api/patient/          — patient CRUD
src/app/api/fact/             — fact creation (no update/delete — invariant #1)
src/app/api/interpretation/   — interpretation CRUD + status transitions
src/app/api/branch/           — branch creation + resolve
src/app/api/decision/         — decision CRUD + status transitions
src/app/api/blame/            — blame query endpoint
src/app/api/schema/           — one-time schema setup

src/components/               — UI components, Phase 5 only
src/app/patients/             — patient list + detail pages (Phase 5)
src/app/branches/             — branch list + graph view (Phase 5)
src/app/blame/                — blame chain visualization (Phase 5)

scripts/seed.ts               — demo data seeder (Phase 6)
scripts/clear.ts              — database clear utility (Phase 6)
```

## What NOT to build

Outcome/population analytics, GraphRAG, full-text search, an RBAC framework, an object-storage abstraction layer. These are permanently deferred (`docs/product/prd.md` §3, §11), not "later phases" — don't scope work toward them even if a task seems to be heading that direction.

## Before starting any task

1. **Read the implementation plan** for the sub-phase you're working on: `docs/plans/implementation_plan_p{phase}_s{sub}.md`. This has the exact files, code patterns, and verification steps.
2. **Check the dependency** — each sub-phase plan lists what it depends on. Don't start P1.S3 if P1.S2 hasn't passed its exit criterion.
3. Check `docs/planning/TODO.md` for what's already completed — look for `[x]` marks and completion notes.
4. If the task touches an invariant above, re-read the relevant ADR in `docs/architecture/adr/` first.
5. **After finishing**, write the completion description in `CHANGELOG.md` and mark tasks done in `TODO.md` (see Phase completion rule above).

## Known bug patterns (from practice/codeexamples.md)

These 10 bugs have already been identified and each sub-phase plan specifies how it prevents the relevant ones. Quick reference:

| # | Bug | Caught by |
|---|-----|-----------|
| 1 | Same-state transition allowed (`\|\| from === to`) | P1.S1 — no self-transition in guard |
| 2 | Session leak (no `finally` close) | P0.S2 — `withSession` helper |
| 3 | ID type mismatch (`number` vs `string`) | P1.S1 — all IDs `string` |
| 4 | SUPERSEDES direction flipped | P3.S1 — `(i)-[:SUPERSEDES*0..5]->(prior)` |
| 5 | Permission fallthrough (`return true`) | P1.S1 — single boolean expression |
| 6 | Missing `await` | P0.S1 — `strict: true` in tsconfig |
| 7 | Bare `string` status field | P1.S1 — union types |
| 8 | Retracted = Superseded color | P5.S1 — distinct colors (red ≠ amber) |
| 9 | Fact update endpoint exists | P1.S2 — no PATCH/PUT/DELETE handler |
| 10 | Unbounded traversal (`*` with no cap) | P3.S1 — `*0..5` bounded path |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
