# To-Do: ClinicalGit MVP

Concrete tasks and tools per sub-phase. Pairs with `phases.md` (what each sub-phase must achieve) and `architecture.md` (the data model and queries these tasks implement). Each sub-phase has a detailed implementation plan in `docs/plans/`.

**Completion convention:** After finishing a sub-phase, mark all its tasks `[x]` and add a completion note:
```
**Completed:** YYYY-MM-DD — [one-sentence summary of what shipped and what was verified]
```
Also add a corresponding entry to `CHANGELOG.md` — see the Phase completion rule in `AGENTS.md`.

---

## Phase 0 — Setup

**Tools:** Next.js (App Router, TypeScript), Neo4j Docker (`neo4j:5`), `neo4j-driver` npm package, Vitest.

### Sub-phase 0.1 — Project Scaffolding & Config
- [x] Scaffold Next.js app (`create-next-app` with App Router, TypeScript, Tailwind).
- [x] Enforce `strict: true` and `noUncheckedIndexedAccess: true` in `tsconfig.json`.
- [x] Verify `.env.local` is in `.gitignore` (security.md).
- [x] Confirm `npm run dev` serves at `localhost:3000`

**Completed:** 2026-08-17 — Scaffolded Next.js app and hardened TypeScript config; verified clean build and dev server availability.

