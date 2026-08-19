import { getDriver } from '../src/lib/neo4j';
import 'dotenv/config';

async function seedPatient() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log('Seeding patient...');
    const result = await session.run(
      `
      CREATE (p:Patient {
        id: $id,
        name: $name
      })
      RETURN p
      `,
      {
        id: 'P-12345',
        name: 'Jane Doe',
      }
    );
    console.log('Successfully seeded patient. Secret ID: P-12345 (Name: Jane Doe)');
  } catch (error) {
    console.error('Error seeding patient:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedPatient();
