const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
driver.getServerInfo().then(info => {
  console.log('Connected', info);
  process.exit(0);
}).catch(err => {
  console.error('Error', err);
  process.exit(1);
});
