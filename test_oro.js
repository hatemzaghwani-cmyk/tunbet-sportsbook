const https = require('https');

const ORO_API = "https://bs.sxvwlkohlv.com/api/v2";
const ORO_CLIENT_ID = "Hatem1_TND";
const ORO_CLIENT_SECRET = "JdYysA2TS7K3xzIYJoOlRn2z9i9XWk57";

async function test() {
  console.log("Probing OroPlay API (bs.sxvwlkohlv.com)...");
  const d = JSON.stringify({ clientId: ORO_CLIENT_ID, clientSecret: ORO_CLIENT_SECRET });
  const u = new URL(ORO_API + '/auth/createtoken');
  
  const req = https.request({ 
    hostname: u.hostname, 
    path: u.pathname, 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } 
  }, (res) => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      console.log("Status:", res.statusCode);
      console.log("Body:", b);
    });
  });
  req.on('error', e => console.error("Error:", e));
  req.write(d);
  req.end();
}

test();
