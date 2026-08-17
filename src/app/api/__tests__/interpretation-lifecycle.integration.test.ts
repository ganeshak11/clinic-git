import { describe, it, expect, beforeAll } from 'vitest';
import { generateId } from '../../../../lib/ids';

// A helper for curl-like testing in integration
async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `http://localhost:3000${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-test-bypass': 'true',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('Interpretation lifecycle integration', () => {
  let patientId: string;
  let doctorId: string;
  let fact1Id: string;
  let fact2Id: string;
  let interpretationId: string;

  beforeAll(async () => {
    // 1. Create Patient
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Lifecycle Patient' }),
    });
    patientId = pRes.data.id;

    // 2. Create Doctor
    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Doctor', isSupervisor: false }),
    });
    doctorId = dRes.data.id;

    // 3. Create Facts
    const f1Res = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'lab',
        value: 'Test Lab 1',
        recordedAt: '2026-01-01T00:00:00Z',
      }),
    });
    fact1Id = f1Res.data.id;

    const f2Res = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'vital',
        value: 'Test Vital 1',
        recordedAt: '2026-01-01T00:00:00Z',
      }),
    });
    fact2Id = f2Res.data.id;
  });

  it('creates an interpretation', async () => {
    const res = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Lifecycle Hypo',
        supportingFactIds: [fact1Id, fact2Id],
        authorId: doctorId,
      }),
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('Hypothesis');
    interpretationId = res.data.id;
  });

  it('rejects Hypothesis → Superseded (invalid skip)', async () => {
    const res = await apiFetch(`/api/interpretation/${interpretationId}/supersede`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({
        newSummary: 'Skipped Hypo',
        supportingFactIds: [fact1Id],
        reason: 'Skip test',
      }),
    });
    expect(res.status).toBe(409); // Should fail transition
  });

  it('rejects Hypothesis → Retracted (invalid skip)', async () => {
    const res = await apiFetch(`/api/interpretation/${interpretationId}/retract`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({ reason: 'Skip test' }),
    });
    expect(res.status).toBe(409);
  });

  it('confirms the interpretation (Hypothesis -> Confirmed)', async () => {
    const res = await apiFetch(`/api/interpretation/${interpretationId}/confirm`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('Confirmed');
  });

  it('rejects Confirmed → Confirmed (same-state)', async () => {
    const res = await apiFetch(`/api/interpretation/${interpretationId}/confirm`, {
      method: 'POST',
    });
    expect(res.status).toBe(409); // Should fail transition
  });

  it('supersedes creates new interpretation with SUPERSEDES link (newer -> older)', async () => {
    const res = await apiFetch(`/api/interpretation/${interpretationId}/supersede`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({
        newSummary: 'Superseded Hypo',
        supportingFactIds: [fact1Id], // New one only uses fact1
        reason: 'Better evidence',
      }),
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('Hypothesis');
    expect(res.data.supersedesId).toBe(interpretationId);
    
    // The old one is now Superseded (we don't get it back, but we can check via patient read next)
    const newId = res.data.id;
    
    // Retract the new one just to complete lifecycle
    // Wait, let's confirm it first so we can retract it.
    await apiFetch(`/api/interpretation/${newId}/confirm`, { method: 'POST' });
    
    // Retract
    const retRes = await apiFetch(`/api/interpretation/${newId}/retract`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({ reason: 'Mistake' }),
    });
    expect(retRes.status).toBe(200);
    expect(retRes.data.status).toBe('Retracted');
    expect(retRes.data.retractedReason).toBe('Mistake');
  });

  it('GET /api/patient/:id returns facts and interpretations', async () => {
    const res = await apiFetch(`/api/patient/${patientId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(patientId);
    expect(res.data.facts.length).toBe(2);
    // There should be 2 interpretations (the original one and the superseded one)
    expect(res.data.interpretations.length).toBe(2);
    
    const oldInt = res.data.interpretations.find((i: any) => i.id === interpretationId);
    const newInt = res.data.interpretations.find((i: any) => i.id !== interpretationId);
    
    expect(oldInt.status).toBe('Superseded');
    expect(newInt.status).toBe('Retracted');
    expect(newInt.supersedesId).toBe(oldInt.id); // Invariant #3 verification
  });
});
