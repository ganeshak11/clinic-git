# Phases: ClinicalGit MVP

Companion to `prd.md` and `architecture.md`. This breaks the locked build order (architecture.md §6) into phases and sub-phases with a clear exit criterion each — a phase isn't "done" until its criterion is demonstrably true, not just "code written."

Seven phases (0–6), broken into 19 sub-phases. Phases 1-4 are backend/data-model only — no UI. This is deliberate: the graph model is the entire value proposition, and building UI before the model is proven risks polishing screens around a data structure that still needs to change.

Each sub-phase has its own implementation plan in `docs/plans/implementation_plan_p{phase}_s{sub}.md`.

---

## Phase 0 — Setup

**Goal:** A running skeleton with the database reachable from the app. Nothing clinical yet.

### Sub-phase 0.1 — Project Scaffolding & Config
**Goal:** A running Next.js app with strict TypeScript, Tailwind, and hardened tsconfig.
**Exit criterion:** `npm run dev` starts without errors and serves a page at `localhost:3000`. `tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true`.
**Plan:** `docs/plans/implementation_plan_p0_s1.md`

### Sub-phase 0.2 — Neo4j Connection & Test Infrastructure
**Goal:** Neo4j driver singleton, `withSession` helper enforcing session-close-in-finally, health endpoint, Vitest setup.
**Exit criterion:** `curl localhost:3000/api/health` returns `{ "status": "ok", "neo4j": "connected", "testQuery": 1 }` with Neo4j running via Docker. `npm run test` passes at least one unit test for the `withSession` helper.
**Plan:** `docs/plans/implementation_plan_p0_s2.md`

### Sub-phase 0.3 — Authentication
**Goal:** NextAuth setup (Credentials provider), Doctor schema, seed script for initial doctor accounts, middleware route protection.
**Exit criterion:** Health endpoint connects to Neo4j. NextAuth session creation succeeds. Middleware protects all `/api` routes except health/auth.
**Plan:** `docs/plans/implementation_plan_p0_s3.md`

---

## Phase 1 — Facts & Interpretations (the foundation)

**Goal:** Implement the two core node types and the immutable/mutable split that the whole pitch rests on — Facts never change, Interpretations carry a status.

This phase is the one place where getting the data model wrong is expensive later — everything else builds on it. Don't move to Phase 2 until this is genuinely solid, not just "seems to work."

### Sub-phase 1.1 — Type System & Transition Guards
**Goal:** All domain types, status union types, `canTransition()` guard, `canRetract()` permission check — pure logic, no database.
**Exit criterion:** Unit tests pass for every valid transition, every invalid transition (including same-state), and every permission check case (author, supervisor, neither). No `any` types, no bare `string` status fields.
**Plan:** `docs/plans/implementation_plan_p1_s1.md`

### Sub-phase 1.2 — Database Schema & Fact Endpoint
**Goal:** Cypher uniqueness constraints on all node types, `POST /api/fact` endpoint creating Facts linked to Patients.
**Exit criterion:** Via `curl`, create a Patient, then create two Facts attached to it. Facts have unique IDs enforced by Neo4j. No update or delete endpoint exists for Facts. Attempting to create a Fact with a duplicate ID returns an error.
**Plan:** `docs/plans/implementation_plan_p1_s2.md`

### Sub-phase 1.3 — Interpretation Creation & Evidence Linking
**Goal:** `POST /api/interpretation` endpoint creating Interpretations linked to supporting Facts and an authoring Doctor.
**Exit criterion:** Via `curl`, create an Interpretation citing two Facts, confirm the `SUPPORTS` and `AUTHORED_BY` relationships exist in Neo4j. Empty `supportingFactIds` returns `400`. Nonexistent fact IDs return `404`.
**Plan:** `docs/plans/implementation_plan_p1_s3.md`

