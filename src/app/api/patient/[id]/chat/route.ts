import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { withReadTransaction } from '@/lib/neo4j';
import { requireAuth, AuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });
  try {
    const { id: patientId } = await params;
    require('fs').appendFileSync('chat-logs.txt', "Received chat request for patient: " + patientId + "\\n");

    await requireAuth(request);

    const body = await request.json();
    const { messages } = body;
    require('fs').appendFileSync('chat-logs.txt', "Parsed messages: " + JSON.stringify(messages) + "\\n");

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // 1. Fetch patient's clinical graph from Neo4j
    const factsResult = await withReadTransaction((tx) =>
      tx.run(`MATCH (p:Patient {id: $patientId})<-[:RELATES_TO]-(f:Fact) RETURN properties(f) AS fact`, { patientId })
    );
    const facts = factsResult.records.map(r => r.get('fact'));

    const interpretationsResult = await withReadTransaction((tx) =>
      tx.run(`MATCH (p:Patient {id: $patientId})<-[:RELATES_TO]-()-[:INTERPRETED_AS]->(i:Interpretation) RETURN properties(i) AS interpretation`, { patientId })
    );
    const interpretations = interpretationsResult.records.map(r => r.get('interpretation'));

    const decisionsResult = await withReadTransaction((tx) =>
      tx.run(`MATCH (p:Patient {id: $patientId})<-[:RELATES_TO]-()-[:LED_TO]->(d:Decision) RETURN properties(d) AS decision`, { patientId })
    );
    const decisions = decisionsResult.records.map(r => r.get('decision'));

    const systemContext = `
You are a highly capable clinical assistant with access to a patient's medical graph.
The user is asking a question about Patient ${patientId}.

FACTS (Observations / Symptoms / Labs):
${JSON.stringify(facts, null, 2)}

INTERPRETATIONS (Diagnoses / Assessments):
${JSON.stringify(interpretations, null, 2)}

DECISIONS (Treatments / Actions):
${JSON.stringify(decisions, null, 2)}

Please answer the user's questions based strictly on this clinical data. Be concise, professional, and analytical.
`;

    require('fs').appendFileSync('chat-logs.txt', "Calling groq...\\n");

    // 2. Call Groq with standard AI SDK
    const result = await streamText({
      model: groq('openai/gpt-oss-120b'),
      system: systemContext,
      messages: messages,
    });

    return result.toTextStreamResponse();
  } catch (e: any) {
    console.error("Chat route error:", e);
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
