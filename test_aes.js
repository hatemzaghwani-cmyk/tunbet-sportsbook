const https = require('https');
const AES_API = "https://api.aesgamingasia.com";
const AES_TOKEN = "290c38c7-7df8-4913-9f77-2865e31f1edc";

async function testAes() {
  console.log("Testing AES Token...");
  return new Promise((resolve) => {
    const payload = JSON.stringify({ lang: 1 });
    const req = https.request({ 
      hostname: "api.aesgamingasia.com", 
      path: "/v4/game/providers", 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${AES_TOKEN}`,
        'Content-Length': Buffer.byteLength(payload)
      } 
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", b);
        resolve();
      });
    });
    req.on('error', (e) => { console.error("Error:", e); resolve(); });
    req.write(payload);
    req.end();
  });
}

testAes();