### Sub-phase 1.4 — Status Transitions & Patient Read
**Goal:** Confirm/retract/supersede endpoints for Interpretations, `GET /api/patient/:id` read endpoint, integration tests.
**Exit criterion:** Full lifecycle works via API: create patient → add facts → create interpretation → confirm → retract with reason. Invalid transitions (e.g. `Hypothesis → Superseded`) return `409`. Supersede creates a new Interpretation with `SUPERSEDES` pointing newer → older. `GET /api/patient/:id` returns the patient with all facts and interpretations.
**Plan:** `docs/plans/implementation_plan_p1_s4.md`

---

## Phase 2 — Branching & Merge/Close (the differentiator)

**Goal:** Implement competing diagnostic branches — this is the feature that carries the demo and the one thing FHIR Provenance doesn't model.

### Sub-phase 2.1 — Branch Creation & Interpretation Linking
**Goal:** Branch node type, `POST /api/branch`, modify `POST /api/interpretation` to accept optional `branchId`.
**Exit criterion:** A Branch can be created for a patient. An Interpretation can be created with a `branchId`, creating a `BELONGS_TO` relationship. Multiple Interpretations can belong to the same Branch.
**Plan:** `docs/plans/implementation_plan_p2_s1.md`

### Sub-phase 2.2 — Branch Resolve & Read
**Goal:** `POST /api/branch/:id/resolve` (merge/close), `GET /api/branch/:id`, integration tests.
**Exit criterion:** Create a branch with 3 competing interpretations, resolve one as confirmed — the other two become `RuledOut`, the branch becomes `Closed`. Ruled-out interpretations are still queryable. Resolving an already-closed branch returns `409`. Confirming an interpretation not on the branch returns `400`.
**Plan:** `docs/plans/implementation_plan_p2_s2.md`

---

## Phase 3 — Blame

**Goal:** Implement the reasoning-chain trace query, including walking through superseded interpretations to the original evidence.

### Sub-phase 3.1 — Blame Query & Endpoint
**Goal:** Develop and test the blame Cypher query, wrap in `GET /api/blame/:interpretationId`.
**Exit criterion:** Given an Interpretation that superseded a prior one, the blame query returns both the current and prior Interpretations, the supporting Facts, and the authoring Doctor. The `SUPERSEDES` walk direction is correct (newer → older). The query uses bounded variable-length paths (`*0..5`).
**Plan:** `docs/plans/implementation_plan_p3_s1.md`

### Sub-phase 3.2 — Patient Log & Supersede Chain Tests
**Goal:** `GET /api/patient/:id/log` chronological timeline, integration tests against genuinely superseded chains.
**Exit criterion:** The log endpoint returns chronologically ordered entries of all facts and interpretations for a patient. Integration tests verify: A confirmed → superseded by B → blame on B returns both A and B in `priorChain`, not just B.
**Plan:** `docs/plans/implementation_plan_p3_s2.md`

---

## Phase 4 — Decisions

**Goal:** Add the Decision node and its own status lifecycle (`Active → Retracted / Superseded`) — the gap identified in architecture.md that earlier drafts missed.

### Sub-phase 4.1 — Decision Node & Creation
**Goal:** Decision type, `POST /api/decision` linked to a `Confirmed` Interpretation.
**Exit criterion:** A Decision can be created referencing a Confirmed Interpretation. Attempting to base a Decision on a non-Confirmed Interpretation returns `400`. The Decision has status `Active` by default.
**Plan:** `docs/plans/implementation_plan_p4_s1.md`

### Sub-phase 4.2 — Decision Transitions & Permissions
**Goal:** Retract/supersede endpoints for Decisions, permission check enforcement on both Interpretation and Decision retract.
**Exit criterion:** Decision retract/supersede work with the same transition guard pattern as Interpretations. The `canRetract` permission check is enforced server-side on both `/api/interpretation/:id/retract` and `/api/decision/:id/retract`. Non-author/non-supervisor retract attempts return `403`.
**Plan:** `docs/plans/implementation_plan_p4_s2.md`

