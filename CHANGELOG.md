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