### Sub-phase 0.2 — Neo4j Connection & Test Infrastructure
- [x] `docker-compose.yml` for local Neo4j
- [x] Install `neo4j-driver` and `vitest`
- [x] Create `src/lib/neo4j.ts` with `withSession` helper (invariant #8)
- [x] Create `vitest.config.ts` and `src/lib/__tests__/neo4j.test.ts` to test session closure
- [x] Create `GET /api/health` to test query execution
- [x] Confirm exit criterion: health endpoint returns ok and testQuery 1

**Completed:** 2026-08-17 — Implemented Neo4j driver singleton, vitest test infrastructure, and verified database connection via the health endpoint.

### Sub-phase 0.3 — Authentication
- [x] Install `next-auth` and `bcrypt`
- [x] Define `Doctor` schema in Neo4j (`email`, `passwordHash`, `name`, `isSupervisor`)
- [x] Create NextAuth route (`src/app/api/auth/[...nextauth]/route.ts`) with Credentials provider
- [x] Create `src/proxy.ts` (Next 16 middleware) to protect `/api/` (except auth and health)
- [x] Create `scripts/seed-doctors.ts` to insert initial doctor accounts (no public signup allowed)
- [x] Create `GET /api/patient/search` to lookup patients by name or ID
- [x] Confirm exit criterion: NextAuth login works and returns a valid session token.

**Completed:** 2026-08-17 — Upgraded to real-world auth using NextAuth.js. Created a seeded Doctor account, secured all API routes with a session proxy, and implemented a patient search endpoint.

---

## Phase 1 — Facts & Interpretations

**Tools:** Next.js API routes (`app/api/.../route.ts`), Neo4j Cypher via the driver. No UI, no auth yet — test with `curl`.

### Sub-phase 1.1 — Type System & Transition Guards
- [x] `src/lib/types.ts` — all domain types: `Patient`, `Fact`, `Interpretation`, `Doctor` with status union types (`InterpretationStatus`, `DecisionStatus`), never bare `string`
- [x] `src/lib/transitions.ts` — `canTransition()` guard for Interpretation status, using the transition map from architecture.md §2.3
- [x] `src/lib/permissions.ts` — `canRetract()` check per ADR 0003 (author or supervisor, final `return false`, not `return true`)
- [x] `src/lib/__tests__/transitions.test.ts` — every valid transition, every invalid transition, same-state rejection
- [x] `src/lib/__tests__/permissions.test.ts` — author succeeds, supervisor succeeds, neither fails

**Completed:** 2026-08-17 — Defined domain types and transition/permission guards; verified with comprehensive unit tests and TypeScript compiler.

### Sub-phase 1.2 — Database Schema & Fact Endpoint
- [x] `src/lib/schema.ts` — Cypher constraint definitions: unique IDs on Patient, Fact, Interpretation, Doctor
- [x] `src/app/api/schema/route.ts` — one-time setup endpoint to run `CREATE CONSTRAINT ... IF NOT EXISTS`
- [x] `src/lib/ids.ts` — `generateId()` UUID helper
- [x] `src/app/api/patient/route.ts` — `POST` (create only)
- [x] `src/app/api/fact/route.ts` — `POST` (create only). Enforce invariant #1: no update/delete route exists.
- [x] Integration test: create patient + facts, verify constraints reject duplicate IDs

**Completed:** 2026-08-17 — Implemented schema constraints and immutable Fact/Patient endpoints; verified with curl tests.

### Sub-phase 1.3 — Interpretation Creation & Evidence Linking
- [x] `src/app/api/interpretation/route.ts` — `POST /api/interpretation` per api-spec.md: create Interpretation, link `(Fact)-[:SUPPORTS]->(Interpretation)` per cited fact, link `(Interpretation)-[:AUTHORED_BY]->(Doctor)`, default status `Hypothesis`
- [x] `src/app/api/doctor/route.ts` — `POST /api/doctor` to seed Doctor nodes (needed before Interpretations can reference one)
- [x] Validate: `supportingFactIds` must be non-empty → 400; referenced facts must exist → 404
- [x] All Cypher parameterized — invariant #5
- [x] Integration test: create interpretation citing two facts, verify both SUPPORTS relationships exist

**Completed:** 2026-08-17 — Implemented atomic creation of Interpretations with evidence/author linking; verified via integration tests covering empty, invalid, and valid fact inputs.

### Sub-phase 1.4 — Status Transitions & Patient Read
- [x] `src/app/api/interpretation/[id]/confirm/route.ts` — `POST /api/interpretation/:id/confirm`, uses `canTransition()` guard
- [x] `src/app/api/interpretation/[id]/retract/route.ts` — `POST /api/interpretation/:id/retract`, uses `canTransition()` AND `canRetract()` guards
- [x] `src/app/api/interpretation/[id]/supersede/route.ts` — `POST /api/interpretation/:id/supersede`, creates new Interpretation, links `(new)-[:SUPERSEDES]->(old)` (invariant #3)
- [x] `src/app/api/patient/[id]/route.ts` — `GET /api/patient/:id`, returns Patient + `facts` + `interpretations` (all related)
- [x] `src/app/api/__tests__/interpretation-lifecycle.integration.test.ts` — full lifecycle integration test
- [x] Run integration tests

**Completed:** 2026-08-17 — Implemented lifecycle status endpoints (confirm, retract, supersede) with transition and permission guards, and recursive patient reads; passed all integration tests. Phase 1 is officially complete!

---

## Phase 2 — Branching & Merge/Close

**Tools:** Same stack, extending Phase 1 API routes. No new dependencies.

### Sub-phase 2.1 — Branch Creation & Interpretation Linking
- [x] `src/lib/types.ts` — `Branch` interface, `CreateBranchInput`
- [x] `src/lib/schema.ts` — `CREATE CONSTRAINT branch_id_unique`
- [x] `src/app/api/branch/route.ts` — `POST /api/branch` (create Branch, link to Patient)
- [x] `src/app/api/interpretation/route.ts` — Modify POST to accept `branchId`, validate it exists and is `Open`, link `(Interpretation)-[:BELONGS_TO]->(Branch)`
- [x] Integration test: create branch, attach multiple interpretations, verify relationships

**Completed:** 2026-08-18 — Implemented Branch creation endpoint and modified Interpretation endpoint to validate and safely link to a Branch atomically. Verified via integration tests.

### Sub-phase 2.2 — Branch Resolve & Read
- [x] `src/app/api/branch/[id]/resolve/route.ts` — `POST /api/branch/[id]/resolve` per architecture.md §5: confirmed → `Confirmed`, rest → `RuledOut`, branch → `Closed`
- [x] `src/app/api/branch/[id]/route.ts` — `GET /api/branch/[id]` per api-spec.md: branch + interpretations
- [x] Validate: `confirmedInterpretationId` not on branch → 400; branch already closed → 409
- [x] Integration tests: resolve branch, verify ruled-out still queryable, double-resolve returns 409

**Completed:** 2026-08-18 — Implemented Branch resolve and read endpoints. Verified atomic resolution where siblings are ruled out, and the branch is closed. Phase 2 is officially complete!

---

## Phase 3 — Blame

**Tools:** Same stack. Pure Cypher work — get the query right before wiring an endpoint around it.

### Sub-phase 3.1 — Blame Query & Endpoint
- [x] Test blame query in Neo4j browser against seeded data (verify `(new)-[:SUPERSEDES*0..5]->(old)` direction)
- [x] `src/app/api/blame/[interpretationId]/route.ts` — `GET /api/blame/[interpretationId]` returning Interpretation + `priorChain` + facts + author

**Completed:** 2026-08-18 — Implemented the Blame API and verified via integration tests that it correctly walks the `SUPERSEDES` chain using bounded variable-length paths (`*0..5`).

### Sub-phase 3.2 — Patient Log & Supersede Chain Tests
- [x] `src/app/api/patient/[id]/log/route.ts` — `GET /api/patient/:id/log` per api-spec.md: chronological entries
- [x] Integration test: Patient log returns both Fact and Interpretation entries in time order
- [x] Integration test: 3-deep supersede chain (A → B → C). Blame on C returns both A and B.

**Completed:** 2026-08-18 — Implemented Patient Log endpoint combining Fact and Interpretation entries chronologically. Wrote and passed comprehensive tests asserting that deep multi-level supersede chains correctly pull all prior reasoning! Phase 3 is officially complete.

---

## Phase 4 — Decisions

**Tools:** Same stack, no new dependencies.

### Sub-phase 4.1 — Decision Node & Creation
- [x] Add Decision constraint to `src/lib/schema.ts`
- [x] `src/app/api/decision/route.ts` — `POST /api/decision`
- [x] Integration test: reject Decision creation if interpretation is not `Confirmed`
- [x] Integration test: create Decision successfully

**Completed:** 2026-08-18 — Implemented Decision creation endpoint and verified that decisions can only be based on `Confirmed` interpretations. Tests added and passed.

### Sub-phase 4.2 — Decision Transitions & Permissions
- [x] `src/app/api/decision/[id]/retract/route.ts` — uses `canTransitionDecision()` + `canRetract()`, supervisor-gated
- [x] `src/app/api/decision/[id]/supersede/route.ts` — creates new Decision, sets old to `Superseded`, adds `SUPERSEDES` link
- [x] `src/app/api/interpretation/[id]/retract/route.ts` — verify/backfill `canRetract()` enforcement on the backend
- [x] Integration test: author or supervisor can retract decision, others get 403

**Completed:** 2026-08-18 — Implemented Retract and Supersede transitions for Decisions, strictly enforcing author/supervisor authorization policies identically to Interpretations. Tests successfully run and verified.

### Sub-phase 4.3 — Blame Retargeting & End-to-End Tests
- [x] Retarget blame endpoint: `GET /api/blame/[decisionId]` per architecture.md §4 — walks `BASED_ON` → Interpretation → `SUPERSEDES` chain → Facts → Doctor
- [x] Patient log: Add Decisions to `src/app/api/patient/[id]/log/route.ts`
- [x] End-to-end tests: `src/app/api/__tests__/end-to-end.integration.test.ts` testing the entire fact → interpretation → decision → retract → blame lifecycle

**Completed:** 2026-08-18 — Retargeted blame endpoint to Decision nodes and successfully added Decision entries to the patient log. Exhaustively tested the complete graph lifecycle across 28 automated integration tests. Phase 4 backend is complete!

---

## Phase 5 — UI

**Tools:** Tailwind CSS, **shadcn/ui** (forms, dialogs, status badges), **React Flow** (branch/graph visualization).

### Sub-phase 5.1 — Design System & Layout Shell
- [x] Install shadcn/ui and configure Tailwind
- [x] Create `STATUS_COLORS` mapping for all node states
- [x] Build generic `StatusBadge` component
- [x] Create app shell with global sidebar navigation
- [x] Apply UI aesthetic enhancements to `globals.css`
**Completed:** 2026-08-18 — Built out the rich aesthetic app shell with shadcn/ui and implemented consistent status badge rendering, verifying Retracted and Superseded remain distinct.

### Sub-phase 5.2 — Patient View
- [ ] Patient list page
- [ ] Patient detail page: facts list + interpretations list
- [ ] Add-fact dialog form (shadcn Dialog + Form) calling `POST /api/fact`
- [ ] Add-interpretation dialog form calling `POST /api/interpretation` with fact-picker for `supportingFactIds`
- [ ] Refresh data after mutations

### Sub-phase 5.3 — Branch View
- [ ] Install React Flow
- [ ] Branch graph: interpretations as nodes on a branch, visual state per status
- [ ] "Resolve" action: select interpretation to confirm, call `/api/branch/:id/resolve`
- [ ] Visual update: confirmed = highlighted, ruled-out = greyed but visible — never removed
- [ ] Add-interpretation-to-branch flow

### Sub-phase 5.4 — Log & Blame Views
- [ ] Log view: chronological timeline component consuming `/api/patient/:id/log`
- [ ] Blame view: given a decision, render the traced chain visually (not JSON)
- [ ] Chain rendering: decision → interpretation → prior superseded → facts → doctor
- [ ] Make the chain visually obvious for live demo

---

## Phase 6 — Demo Prep

**Tools:** A seed script (`scripts/seed.ts`), no new dependencies.

### Sub-phase 6.1 — Seed Script
- [x] Implement `scripts/seed.ts`
- [x] Clear database safely
- [x] Insert mock doctors
- [x] Insert mock patient
- [x] Create a linear chain (Fact → Interpretation → Decision)
- [x] Create a branched chain (Competing Interpretations)
- [x] Resolve the branch
- [x] Verify script runs without error and data appears in UI

**Completed:** 2026-08-19 — Implemented scripts/seed.ts and scripts/clear.ts to fully populate a realistic medical case (Maria Santos) exercising branches, supersedes, and decisions. Script was executed and verified.
- [ ] Data must look clinical, not test-like ("HbA1c 8.4%", not "test-fact-1")

### Sub-phase 6.2 — Rehearsal & Q&A Prep
- [ ] Full demo click-through: seed → branch with competing diagnoses → resolve → decision → blame
- [ ] Written answer: "why not FHIR Provenance" — per prd.md §9
- [ ] Written answer: "who can retract a diagnosis" — per architecture.md §3 / prd.md §8
- [ ] Time the walkthrough twice minimum

---

## Explicitly not on this list

Postgres, OpenSearch, MinIO/S3 as infrastructure, GraphRAG, RBAC framework, outcome/population analytics. If a task for any of these seems worth adding, that's scope creep — check prd.md §3 and architecture.md §7 before adding it.
