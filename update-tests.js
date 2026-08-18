const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'src/app/api/__tests__');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace x-test-bypass
  content = content.replace(/'x-test-bypass':\s*'true',?/g, "'x-test-auth-secret': 'test-secret',");

  // Replace x-user-id with x-test-user-id
  content = content.replace(/'x-user-id'/g, "'x-test-user-id'");
  
  // Replace x-is-supervisor with x-test-is-supervisor
  content = content.replace(/'x-is-supervisor'/g, "'x-test-is-supervisor'");

  // Also fix where they create something without x-test-user-id but authorId is in body.
  // The endpoints now require x-test-user-id for interpretation/decision/fact creation.
  // So we should make apiFetch automatically set x-test-user-id to the authorId if present in the body.
  // Actually, we can just update apiFetch to do that.
  content = content.replace(/async function apiFetch\([\s\S]*?return { status: res.status, data };\n}/m, 
`async function apiFetch(path: string, options: RequestInit = {}) {
  const url = \`http://localhost:3000\${path}\`;
  
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
}`);

  fs.writeFileSync(filePath, content);
}

console.log('Updated ' + files.length + ' test files.');
