# Security: ClinicalGit

## Data handling — read this first

**This project never stores real patient data.** All patient, fact, and interpretation data used in development, testing, and demos must be synthetic or clearly fabricated. This isn't a formality — ClinicalGit models clinical data closely enough that it would be easy to casually paste in a real report "just to test with realistic data." Don't. There is no HIPAA-equivalent compliance work done here (no encryption-at-rest audit, no BAA, no access logging built for compliance purposes), so nothing that could plausibly identify a real patient goes anywhere near this system, including local dev.

## Auth model

Session-based. A logged-in session carries `userId` and an `isSupervisor` flag. Full user management (signup, password reset, org/department structure) is out of scope for MVP — a small seeded set of doctor accounts is sufficient. If using NextAuth or similar, keep the session payload minimal: exactly the two fields the permission check in ADR 0003 needs.

## Permission enforcement

The retract permission check (`docs/architecture/adr/0003-minimal-permission-model.md`) must be enforced **server-side, in the route handler**, never trusted from client-supplied data. The client can send whatever `isSupervisor` claim it wants in a request body; only the value from the verified session is authoritative.

## Secrets

- `.env.local` (dev) and platform-level environment variables (prod) only. Never committed. `.env.example` in the repo root is the template — it must never contain a real value, only placeholders.
- `NEO4J_PASSWORD` and `SESSION_SECRET` are the two secrets that matter here. Rotate `SESSION_SECRET` if it's ever exposed (e.g. accidentally committed) — this invalidates all existing sessions, which is the correct response, not an inconvenience to avoid.

## Injection

**All Cypher queries must use parameterized inputs.** Never build a query string via interpolation, including for IDs — this was flagged as a planted bug pattern in `docs/practice/codeexamples.md` #3 specifically because it's easy to write by accident when a query "looks read-only" for an ID lookup. Every `session.run()` call takes a params object as its second argument; use it for every value, with no exceptions for values that "can't possibly contain user input."

## Threat model (MVP scope)

| Threat | Mitigation |
|---|---|
| Non-author retracts a diagnosis without authorization | Server-side permission check, every retract route — see ADR 0003 |
| A Fact gets edited after the fact, undermining the immutability guarantee the whole pitch depends on | No update/delete route exists for Fact — enforced by absence, tested explicitly (`docs/engineering/testing.md`) |
| Cypher injection via unparameterized query construction | Parameterized queries only, no exceptions — code review should reject any `session.run()` with a template-literal-built query string |
| Neo4j session exhaustion (unclosed sessions under load) | Every session opened in a `try` must be closed in the paired `finally` — see `CLAUDE.md` invariant #8 |
| Secrets committed to the repo | `.env*` in `.gitignore`, `.env.example` contains placeholders only, pre-commit hook or CI secret-scan if time allows |

## What's explicitly not built

Rate limiting, brute-force login protection, full audit logging for compliance purposes, encryption-at-rest configuration beyond whatever the hosting platform provides by default, multi-tenant data isolation. None of these are needed for a synthetic-data demo, and building them would be scope creep against the same discipline applied elsewhere in this project — see `docs/product/prd.md` §3.
