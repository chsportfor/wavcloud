const tls = require('node:tls');
const crypto = require('node:crypto');
function query(domain) {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(crypto.randomInt(65536), 0);
  head.writeUInt16BE(0x100, 2); head.writeUInt16BE(1, 4);
  return Buffer.concat([head, ...domain.split('.').map(label => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])), Buffer.from([0,0,1,0,1])]);
}
function response(bytes, sent) {
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== sent.readUInt16BE(0)) throw new Error('Invalid DNS response');
  let offset = 12;
  const skipName = () => { while (bytes[offset]) { if ((bytes[offset] & 0xc0) === 0xc0) { offset += 2; return; } offset += bytes[offset] + 1; } offset++; };
  for (let i=0; i<bytes.readUInt16BE(4); i++) { skipName(); offset += 4; }
  const addresses = [];
  for (let i=0; i<bytes.readUInt16BE(6); i++) {
    skipName(); const type = bytes.readUInt16BE(offset), len = bytes.readUInt16BE(offset+8); offset += 10;
    if (type === 1 && len === 4) addresses.push([...bytes.subarray(offset,offset+4)].join('.'));
    offset += len;
  }
  return { rcode: bytes[3] & 15, answers: bytes.readUInt16BE(6), addresses };
}
function dot(domain) {
  const sent = query(domain);
  return new Promise((resolve,reject) => {
    const socket = tls.connect({ host: process.env.DNS_TEST_HOST || 'adguardfm.duckdns.org', port: 853, servername: 'adguardfm.duckdns.org', rejectUnauthorized: true });
    const timer = setTimeout(() => socket.destroy(new Error('DoT connection timed out')),6000);
    let data = Buffer.alloc(0);
    socket.on('secureConnect', () => { const len = Buffer.alloc(2); len.writeUInt16BE(sent.length); socket.write(Buffer.concat([len,sent])); });
    socket.on('data', part => { data=Buffer.concat([data,part]); if(data.length>=2 && data.length >= data.readUInt16BE(0)+2) { resolve(response(data.subarray(2),sent)); socket.destroy(); } });
    socket.on('error',reject); socket.on('close',() => clearTimeout(timer));
  });
}
async function doh(domain) {
  const sent = query(domain);
  const result = await fetch('https://adguardfm.duckdns.org/dns-query?dns='+sent.toString('base64url'), { headers: { Accept: 'application/dns-message' }, signal: AbortSignal.timeout(10000) });
  if (!result.ok || !result.headers.get('content-type')?.includes('application/dns-message')) throw new Error('DoH HTTP '+result.status);
  return response(Buffer.from(await result.arrayBuffer()),sent);
}
(async () => {
  for(const protocol of [doh,dot]) for(const domain of ['example.com','doubleclick.net']) {
    try { const result = await protocol(domain); if(domain==='example.com' && !result.addresses.some(ip=>ip!=='0.0.0.0')) throw new Error('Normal name did not resolve'); if(domain==='doubleclick.net' && !result.addresses.includes('0.0.0.0')) throw new Error('Ad domain was not blocked'); console.log(JSON.stringify({protocol:protocol.name,domain,...result,pass:true})); }
    catch(error) { console.log(JSON.stringify({protocol:protocol.name,domain,error:error.message,pass:false})); process.exitCode=1; }
  }
})();
