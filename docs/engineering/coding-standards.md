# Coding Standards: ClinicalGit

Each rule below exists because of a specific failure mode already identified for this project, not as generic best practice — cross-references included so the reasoning isn't lost.

## TypeScript

- **Strict mode on** (`"strict": true` in `tsconfig.json`), no exceptions. This is what makes a missing `await` a compile error instead of a runtime `undefined` crash — see `docs/practice/codeexamples.md` #6.
- **No `any`.** If a type is genuinely unknown, use `unknown` and narrow it explicitly.
- **Status fields are union types, never bare `string`.** `type InterpretationStatus = 'Hypothesis' | 'Confirmed' | ...`, defined once and imported everywhere it's used. A bare `string` with valid values noted only in a comment is how a typo like `'Actve'` silently ships — see `docs/practice/codeexamples.md` #7. This applies to `Interpretation.status` and `Decision.status` identically.
- **Exhaustive switches on status types** should end with a `never`-typed default case, so adding a new status value forces a compile error everywhere it isn't handled, rather than a silent fallthrough.
- **All IDs are `string`**, consistently, across every node type. Don't type one ID field as `number` while the rest of the schema uses `string` — see `docs/practice/codeexamples.md` #3 for what that costs.

## Neo4j / Cypher

- **Every value passed to a query is a parameter**, never string-interpolated — including IDs, including values that "can't contain user input." See `docs/engineering/security.md`.
- **Every session is opened and closed in the same function**, with `close()` in a `finally` block. Don't pass sessions between functions or hold them open across requests.
- **`SUPERSEDES` always points newer → older.** If you're writing a query that walks this relationship, state in a comment which direction you intend and why, since getting it backwards doesn't error — it just silently returns an incomplete result. See `CLAUDE.md` invariant #3.
- **Variable-length paths get an upper bound** (`*0..5`, not bare `*`), even where a cycle shouldn't be possible given the current write logic — don't rely on data staying small by accident.

## API routes

- Validate required fields (e.g. non-empty `supportingFactIds`) before touching the database, and return `400` — don't let an empty-evidence interpretation reach Neo4j and fail there with a less legible error.
- Status-transition and permission-check functions live in `src/lib/`, imported by route handlers — never duplicate the transition or permission logic inline in a route.

## Naming

- Route files match `docs/architecture/api-spec.md` exactly — if a route's shape changes, the doc changes in the same commit (see the doc-sync rule in `CLAUDE.md`).
- Cypher relationship types are `SCREAMING_SNAKE_CASE` (`HAS_FACT`, `SUPPORTS`), matching `architecture.md` exactly.

## Commits

- Reference the phase a change belongs to where relevant (e.g. `feat(phase-2): branch resolve endpoint`).
- A commit that changes the data model, API contract, or permission logic includes the corresponding doc update — not a follow-up commit "to update docs later."
