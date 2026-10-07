'use strict';
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
require('dotenv').config({path:'/opt/cloudmusic/server/.env'});
const {config}=require('/opt/cloudmusic/server/dist/config');
const jwt=require('jsonwebtoken');
const expected=Number(process.argv.find(arg=>arg.startsWith('--tracks='))?.split('=')[1]);
const request=route=>fetch('http://127.0.0.1:3000'+route,{headers:{Authorization:`Bearer ${jwt.sign({username:config.AUTH_USERNAME},config.JWT_SECRET,{expiresIn:'60s'})}`},signal:AbortSignal.timeout(5000)});
async function ready(start) {
  for(let attempt=0;attempt<100;attempt++) {
    try {
      const response=await request('/api/tracks');
      if(response.ok) {
        const tracks=await response.json();assert.equal(tracks.length,expected);
        console.log(JSON.stringify({apiReadyMs:Date.now()-start,tracks:tracks.length}));return;
      }
    } catch(error) { if(error instanceof assert.AssertionError) throw error; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('API did not become ready');
}
async function completed() {
  const deadline=Date.now()+240000;let last=-1;
  while(Date.now()<deadline) {
    const job=await (await request('/api/tracks/scan/status')).json();
    if(job.status==='failed') throw Error('Startup scan failed');
    if(job.status==='completed') {assert.equal(job.found,expected);console.log(JSON.stringify({scanStatus:job.status,found:job.found,reused:job.reused||0,libraryReady:job.libraryReady}));return job;}
    const progress=Math.floor((job.processed||0)/200);
    if(progress!==last){last=progress;console.log(JSON.stringify({scanStatus:job.status,processed:job.processed||0,total:job.total,fromSnapshot:job.fromSnapshot}));}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw Error('Startup scan did not finish');
}
async function verify() {
  await ready(Date.now());await completed();
  if(process.argv.includes('--warm-restart')) {
    const start=Date.now();execFileSync('systemctl',['restart','cloudmusic']);
    await ready(start);const job=await completed();
    assert.equal(job.reused,expected,'A warm restart must reuse unchanged metadata');
  }
}
verify().catch(error=>{console.error(error.message);process.exitCode=1;});
