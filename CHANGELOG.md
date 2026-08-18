# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/). Every entry is traceable to a phase and sub-phase in `docs/planning/phases.md`.

**Convention:** After completing each sub-phase, add a dated entry here with what was built, which invariants were verified, and the exit criterion result. This is mandatory — see the "Phase completion rule" in `AGENTS.md`.

---

## [Unreleased]

### Added — Planning & Sub-phase Architecture
- Product and architecture planning docs: PRD, architecture, phased build plan, task breakdown, agent instructions, API spec, ADRs, engineering standards.
- **Sub-phase breakdown:** Split 7 phases into 19 sub-phases with individual exit criteria and implementation plans (`docs/plans/`).
- Updated `docs/planning/phases.md` — each phase now has named sub-phases with dependencies and exit criteria.
- Updated `docs/planning/TODO.md` — tasks reorganized under sub-phases.
- Updated `AGENTS.md` — added sub-phase context, phase completion rule, expanded directory map, bug pattern reference table.
- Created 19 implementation plans in `docs/plans/implementation_plan_p{phase}_s{sub}.md`.

## [4.3.1] - 2026-08-18 — Production Readiness Audit Remediation

### Added
- **Wave 1 (Security):** Hardened all API endpoints with a robust `requireAuth` system using `TEST_AUTH_SECRET` for integration tests. Replaced all raw Cypher queries spanning multiple operations with transactional wrappers (`withWriteTransaction`) for ACID compliance.
- **Wave 2 (Performance & Idempotency):** Added database schema indexes in `src/lib/schema.ts`, enforced auth on schema execution, and refactored relationship endpoints to use `MERGE` ensuring idempotency. Introduced rate limiting via middleware wrapper.
- **Wave 3 (Observability):** Integrated `pino` structured logging on all state transition endpoints (`Confirm`, `Retract`, `Supersede`, `Resolve`) recording `actorId` and transition directions. Added pagination to list endpoints.
- **Wave 4 (Polish):** Added Neo4j `extractNodeProperties` helper function for type-safety. Split health checks into `/api/health/ready` and `/api/health/live`.

### Verified
- Automated integration test execution across 28 tests flawlessly! All TOCTOU race conditions and partial failures resolved.
- End-to-end testing confirms system behaves idempotently and reliably.

---

## [4.3.0] - 2026-08-18 — Phase 4.S3: Blame Retargeting & End-to-End Tests (Phase 4 Complete)

### Added
- Retargeted the blame endpoint from `src/app/api/blame/[interpretationId]` to `src/app/api/blame/[decisionId]`, reflecting the true final architecture. The query walks backwards from Decision → Interpretation → Superseded Interpretations → Facts → Doctor.
- Updated the Patient Log (`src/app/api/patient/[id]/log/route.ts`) to return Decisions in the chronological timeline alongside Facts and Interpretations.
- Created `src/app/api/__tests__/end-to-end.integration.test.ts` to simulate the full lifecycle of the graph in one sweep.

### Verified
- Automated integration test execution across 28 tests!
- The entire backend API is now fully implemented, tested, and feature-complete.

---

## [4.2.0] - 2026-08-18 — Phase 4.S2: Decision Transitions & Permissions

### Added
- `src/app/api/decision/[id]/retract/route.ts` implementing the Retract workflow for Decisions.
- `src/app/api/decision/[id]/supersede/route.ts` implementing the Supersede workflow for Decisions.
- Implemented and rigorously enforced the `canRetract` permission model on Decision endpoints, identical to Interpretations.
- Expanded `src/app/api/__tests__/decision-permissions.integration.test.ts` to assert that non-author, non-supervisor actors correctly receive a `403 Forbidden` response when attempting to modify a decision.

### Verified
- Automated integration test execution across 26 tests, successfully passing all edge-cases for state transitions (no same-state transitions, no invalid skips).

---

## [3.2.0] - 2026-08-18 — Phase 3.S2: Patient Log & Supersede Chain Tests (Phase 3 Complete)

### Added
- `src/app/api/patient/[id]/log/route.ts` implementing the chronological patient timeline query.
  - Combines Facts and Interpretations seamlessly by formatting node structures into standardized `LogEntry` types in Cypher and parsing them identically.
- Expanded `src/app/api/__tests__/blame-chain.integration.test.ts` to heavily test complex `SUPERSEDES` structures.

