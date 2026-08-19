const { driver, auth } = require('neo4j-driver');
const bcrypt = require('bcrypt');

const d = driver('bolt://localhost:7687', auth.basic('neo4j', 'password'));

async function seed() {
  const session = d.session();
  try {
    const hash = await bcrypt.hash('password123', 10);
    await session.run(
      'CREATE (d:Doctor {id: "dr-1", name: "Dr. Alice", email: "alice@clinic.com", passwordHash: $hash, isSupervisor: true})',
      { hash }
    );
    console.log('Doctor created: alice@clinic.com / password123');
  } catch (e) {
    console.error(e);
  } finally {
    await session.close();
    await d.close();
  }
}

seed();
