const fs = require('fs');
async function run() {
  const loginRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=doctor%40clinic.local&password=password123&redirect=false"
  });
  const cookies = loginRes.headers.get("set-cookie");
  console.log("Logged in:", loginRes.status);
  
  const formData = new FormData();
  const fileData = new Blob([fs.readFileSync("package.json")]);
  formData.append("file", fileData, "package.json");
  
  const uploadRes = await fetch("http://localhost:3000/api/upload", {
    method: "POST",
    headers: { "Cookie": cookies },
    body: formData
  });
  
  console.log("Upload res:", uploadRes.status);
  console.log("Body:", await uploadRes.text());
}
run();