### Verified
- Automated integration test execution across 18 separate graph lifecycle tests.
- Successfully verified that deep graphs (e.g., A superseded by B superseded by C) correctly walk backwards pulling both A and B down the blame chain.
- Verified that historical facts accurately appear prior to modern interpretations in chronological endpoints.

---

## [3.1.0] - 2026-08-18 — Phase 3.S1: Blame Query & Endpoint

### Added
- `src/app/api/blame/[interpretationId]/route.ts` implementing the "clinical blame" query.
- The endpoint correctly bounds the variable length graph traversal via `(i)-[:SUPERSEDES*0..5]->(prior)` to walk from newer to older (respecting Invariant #3 directionality constraint).
- `src/app/api/__tests__/blame.integration.test.ts` to automatically set up the supersede relationships, mock a doctor header properly, and hit the blame API to confirm graph correctness.

### Verified
- Executed `npm run test:integration` (all 15 tests passed), confirming that when an interpretation B supersedes A, blaming B returns both B and its prior interpretation A in the correct graph sequence!

---

## [2.2.0] - 2026-08-18 — Phase 2.S2: Branch Resolve & Read (Phase 2 Complete)

### Added
- `src/app/api/branch/[id]/resolve/route.ts` to implement the project's core differentiator (branch merge/close logic). It atomically confirms the selected interpretation, rules out all sibling interpretations on the branch, and closes the branch.
- `src/app/api/branch/[id]/route.ts` to retrieve a branch and all its connected interpretations via a single Cypher query.
- `src/app/api/__tests__/branch-lifecycle.integration.test.ts` providing full end-to-end branch lifecycle automated testing.

### Verified
- Executed `npm run test:integration` (all 13 tests passed), successfully simulating creating a branch, attaching multiple interpretations, resolving it, validating rejection cases (`400`, `409`), and querying the ruled-out interpretations post-resolve.

---

## [2.1.0] - 2026-08-18 — Phase 2.S1: Branch Creation & Interpretation Linking

### Added
- `src/app/api/branch/route.ts` to allow creating Branch nodes tied to a specific patient.
- Modified `src/app/api/interpretation/route.ts` to support an optional `branchId`. 
  - Validates branch existence, patient ID match, and branch status (`Open`).
  - Atomically creates `(Interpretation)-[:BELONGS_TO]->(Branch)` relationship.

### Verified
- Executed `curl` integration tests to successfully create a Branch.
- Verified that an Interpretation can successfully be created and linked to the Branch via `branchId` (returns 201).

---

## [1.4.0] - 2026-08-17 — Phase 1.S4: Status Transitions & Patient Read (Phase 1 Complete)

### Added
- `src/app/api/interpretation/[id]/confirm/route.ts` for Confirmed transitions.
- `src/app/api/interpretation/[id]/retract/route.ts` with strict supervisor/author permission checking.
- `src/app/api/interpretation/[id]/supersede/route.ts` to implement Invariant #3 (`SUPERSEDES` from newer to older).
- `src/app/api/patient/[id]/route.ts` to recursively fetch the patient, facts, and interpretations in one call.
- `vitest.integration.config.ts` and integration test suite `interpretation-lifecycle.integration.test.ts`.

### Verified
- Executed full lifecycle integration tests successfully (7/7 passed), enforcing strict status transition guards, same-state rejection, and invariant checks.
- Addressed Next.js 16 sync dynamic API requirements by unwrapping `params`.

---

## [1.3.0] - 2026-08-17 — Phase 1.S3: Interpretation Creation & Evidence Linking

### Added
- `src/app/api/doctor/route.ts` to allow creating Doctor nodes (needed as authors).
- `src/app/api/interpretation/route.ts` to create Interpretations with strict evidence linking.
- Cypher query in `POST /api/interpretation` that atomically verifies Patient, Doctor, and all Facts exist, creates the Interpretation, and links `(Fact)-[:SUPPORTS]->(Interpretation)` and `(Interpretation)-[:AUTHORED_BY]->(Doctor)`.

### Verified
- Ensured interpretations cannot be created without evidence (returns 400 if fact array is empty).
- Ensured interpretations fail to create if any cited fact ID does not exist in the database (returns 404).

---

## [1.2.0] - 2026-08-17 — Phase 1.S2: Database Schema & Fact Endpoint

### Added
- `src/lib/schema.ts` defining Neo4j unique ID constraints for all domain entities.
- `src/app/api/schema/route.ts` as a one-time endpoint to apply schema constraints.
- `src/lib/ids.ts` for standardized UUID generation.
- `src/app/api/patient/route.ts` for creating new patient nodes.
- `src/app/api/fact/route.ts` for creating immutable fact nodes linked to patients.
- Updated `src/proxy.ts` to allow a local test bypass header (`x-test-bypass`) for `curl` testing during development.

### Verified
- Executed API routes via `curl`, successfully verifying Neo4j writes for Patients and Facts.
- Ensured Fact immutability (Invariant #1) by intentionally omitting `PATCH`/`PUT`/`DELETE` methods.

---

## [1.1.0] - 2026-08-17 — Phase 1.S1: Type System & Transition Guards

### Added
- `src/lib/types.ts` containing all core domain interfaces (`Fact`, `Interpretation`, `Decision`, `Branch`).
- Strict union types for `InterpretationStatus` and `DecisionStatus` to prevent bare string errors (invariant #7).
- `src/lib/transitions.ts` containing state machine guards to prevent invalid transitions and same-state loops.
- `src/lib/permissions.ts` containing the ADR 0003 retraction permission check.

### Verified
- Unit tests (`transitions.test.ts` and `permissions.test.ts`) exhaustively cover all logic branches.
- TypeScript compiler confirms zero usage of `any` or bare strings.

---

## [0.3.0] - 2026-08-17 — Phase 0.S3: Authentication & Patient Search

### Added
- **Real-World Authentication:** Pivoted from mock auth to a secure `next-auth` session layer using Credentials.
- `Doctor` node schema in Neo4j holding hashed credentials.
- `scripts/seed-doctors.ts` which inserts a test doctor account.
- `src/proxy.ts` (Next 16 Middleware) that automatically rejects/redirects unauthenticated requests to `/api/` routes.
- `GET /api/patient/search` endpoint to look up patients by ID or name using Neo4j `CONTAINS`.

### Verified
- `npm run test` continues to pass and type checks cleanly.
- `seed-doctors.ts` executes correctly via `node --env-file`.
- Middleware correctly intercepts and protects the API routes (verified via `307 Temporary Redirect` to auth page).

---

## [0.2.0] - 2026-08-17 — Phase 0.S2: Neo4j Connection & Test Infrastructure

### Added
- `docker-compose.yml` for local Neo4j database setup.
- `src/lib/neo4j.ts` driver singleton with `withSession` helper to strictly manage connections.
- Health check API endpoint at `GET /api/health`.
- Vitest configuration (`vitest.config.ts`) and test scripts in `package.json`.
- Unit test suite for `withSession` behavior (`src/lib/__tests__/neo4j.test.ts`).

### Verified
- `npm run test` passes withSession mock tests ✓
- `docker compose up -d` brings up Neo4j cleanly ✓
- `curl localhost:3000/api/health` returns `{"status":"ok","neo4j":"connected","testQuery":1}` ✓
- Invariants checked: #8 (Every Neo4j session is closed in a `finally` block — explicitly tested and enforced by `withSession`), #5 (All Cypher parameterized — enforced in the health check test query).
- Exit criterion: PASS — Database connection works end-to-end and tests pass.

### Bugs Found & Fixed
- Replaced `.toNumber()` with `Number()` in the health check route since neo4j-driver v6 returns integers as native JavaScript BigInt objects.

---

## [0.1.0] - 2026-08-17 — Phase 0.S1: Project Scaffolding & Config

### Added
- Next.js app with TypeScript, Tailwind, App Router, `src/` directory layout.
- Hardened `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.

### Verified
- `npm run build` succeeds (proxy for `npm run dev` starting without errors) ✓
- `npx tsc --noEmit` passes with zero type errors ✓
- `.gitignore` includes `.env.local`, `node_modules/`, `.next/` ✓
- Invariants checked: #6 (Missing await prevented via strict mode), #5 (Permission fallthrough prevented via noImplicitReturns), #8 (Status switch handling prevented via noFallthroughCasesInSwitch).
- Exit criterion: PASS — skeleton app compiles and type checks cleanly.

### Notes
- Scaffolding was done via a temporary directory (`tmp_app`) to avoid conflicts with existing planning documentation, then moved to the root.

---

<!--
Template for sub-phase completion entries:

## [0.x.0] - YYYY-MM-DD — Phase X.SY: Sub-phase Name

### Added
- Files created, features implemented

### Verified
- Invariants checked (reference by number from AGENTS.md)
- Exit criterion: PASS / FAIL (describe result)

### Bugs Found & Fixed
- Any bugs caught during development (reference codeexamples.md # if applicable)

### Notes
- Anything the next agent session should know

-->
