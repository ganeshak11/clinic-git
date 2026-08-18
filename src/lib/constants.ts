import type { InterpretationStatus, DecisionStatus } from './types';

/**
 * Status badge color mapping.
 * CRITICAL: Retracted ≠ Superseded — they are clinically different events
 * (codeexamples.md #8). Using the same color undercuts the project's
 * core distinction between error correction and diagnostic refinement.
 */
export const STATUS_COLORS: Record<InterpretationStatus | DecisionStatus, string> = {
  Hypothesis: 'bg-blue-100 text-blue-800 border-blue-200',      // open question
  Active: 'bg-blue-100 text-blue-800 border-blue-200',           // same semantic as Hypothesis
  Confirmed: 'bg-green-100 text-green-800 border-green-200',      // accepted
  RuledOut: 'bg-gray-100 text-gray-600 border-gray-200',          // eliminated
  Retracted: 'bg-red-100 text-red-800 border-red-200',           // error correction
  Superseded: 'bg-amber-100 text-amber-800 border-amber-200',      // refinement (NOT red)
};
