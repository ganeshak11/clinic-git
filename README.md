# ClinicalGit

A graph-native system for tracking clinical hypotheses, evidence, decisions, retractions, and diagnostic reasoning over a patient's medical journey. Facts are immutable; interpretations of those facts carry an explicit status lifecycle; competing diagnoses are tracked as branches until resolved.

**Status:** Planning complete. No application code shipped yet — currently at Phase 0, Sub-phase 1 (scaffolding). See `docs/planning/phases.md` for the full sub-phase breakdown.

If you're an AI agent picking this up, read `AGENTS.md` first, not this file.

## Doc map

| Doc | Purpose |
|---|---|
| `AGENTS.md` | Agent operating instructions — invariants, sub-phase context, phase completion rules. Read first. |
| `docs/product/prd.md` | What this is, what it isn't, and why. Goals, non-goals, features, success criteria. |
| `docs/architecture/architecture.md` | System design, data model, API surface, key queries. |
| `docs/architecture/api-spec.md` | Full endpoint contract — request/response shapes. |
| `docs/architecture/adr/` | Why the big decisions were made (single database, fact/interpretation split, permission model). |
| `docs/planning/phases.md` | 7 phases, 19 sub-phases — exit criteria per sub-phase. |
| `docs/planning/TODO.md` | Concrete tasks per sub-phase, marked as completed. |
| `docs/plans/` | **Implementation plans** — one per sub-phase (`implementation_plan_p{phase}_s{sub}.md`). Read the relevant plan before starting work. |
| `docs/engineering/coding-standards.md` | TypeScript conventions, Cypher rules, session handling. |
| `docs/engineering/testing.md` | What must be tested and why, including the non-obvious cases. |
| `docs/engineering/security.md` | Auth, secrets, data handling, threat model. |
| `docs/operations/deployment.md` | How this gets deployed and rolled back. |
| `docs/glossary.md` | What Fact, Interpretation, Branch, Decision, and each status actually mean. |
| `docs/practice/codeexamples.md` | Bug-finding practice exercises — 10 planted bugs that the sub-phase plans explicitly prevent. |
| `CHANGELOG.md` | Build progress — each sub-phase gets a completion entry with what was built and verified. |

## Build phases (19 sub-phases)

| Phase | Sub-phases | Key deliverable |
|-------|-----------|-----------------|
| **0 — Setup** | S1 Scaffolding, S2 Neo4j + Tests | Running skeleton |
| **1 — Facts & Interpretations** | S1 Types, S2 Schema/Facts, S3 Interpretation, S4 Transitions | Core data model |
| **2 — Branching** | S1 Branch Create, S2 Branch Resolve | Core differentiator |
| **3 — Blame** | S1 Blame Query, S2 Log + Tests | Reasoning-chain trace |
| **4 — Decisions** | S1 Create, S2 Transitions, S3 Blame Retarget | Decision lifecycle |
| **5 — UI** | S1 Design System, S2 Patient, S3 Branch, S4 Log/Blame | Frontend |
| **6 — Demo Prep** | S1 Seed Script, S2 Rehearsal | Demo readiness |

## Quick start

```bash
# Neo4j (local dev)
docker compose up -d

# App
npm install
cp .env.example .env.local   # fill in NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD
npm run dev
```

Full setup and per-sub-phase build steps: `docs/planning/TODO.md`.

## Non-goals (see prd.md for full list)

Not an EHR replacement. Not handling real patient data — synthetic/seed data only (see `docs/engineering/security.md`). Outcome analytics, GraphRAG, search, and full RBAC are explicitly deferred, not planned for a later phase of this build.
