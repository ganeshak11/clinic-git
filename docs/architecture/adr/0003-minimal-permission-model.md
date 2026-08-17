# ADR 0003: Minimal Permission Model (No RBAC)

**Status:** Accepted

## Context

Retracting a confirmed diagnosis raises an immediate question: who is allowed to do that? Real hospital hierarchies have layered authority (resident → consultant → department head), and a naive answer is to build a role hierarchy to match. That's an access-control system in its own right, disproportionate to an MVP whose value proposition is the reasoning graph, not identity management.

## Decision

One hard-coded rule, enforced in application code, not a permissions framework: **only the original author of an Interpretation or Decision, or a user flagged `isSupervisor`, may retract it.** No role hierarchy, no per-branch or per-department scoping, no delegation.

```typescript
function canRetract(node: { authorId: string }, requestingUserId: string, requestorIsSupervisor: boolean): boolean {
  return node.authorId === requestingUserId || requestorIsSupervisor;
}
```

## Consequences

**Positive:**
- Fast to build and easy to reason about — one function, directly testable.
- Still enforces the real requirement (not just anyone can rewrite a diagnosis) without pretending to be more sophisticated than it is.

**Negative:**
- Does not model real hospital hierarchy (a resident's supervisor should perhaps only be able to retract *that resident's* interpretations, not any interpretation in the system — this version can't express that distinction).
- `isSupervisor` is a flat boolean, not scoped to a department, team, or patient — acceptable for MVP, not acceptable if this were ever deployed against real clinical data.
- If asked in review "does this generalize to a real hospital," the honest answer is no — this was a deliberate MVP scope cut, not an oversight. State it that way rather than defending it as sufficient.

## Alternatives considered

- **Full RBAC hierarchy** (Resident → Consultant → Department Head, each with defined permissions) — the clinically accurate model. Rejected for MVP: this is an enterprise IAM problem, not a differentiator, and building it would consume time better spent on the branching/blame features that are the actual pitch.
