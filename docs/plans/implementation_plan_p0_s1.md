# Phase 0, Sub-phase 1 — Project Scaffolding & Config

**Phase:** 0 — Setup
**Sub-phase:** 1 of 2
**Depends on:** Nothing (first sub-phase)
**Exit criterion:** `npm run dev` starts without errors and serves a page at `localhost:3000`. `tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true`.

---

## Context

The project has zero application code — only planning docs, ADRs, `.env.example`, and a `CHANGELOG.md`. This sub-phase creates the Next.js skeleton that everything else builds on.

---

## Proposed Changes

### [NEW] Next.js App (root directory)

Scaffold using `create-next-app`:

```bash
npx -y create-next-app@latest ./ \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

Flags explained:
- `--typescript` — required per coding-standards.md
- `--tailwind` — required per TODO.md
- `--app` — App Router, required per architecture.md
- `--src-dir` — uses `src/` layout per AGENTS.md directory structure (`src/lib/`, `src/app/api/`, `src/components/`)
- `--import-alias "@/*"` — enables `@/lib/neo4j` style imports
- `--no-turbopack` — stable Webpack bundler for reliability

> [!NOTE]
> `create-next-app` will generate: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`, and boilerplate files.

### [MODIFY] tsconfig.json — Harden TypeScript

After scaffolding, add/verify these compiler options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Why each matters for this project:**
- `strict: true` — catches missing `await` at compile time (codeexamples.md #6)
- `noUncheckedIndexedAccess: true` — forces null-checking on Neo4j record access (`result.records[0]` becomes `Record | undefined`)
- `noImplicitReturns: true` — prevents the `canRetract` trailing-return-true bug (codeexamples.md #5)
- `noFallthroughCasesInSwitch: true` — enforces explicit handling in status-badge switches (codeexamples.md #8)

### [VERIFY] .gitignore

Confirm the scaffolded `.gitignore` includes:
- `.env.local`
- `.env`
- `node_modules/`
- `.next/`

If any are missing, add them. Per security.md, `.env.local` must never be committed.

### [KEEP] Existing Files

The scaffolding must not overwrite:
- `AGENTS.md`
- `CHANGELOG.md`
- `README.md`
- `.env.example`
- `docs/` directory
- `practice/` directory

If `create-next-app` conflicts with existing files (e.g. `README.md`), preserve our existing versions and discard the scaffolded ones.

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `package.json` | Dependencies, scripts |
| NEW | `tsconfig.json` (then hardened) | Strict TypeScript config |
| NEW | `next.config.ts` | Next.js config |
| NEW | `tailwind.config.ts` | Tailwind config |
| NEW | `postcss.config.mjs` | PostCSS for Tailwind |
| NEW | `src/app/layout.tsx` | Root layout |
| NEW | `src/app/page.tsx` | Home page (placeholder) |
| NEW | `src/app/globals.css` | Global styles |
| VERIFY | `.gitignore` | Ensure `.env.local` excluded |
| KEEP | `AGENTS.md`, `README.md`, `CHANGELOG.md`, `docs/`, `practice/` | Existing project files |

---

## Verification

```bash
npm run dev
# Visit http://localhost:3000 — page loads
# Check tsconfig.json has strict: true and noUncheckedIndexedAccess: true
npx tsc --noEmit
# No type errors
```

---

## What This Does NOT Include

- No Neo4j connection (sub-phase 0.2)
- No test infrastructure (sub-phase 0.2)
- No API routes (Phase 1+)
- No clinical data model (Phase 1+)
