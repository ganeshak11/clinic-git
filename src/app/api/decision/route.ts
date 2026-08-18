import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const sessionAuth = await getServerSession(authOptions);
  
  let requestingUserId = '';
  if (sessionAuth && sessionAuth.user) {
    requestingUserId = (sessionAuth.user as any).id;
  } else if (process.env.NODE_ENV === 'development') {
    requestingUserId = request.headers.get('x-user-id') || '';
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { patientId, interpretationId, action, authorId } = body;

  // Validate required fields
  if (!patientId || !interpretationId || !action || !authorId) {
    return NextResponse.json(
      { error: 'patientId, interpretationId, action, and authorId are required' },
      { status: 400 },
    );
  }

  // The authorId passed in the body must match the authenticated user for safety,
  // or at least we enforce the authenticated user as the creator.
  // Actually, we'll just use requestingUserId as the authorId if they omit it,
  // but if they supply it, it should match (or just use requestingUserId).
  const finalAuthorId = requestingUserId || authorId;

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    // Verify interpretation exists AND is Confirmed — api-spec.md requirement
    return session.run(
      `MATCH (i:Interpretation {id: $interpretationId})
       WHERE i.status = 'Confirmed'
       MATCH (doc:Doctor {id: $authorId})
       CREATE (d:Decision {
         id: $id,
         patientId: $patientId,
         interpretationId: $interpretationId,
         action: $action,
         status: 'Active',
         authorId: $authorId,
         createdAt: $createdAt
       })
       CREATE (d)-[:BASED_ON]->(i)
       CREATE (d)-[:AUTHORED_BY]->(doc)
       RETURN d`,
      { interpretationId, authorId: finalAuthorId, id, patientId, action, createdAt },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json(
      { error: 'Interpretation not found, not Confirmed, or Doctor not found' },
      { status: 400 },
    );
  }

  return NextResponse.json(record.get('d').properties, { status: 201 });
}
