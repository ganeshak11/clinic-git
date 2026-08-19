import { getDriver } from '../src/lib/neo4j';
import bcrypt from 'bcrypt';
import 'dotenv/config';

async function seed() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log('Seeding doctors...');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const priyaId = 'dr-priya';
    await session.run(
      `CREATE (d:Doctor { id: $id, name: $name, email: $email, passwordHash: $passwordHash, isSupervisor: false })`,
      { id: priyaId, name: 'Dr. Priya Sharma', email: 'psharma@clinic.local', passwordHash }
    );

    const jamesId = 'dr-james';
    await session.run(
      `CREATE (d:Doctor { id: $id, name: $name, email: $email, passwordHash: $passwordHash, isSupervisor: true })`,
      { id: jamesId, name: 'Dr. James Chen', email: 'jchen@clinic.local', passwordHash }
    );

    console.log('Seeding patient...');
    const patientId = 'P-12345';
    await session.run(
      `CREATE (p:Patient { 
         id: $id, 
         name: $name, 
         age: $age,
         gender: $gender,
         weight: $weight,
         height: $height,
         createdAt: datetime() 
       })`,
      { id: patientId, name: 'Maria Santos', age: 45, gender: 'Female', weight: '68 kg', height: '165 cm' }
    );

    console.log('Seeding facts...');
    const facts = [
      { id: 'f1', type: 'lab', value: 'CBC - WBC 12.3 × 10⁹/L (elevated)', date: '2026-01-15T08:00:00Z' },
      { id: 'f2', type: 'imaging', value: 'CT Chest — 2.1cm left upper lobe lesion, spiculated margins', date: '2026-01-16T10:00:00Z' },
      { id: 'f3', type: 'lab', value: 'Sputum AFB smear — negative', date: '2026-01-18T09:00:00Z' },
      { id: 'f4', type: 'lab', value: 'Serum CEA — 8.4 ng/mL (elevated)', date: '2026-01-19T14:00:00Z' },
      { id: 'f5', type: 'vital', value: 'Oxygen saturation 94% on room air', date: '2026-01-15T08:30:00Z' }
    ];

    for (const fact of facts) {
      await session.run(
        `
        MATCH (p:Patient {id: $patientId})
        CREATE (f:Fact {
          id: $factId,
          patientId: $patientId,
          type: $type,
          value: $value,
          recordedAt: $date
        })
        CREATE (p)-[:HAS_FACT]->(f)
        `,
        { patientId, factId: fact.id, type: fact.type, value: fact.value, date: fact.date }
      );
    }

    console.log('Seeding branch and interpretations...');
    const branchId = 'b1';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (d:Doctor {id: $doctorId})
      CREATE (b:Branch {
        id: $branchId,
        patientId: $patientId,
        question: $question,
        status: 'Open',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_BRANCH]->(b)
      CREATE (d)-[:CREATED]->(b)
      `,
      { patientId, doctorId: jamesId, branchId, question: 'Cause of left upper lobe lesion' }
    );

    const interp1Id = 'i1';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (b:Branch {id: $branchId})
      MATCH (d:Doctor {id: $doctorId})
      CREATE (i:Interpretation {
        id: $id,
        patientId: $patientId,
        branchId: $branchId,
        authorId: $doctorId,
        summary: $summary,
        status: 'Hypothesis',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_INTERPRETATION]->(i)
      CREATE (b)-[:CONTAINS]->(i)
      CREATE (i)-[:AUTHORED_BY]->(d)
      WITH i
      MATCH (f:Fact) WHERE f.id IN ['f1', 'f2', 'f5'] 
      CREATE (f)-[:SUPPORTS]->(i)
      `,
      { patientId, branchId, doctorId: priyaId, id: interp1Id, summary: 'Pulmonary tuberculosis' }
    );

    const interp2Id = 'i2';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (b:Branch {id: $branchId})
      MATCH (d:Doctor {id: $doctorId})
      CREATE (i:Interpretation {
        id: $id,
        patientId: $patientId,
        branchId: $branchId,
        authorId: $doctorId,
        summary: $summary,
        status: 'Hypothesis',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_INTERPRETATION]->(i)
      CREATE (b)-[:CONTAINS]->(i)
      CREATE (i)-[:AUTHORED_BY]->(d)
      WITH i
      MATCH (f:Fact) WHERE f.id IN ['f2', 'f4'] 
      CREATE (f)-[:SUPPORTS]->(i)
      `,
      { patientId, branchId, doctorId: jamesId, id: interp2Id, summary: 'Primary lung carcinoma (adenocarcinoma)' }
    );

    const interp3Id = 'i3';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (b:Branch {id: $branchId})
      MATCH (d:Doctor {id: $doctorId})
      CREATE (i:Interpretation {
        id: $id,
        patientId: $patientId,
        branchId: $branchId,
        authorId: $doctorId,
        summary: $summary,
        status: 'Hypothesis',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_INTERPRETATION]->(i)
      CREATE (b)-[:CONTAINS]->(i)
      CREATE (i)-[:AUTHORED_BY]->(d)
      WITH i
      MATCH (f:Fact) WHERE f.id IN ['f1', 'f2'] 
      CREATE (f)-[:SUPPORTS]->(i)
      `,
      { patientId, branchId, doctorId: priyaId, id: interp3Id, summary: 'Pulmonary fungal infection (aspergillosis)' }
    );

    console.log('Resolving branch...');
    await session.run(
      `
      MATCH (b:Branch {id: $branchId})
      MATCH (b)-[:CONTAINS]->(i:Interpretation)
      SET b.status = 'Closed'
      WITH i, CASE WHEN i.id = $confirmId THEN 'Confirmed' ELSE 'RuledOut' END AS newStatus
      SET i.status = newStatus
      `,
      { branchId, confirmId: interp2Id }
    );

    console.log('Superseding interpretation...');
    const interp2RefinedId = 'i2-refined';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (old:Interpretation {id: $oldId})
      MATCH (d:Doctor {id: $doctorId})
      SET old.status = 'Superseded'
      CREATE (newI:Interpretation {
        id: $newId,
        patientId: $patientId,
        authorId: $doctorId,
        supersedesId: $oldId,
        summary: $summary,
        status: 'Confirmed',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_INTERPRETATION]->(newI)
      CREATE (newI)-[:AUTHORED_BY]->(d)
      CREATE (newI)-[:SUPERSEDES]->(old)
      WITH newI, old
      MATCH (f:Fact)-[:SUPPORTS]->(old)
      CREATE (f)-[:SUPPORTS]->(newI)
      `,
      { patientId, oldId: interp2Id, doctorId: jamesId, newId: interp2RefinedId, summary: 'Non-small cell lung cancer, Stage IIA (T2aN0M0)' }
    );

    console.log('Adding decision...');
    const decisionId = 'dec1';
    await session.run(
      `
      MATCH (p:Patient {id: $patientId})
      MATCH (i:Interpretation {id: $interpId})
      MATCH (d:Doctor {id: $doctorId})
      CREATE (dec:Decision {
        id: $id,
        patientId: $patientId,
        interpretationId: $interpId,
        authorId: $doctorId,
        action: $action,
        status: 'Active',
        createdAt: datetime()
      })
      CREATE (p)-[:HAS_DECISION]->(dec)
      CREATE (dec)-[:AUTHORED_BY]->(d)
      CREATE (dec)-[:BASED_ON]->(i)
      `,
      { patientId, interpId: interp2RefinedId, doctorId: jamesId, id: decisionId, action: 'Refer for surgical lobectomy and adjuvant chemotherapy — cisplatin/pemetrexed' }
    );

    console.log('✅ Demo data seeded successfully!');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

seed();
