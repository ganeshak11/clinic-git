import type { InterpretationStatus, DecisionStatus } from './types';

const VALID_INTERPRETATION_TRANSITIONS: Record<InterpretationStatus, InterpretationStatus[]> = {
  Hypothesis: ['Confirmed', 'RuledOut'],
  Confirmed: ['Retracted', 'Superseded'],
  RuledOut: [],
  Retracted: [],
  Superseded: [],
};

/**
 * Guard function for Interpretation status transitions.
 * Same-state transitions (e.g. Confirmed → Confirmed) are INVALID, not no-ops.
 * See codeexamples.md #1 for the bug this prevents.
 */
export function canTransitionInterpretation(
  from: InterpretationStatus,
  to: InterpretationStatus,
): boolean {
  // No || from === to — same-state transitions are invalid (codeexamples.md #1)
  return VALID_INTERPRETATION_TRANSITIONS[from].includes(to);
}

const VALID_DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  Active: ['Retracted', 'Superseded'],
  Retracted: [],
  Superseded: [],
};

/**
 * Guard function for Decision status transitions.
 * Same pattern as Interpretation — Active replaces Hypothesis as the starting state.
 */
export function canTransitionDecision(
  from: DecisionStatus,
  to: DecisionStatus,
): boolean {
  return VALID_DECISION_TRANSITIONS[from].includes(to);
}