### Sub-phase 4.3 — Blame Retargeting & End-to-End Tests
**Goal:** Retarget blame to `GET /api/blame/:decisionId`, full lifecycle integration tests.
**Exit criterion:** Blame takes a Decision ID, walks `BASED_ON` → Interpretation → `SUPERSEDES` chain → Facts → Doctor. End-to-end test: fact → interpretation → confirm → decision → retract decision → blame still resolves correctly through the full chain.
**Plan:** `docs/plans/implementation_plan_p4_s3.md`

---

## Phase 5 — UI

**Goal:** Build the three views that carry the demo: the branch/graph view, the patient log view, and the blame view. This is deliberately the last code phase.

### Sub-phase 5.1 — Design System & Layout Shell
**Goal:** shadcn/ui setup, theme/colors, status badges, app layout with navigation.
**Exit criterion:** A styled app shell renders with navigation between Patient, Branch, Log, and Blame views. Status badges for all states (Hypothesis, Confirmed, RuledOut, Retracted, Superseded, Active) are visually distinct and color-coded correctly (Retracted ≠ Superseded color).
**Plan:** `docs/plans/implementation_plan_p5_s1.md`

### Sub-phase 5.2 — Patient View
**Goal:** Patient detail page with facts list, interpretations list, add-fact and add-interpretation forms.
**Exit criterion:** A user can select a patient, see their facts and interpretations, add a new fact via a dialog form, and add a new interpretation (selecting supporting facts) via a dialog form. All form submissions call the correct API endpoints and refresh the display.
**Plan:** `docs/plans/implementation_plan_p5_s2.md`

### Sub-phase 5.3 — Branch View
**Goal:** React Flow graph visualization of branches with competing interpretations, resolve action.
**Exit criterion:** A branch renders as a graph with interpretation nodes. The "resolve" action calls `/api/branch/:id/resolve`, visually updates confirmed (highlighted) vs. ruled-out (greyed) nodes. Ruled-out nodes remain visible on the graph.
**Plan:** `docs/plans/implementation_plan_p5_s3.md`

### Sub-phase 5.4 — Log & Blame Views
**Goal:** Chronological timeline consuming `/api/patient/:id/log`, blame chain visualization from a Decision.
**Exit criterion:** Log view shows a chronological timeline of all clinical events. Blame view, given a Decision, renders the full traced chain (decision → interpretation → prior superseded → facts → doctor) in a visually obvious, non-JSON format. A reviewer with no context can follow the chain.
**Plan:** `docs/plans/implementation_plan_p5_s4.md`

---

## Phase 6 — Demo Prep

**Goal:** Not a build phase — a rehearsal phase.

### Sub-phase 6.1 — Seed Script
**Goal:** `scripts/seed.ts` producing a realistic patient case with all features exercised.
**Exit criterion:** Running the seed script against a clean Neo4j instance creates: a patient with facts, a resolved branch (2-3 ruled-out + 1 confirmed interpretation), a decision, and at least one superseded interpretation in the chain. The data is realistic-looking, not "test1"/"test2".
**Plan:** `docs/plans/implementation_plan_p6_s1.md`

### Sub-phase 6.2 — Rehearsal & Q&A Prep
**Goal:** Dry-run the full demo walkthrough, prepare answers for expected questions.
**Exit criterion:** Full demo path runs end-to-end from a cold seed in under the allotted time, with no database fixes needed mid-demo. Written answers to "why not FHIR Provenance" and "who can retract a diagnosis" are prepared.
**Plan:** `docs/plans/implementation_plan_p6_s2.md`

---

## What's not a phase

Outcome analytics, GraphRAG, search, and RBAC are not Phase 7 — they don't get built. They exist only as a closing "Future Work" slide (see prd.md §11, architecture.md §7). If you find yourself scoping a phase for any of these, that's the scope-creep risk flagged repeatedly in earlier review rounds resurfacing.
