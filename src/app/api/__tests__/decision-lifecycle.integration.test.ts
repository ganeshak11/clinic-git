import { describe, it, expect, beforeAll } from 'vitest';

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `http://localhost:3000${path}`;
  
  let bodyObj = {};
  try { if (options.body) bodyObj = JSON.parse(options.body as string); } catch (e) {}
  
  const headers = {
    'Content-Type': 'application/json',
    'x-test-auth-secret': 'test-secret',
    ...options.headers,
  };
  
  if (bodyObj.authorId && !headers['x-test-user-id']) {
    headers['x-test-user-id'] = bodyObj.authorId;
  }
  
  // For patient/doctor creation, they don't have authorId. Just give them a dummy user ID if none provided.
  if (!headers['x-test-user-id']) {
    headers['x-test-user-id'] = 'test-runner-id';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('Decision Lifecycle', () => {
  let patientId: string;
  let doctorId: string;
  let factId: string;
  
  let hypothesisInterpId: string;
  let confirmedInterpId: string;

  beforeAll(async () => {
    // 1. Setup patient, doctor, fact
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Decision Patient' }),
    });
    patientId = pRes.data.id;

    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Decider', isSupervisor: true }),
    });
    doctorId = dRes.data.id;

    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'lab',
        value: 'A1C 8.5%',
        recordedAt: '2026-04-01T00:00:00Z',
      }),
    });
    factId = fRes.data.id;

    // 2. Create an interpretation that stays Hypothesis
    const hRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Possible Diabetes',
        supportingFactIds: [factId],
        authorId: doctorId,
      }),
    });
    hypothesisInterpId = hRes.data.id;

    // 3. Create another interpretation and Confirm it
    const cRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Confirmed Diabetes Type 2',
        supportingFactIds: [factId],
        authorId: doctorId,
      }),
    });
    confirmedInterpId = cRes.data.id;

    await apiFetch(`/api/interpretation/${confirmedInterpId}/confirm`, {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
    });
  });

  it('rejects decision creation if interpretation is not Confirmed', async () => {
    const res = await apiFetch('/api/decision', {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
      body: JSON.stringify({
        patientId,
        interpretationId: hypothesisInterpId,
        action: 'Start Metformin',
        authorId: doctorId,
      }),
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('not Confirmed');
  });

  it('creates decision successfully if interpretation is Confirmed', async () => {
    const res = await apiFetch('/api/decision', {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
      body: JSON.stringify({
        patientId,
        interpretationId: confirmedInterpId,
        action: 'Start Metformin 500mg',
        authorId: doctorId,
      }),
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('Active');
    expect(res.data.action).toBe('Start Metformin 500mg');
    expect(res.data.interpretationId).toBe(confirmedInterpId);
  });
});
