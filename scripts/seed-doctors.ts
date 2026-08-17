import { getDriver } from '../src/lib/neo4j';
import bcrypt from 'bcrypt';
import 'dotenv/config'; // requires dotenv to run the script standalone

async function seedDoctors() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log('Seeding doctors...');

    // Clear existing doctors
    await session.run('MATCH (d:Doctor) DETACH DELETE d');

    // Create a unique constraint on Doctor email (Neo4j 5 syntax)
    await session.run('CREATE CONSTRAINT doctor_email IF NOT EXISTS FOR (d:Doctor) REQUIRE d.email IS UNIQUE');

    const passwordHash = await bcrypt.hash('password123', 10);

    // Invariant #5: Parameterized Cypher
    await session.run(
      `
      CREATE (d:Doctor {
        id: randomUUID(),
        name: $name,
        email: $email,
        passwordHash: $passwordHash,
        isSupervisor: $isSupervisor
      })
      `,
      {
        name: 'Dr. John Smith',
        email: 'dr.smith@clinic.local',
        passwordHash,
        isSupervisor: true,
      }
    );

    console.log('Successfully seeded Dr. John Smith (dr.smith@clinic.local / password123)');
  } catch (error) {
    console.error('Error seeding doctors:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedDoctors();
