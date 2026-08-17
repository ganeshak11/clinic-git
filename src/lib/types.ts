// === Status Types (union types, never bare string — invariant #7) ===

export type InterpretationStatus =
  | 'Hypothesis'
  | 'Confirmed'
  | 'RuledOut'
  | 'Retracted'
  | 'Superseded';

export type DecisionStatus =
  | 'Active'
  | 'Retracted'
  | 'Superseded';

export type BranchStatus = 'Open' | 'Closed';

export type FactType = 'lab' | 'imaging' | 'vital' | 'observation';

// === Node Types ===

export interface Patient {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
}

export interface Doctor {
  id: string;
  name: string;
  isSupervisor: boolean;
}

export interface Fact {
  id: string;
  patientId: string;
  type: FactType;
  value: string;
  recordedAt: string; // ISO 8601
  attachmentUrl?: string;
}

export interface Interpretation {
  id: string;
  patientId: string;
  summary: string;
  status: InterpretationStatus;
  authorId: string;
  branchId?: string;
  supersedesId?: string;
  retractedReason?: string;
  createdAt: string; // ISO 8601
}

export interface Decision {
  id: string;
  patientId: string;
  interpretationId: string;
  action: string;
  status: DecisionStatus;
  authorId: string;
  createdAt: string; // ISO 8601
}

export interface Branch {
  id: string;
  patientId: string;
  question: string;
  status: BranchStatus;
  createdAt: string; // ISO 8601
}

// === API Input Types ===

export interface CreateFactInput {
  patientId: string;
  type: FactType;
  value: string;
  recordedAt: string;
  attachmentUrl?: string;
}

export interface CreateInterpretationInput {
  patientId: string;
  summary: string;
  supportingFactIds: string[]; // must be non-empty
  authorId: string;
  branchId?: string;
}

export interface CreateDecisionInput {
  patientId: string;
  interpretationId: string; // must be Confirmed
  action: string;
  authorId: string;
}

export interface RetractInput {
  reason: string;
}

export interface SupersedeInterpretationInput {
  newSummary: string;
  supportingFactIds: string[];
  reason: string;
}

export interface CreateBranchInput {
  patientId: string;
  question: string;
}

export interface ResolveBranchInput {
  confirmedInterpretationId: string;
}

// === Read Types ===

export interface LogEntry {
  type: 'fact' | 'interpretation' | 'decision';
  timestamp: string;
  nodeId: string;
  summary: string;
}

export interface BlameResult {
  decision: Decision;
  interpretation: Interpretation;
  priorChain: Interpretation[]; // walked via SUPERSEDES, oldest last
  supportingFacts: Fact[];
  authoredBy: { id: string; name: string };
}
