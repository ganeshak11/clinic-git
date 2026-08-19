async function run() {
  const loginRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=doctor%40clinic.local&password=password123&redirect=false"
  });
  
  // Extract proper cookies
  const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie().join('; ') : loginRes.headers.get('set-cookie').split(',').map(c => c.split(';')[0]).join('; ');
  
  const logRes = await fetch("http://localhost:3000/api/patient/P-12345/log", {
    headers: { "Cookie": cookies }
  });
  
  const data = await logRes.json();
  const interps = data.filter(d => d.type === "interpretation");
  console.log(JSON.stringify(interps, null, 2));
}
run();
