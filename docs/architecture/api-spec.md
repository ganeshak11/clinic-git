# API Spec: ClinicalGit

Companion to `architecture.md`. Every route below is the source of truth for request/response shape — if code and this doc disagree, that's a bug in one of them (see the doc-sync rule in `CLAUDE.md`). This is written as a typed contract; generating a formal `openapi.yaml` from it later is straightforward once routes stabilize, but isn't needed before then.

Auth: every route below requires a session identifying `userId`. Routes marked **[supervisor-gated]** additionally require the permission check in `docs/engineering/security.md`.

---

## Fact

### `POST /api/fact`
```typescript
// Request
interface CreateFactInput {
  patientId: string;
  type: 'lab' | 'imaging' | 'vital' | 'observation';
  value: string;
  recordedAt: string; // ISO 8601
  attachmentUrl?: string;
}

// Response 201
interface Fact {
  id: string;
  patientId: string;
  type: 'lab' | 'imaging' | 'vital' | 'observation';
  value: string;
  recordedAt: string;
  attachmentUrl?: string;
}
```
No update or delete route exists for Fact. This is intentional (invariant #1 in `CLAUDE.md`), not an omission — do not add one.

---

## Interpretation

### `POST /api/interpretation`
```typescript
interface CreateInterpretationInput {
  patientId: string;
  summary: string;
  supportingFactIds: string[]; // must be non-empty
  authorId: string; // doctor
  branchId?: string;
}

// Response 201 — status defaults to 'Hypothesis'
interface Interpretation {
  id: string;
  patientId: string;
  summary: string;
  status: 'Hypothesis' | 'Confirmed' | 'RuledOut' | 'Retracted' | 'Superseded';
  authorId: string;
  branchId?: string;
  supersedesId?: string;
}
```
`supportingFactIds` empty → `400`. This enforces PRD §6.1 (no diagnosis without evidence) at the API boundary, not just by convention.

### `POST /api/interpretation/:id/confirm`
No body. Valid only from `Hypothesis`. Invalid transition → `409`.

### `POST /api/interpretation/:id/retract` **[supervisor-gated]**
```typescript
interface RetractInput { reason: string; }
```
Valid only from `Confirmed`. Requester must be `authorId` or hold `isSupervisor` — see `security.md`. Unauthorized → `403`. Invalid prior state → `409`.

### `POST /api/interpretation/:id/supersede`
```typescript
interface SupersedeInput {
  newSummary: string;
  supportingFactIds: string[];
  reason: string;
}
// Response 201 — creates a NEW Interpretation with supersedesId pointing at the old one,
// and sets the old one's status to 'Superseded'. The old node is never mutated beyond its status field.
```

---

## Branch

### `POST /api/branch`
```typescript
interface CreateBranchInput { patientId: string; question: string; }
interface Branch { id: string; patientId: string; question: string; status: 'Open' | 'Closed'; }
```

### `GET /api/branch/:id`
```typescript
interface BranchDetail extends Branch {
  interpretations: Interpretation[];
}
```

### `POST /api/branch/:id/resolve`
```typescript
interface ResolveBranchInput { confirmedInterpretationId: string; }
// Sets confirmedInterpretationId's status to 'Confirmed', all sibling interpretations
// on this branch to 'RuledOut', branch status to 'Closed'.
// confirmedInterpretationId not found on this branch → 400.
// Branch already 'Closed' → 409.
```

---

## Decision

### `POST /api/decision`
```typescript
interface CreateDecisionInput {
  patientId: string;
  interpretationId: string; // must reference a 'Confirmed' interpretation
  action: string; // e.g. "Start Metformin 500mg"
  authorId: string;
}
interface Decision {
  id: string;
  patientId: string;
  interpretationId: string;
  action: string;
  status: 'Active' | 'Retracted' | 'Superseded';
  authorId: string;
}
```
`interpretationId` not `Confirmed` → `400`.

### `POST /api/decision/:id/retract` **[supervisor-gated]**
Same shape and rules as interpretation retract.

### `POST /api/decision/:id/supersede`
Same shape as interpretation supersede, scoped to Decision.

---

## Read endpoints

### `GET /api/patient/search`
```typescript
// Query params: ?q=name_or_id
interface PatientSearchResult {
  id: string;
  name: string;
  dateOfBirth: string; // ISO 8601
}
// Returns PatientSearchResult[]
```

### `GET /api/patient/:id`
```typescript
interface PatientDetail {
  id: string;
  name: string;
  facts: Fact[];
  interpretations: Interpretation[];
}
```

### `GET /api/patient/:id/log`
```typescript
// Chronological, all node types, for the timeline view
interface LogEntry {
  type: 'fact' | 'interpretation' | 'decision';
  timestamp: string;
  nodeId: string;
  summary: string;
}
type PatientLog = LogEntry[];
```

### `GET /api/blame/:decisionId`
```typescript
interface BlameResult {
  decision: Decision;
  interpretation: Interpretation;
  priorChain: Interpretation[]; // walked via SUPERSEDES, oldest last — see architecture.md §4
  supportingFacts: Fact[];
  authoredBy: { id: string; name: string };
}
```

---

## Status codes used throughout

| Code | Meaning here |
|---|---|
| `200` / `201` | Success (200 for reads/actions, 201 for creation) |
| `400` | Invalid input — missing required field, empty evidence list, wrong prior state for the target node |
| `403` | Permission check failed (retract by non-author/non-supervisor) |
| `404` | Node not found |
| `409` | Valid request, invalid state transition (e.g. resolving an already-closed branch) |
