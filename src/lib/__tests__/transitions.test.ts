import { describe, it, expect } from 'vitest';
import { canTransitionInterpretation, canTransitionDecision } from '../transitions';

describe('canTransitionInterpretation', () => {
  // Valid transitions
  it('allows Hypothesis → Confirmed', () => {
    expect(canTransitionInterpretation('Hypothesis', 'Confirmed')).toBe(true);
  });
  it('allows Hypothesis → RuledOut', () => {
    expect(canTransitionInterpretation('Hypothesis', 'RuledOut')).toBe(true);
  });
  it('allows Confirmed → Retracted', () => {
    expect(canTransitionInterpretation('Confirmed', 'Retracted')).toBe(true);
  });
  it('allows Confirmed → Superseded', () => {
    expect(canTransitionInterpretation('Confirmed', 'Superseded')).toBe(true);
  });

  // Invalid transitions
  it('rejects Hypothesis → Superseded', () => {
    expect(canTransitionInterpretation('Hypothesis', 'Superseded')).toBe(false);
  });
  it('rejects Hypothesis → Retracted', () => {
    expect(canTransitionInterpretation('Hypothesis', 'Retracted')).toBe(false);
  });
  it('rejects RuledOut → anything', () => {
    expect(canTransitionInterpretation('RuledOut', 'Hypothesis')).toBe(false);
    expect(canTransitionInterpretation('RuledOut', 'Confirmed')).toBe(false);
  });
  it('rejects Retracted → anything', () => {
    expect(canTransitionInterpretation('Retracted', 'Hypothesis')).toBe(false);
  });
  it('rejects Superseded → anything', () => {
    expect(canTransitionInterpretation('Superseded', 'Confirmed')).toBe(false);
  });

  // Same-state transitions — the codeexamples.md #1 bug
  it('rejects Hypothesis → Hypothesis (same-state)', () => {
    expect(canTransitionInterpretation('Hypothesis', 'Hypothesis')).toBe(false);
  });
  it('rejects Confirmed → Confirmed (same-state)', () => {
    expect(canTransitionInterpretation('Confirmed', 'Confirmed')).toBe(false);
  });
  it('rejects RuledOut → RuledOut (same-state)', () => {
    expect(canTransitionInterpretation('RuledOut', 'RuledOut')).toBe(false);
  });
  it('rejects Retracted → Retracted (same-state)', () => {
    expect(canTransitionInterpretation('Retracted', 'Retracted')).toBe(false);
  });
  it('rejects Superseded → Superseded (same-state)', () => {
    expect(canTransitionInterpretation('Superseded', 'Superseded')).toBe(false);
  });
});

describe('canTransitionDecision', () => {
  it('allows Active → Retracted', () => {
    expect(canTransitionDecision('Active', 'Retracted')).toBe(true);
  });
  it('allows Active → Superseded', () => {
    expect(canTransitionDecision('Active', 'Superseded')).toBe(true);
  });
  it('rejects Active → Active (same-state)', () => {
    expect(canTransitionDecision('Active', 'Active')).toBe(false);
  });
  it('rejects Retracted → anything', () => {
    expect(canTransitionDecision('Retracted', 'Active')).toBe(false);
  });
  it('rejects Superseded → anything', () => {
    expect(canTransitionDecision('Superseded', 'Active')).toBe(false);
  });
});
