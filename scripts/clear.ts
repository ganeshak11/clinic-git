import { getDriver } from '../src/lib/neo4j';
import 'dotenv/config';

async function clear() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log('Clearing database...');
    await session.run('MATCH (n) DETACH DELETE n');
    
    console.log('Re-creating constraints...');
    const queries = [
      'CREATE CONSTRAINT doctor_id IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE',
      'CREATE CONSTRAINT doctor_email IF NOT EXISTS FOR (d:Doctor) REQUIRE d.email IS UNIQUE',
      'CREATE CONSTRAINT patient_id IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT fact_id IF NOT EXISTS FOR (f:Fact) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT interpretation_id IF NOT EXISTS FOR (i:Interpretation) REQUIRE i.id IS UNIQUE',
      'CREATE CONSTRAINT branch_id IF NOT EXISTS FOR (b:Branch) REQUIRE b.id IS UNIQUE',
      'CREATE CONSTRAINT decision_id IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE'
    ];
    for (const q of queries) {
      await session.run(q);
    }
    console.log('Database cleared and constraints applied.');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

clear();
