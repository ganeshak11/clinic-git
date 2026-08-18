import { describe, it, expect, beforeAll } from 'vitest';

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

describe('Blame against superseded chains', () => {
  let patientId: string;
  let doctorId: string;
  let factId: string;
  
  let interpAId: string;
  let interpBId: string;
  let interpCId: string;

  beforeAll(async () => {
    // 1. Patient
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chain Patient' }),
    });
    patientId = pRes.data.id;

    // 2. Doctor
    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Chain', isSupervisor: true }),
    });
    doctorId = dRes.data.id;

    // 3. Fact
    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'observation',
        value: 'Fever',
        recordedAt: '2026-03-01T10:00:00Z',
      }),
    });
    factId = fRes.data.id;

    // 4. Interp A
    const aRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'A',
        supportingFactIds: [factId],
        authorId: doctorId,
      }),
    });
    interpAId = aRes.data.id;

    // Confirm A
    await apiFetch(`/api/interpretation/${interpAId}/confirm`, { method: 'POST' });

    // 5. Supersede A with B
    const bRes = await apiFetch(`/api/interpretation/${interpAId}/supersede`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({ newSummary: 'B', supportingFactIds: [factId], reason: 'reason1' }),
    });
    interpBId = bRes.data.id;

    // Confirm B
    await apiFetch(`/api/interpretation/${interpBId}/confirm`, { method: 'POST' });

    // 6. Supersede B with C
    const cRes = await apiFetch(`/api/interpretation/${interpBId}/supersede`, {
      method: 'POST',
      headers: { 'x-user-id': doctorId },
      body: JSON.stringify({ newSummary: 'C', supportingFactIds: [factId], reason: 'reason2' }),
    });
    interpCId = cRes.data.id;
  });

  it('returns both A and B when A was superseded by B and B by C', async () => {
    const res = await apiFetch(`/api/blame/${interpCId}`);
    expect(res.status).toBe(200);
    expect(res.data.interpretation.id).toBe(interpCId);
    
    // We expect B and A in the priorChain.
    const chain = res.data.priorChain;
    expect(chain.length).toBe(2);
    
    // Since neo4j might return them in any order without an explicit ORDER BY,
    // let's just check that both IDs exist in the array.
    const chainIds = chain.map((i: any) => i.id);
    expect(chainIds).toContain(interpBId);
    expect(chainIds).toContain(interpAId);
  });
});

describe('Patient log', () => {
  let patientId: string;
  let factId: string;
  let interpId: string;
  let doctorId: string;

  beforeAll(async () => {
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Log Patient' }),
    });
    patientId = pRes.data.id;

    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Log', isSupervisor: true }),
    });
    doctorId = dRes.data.id;

    // Intentionally create fact with an old recordedAt timestamp
    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'vital',
        value: 'HR 90',
        recordedAt: '2020-01-01T00:00:00Z',
      }),
    });
    factId = fRes.data.id;

    const iRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Log Interp',
        supportingFactIds: [factId],
        authorId: doctorId,
      }),
    });
    interpId = iRes.data.id;
  });

  it('returns entries in chronological order with both types', async () => {
    const res = await apiFetch(`/api/patient/${patientId}/log`);
    expect(res.status).toBe(200);
    
    expect(res.data.length).toBe(2);
    
    // Fact is older (2020), Interpretation is just created (2026+)
    expect(res.data[0].type).toBe('fact');
    expect(res.data[0].nodeId).toBe(factId);
    
    expect(res.data[1].type).toBe('interpretation');
    expect(res.data[1].nodeId).toBe(interpId);
  });

  it('returns 404 for nonexistent patient', async () => {
    const res = await apiFetch(`/api/patient/not-a-real-patient/log`);
    expect(res.status).toBe(404);
  });
});
