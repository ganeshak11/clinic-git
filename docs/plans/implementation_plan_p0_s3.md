# Phase 0, Sub-phase 3 — Authentication & Patient Search

**Phase:** 0 — Setup
**Sub-phase:** 3 of 3
**Depends on:** P0.S2 (Neo4j connection works)
**Exit criterion:** NextAuth session creation succeeds (login works). Middleware protects all `/api` routes except health/auth.

---

## Context

Originally out-of-scope for the MVP, the product has pivoted to require real-world authentication. Doctors must securely log in with email/password. There is no public sign-up; doctor accounts are seeded by an admin. Once logged in, a doctor can search for a patient by ID or name to begin the clinical review.

---

## Proposed Changes

### [NEW] Dependencies
- `next-auth` (Credentials provider)
- `bcrypt` (for password hashing)

### [NEW] `src/app/api/auth/[...nextauth]/route.ts`
- Implement NextAuth with `CredentialsProvider`.
- Verify credentials against the `Doctor` node in Neo4j.
- Store `id`, `name`, `email`, and `isSupervisor` in the JWT token.

### [NEW] `src/middleware.ts`
- Standard NextAuth middleware to protect `/api/` routes.
- Exempt `/api/health` and `/api/auth/*`.

### [NEW] `scripts/seed-doctors.ts`
- Script to clear existing doctors and create a test doctor account.
- Uses `bcrypt` to hash the password before saving to Neo4j.
- Will create:
  - Email: `dr.smith@clinic.local`
  - Password: `password123`
  - isSupervisor: `true`

### [NEW] `src/app/api/patient/search/route.ts`
- An endpoint to search patients by `id` or `name` (using `CONTAINS`).
- Must check for a valid session token (in API logic or relying on middleware).
