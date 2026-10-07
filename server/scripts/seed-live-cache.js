'use strict';
// Bootstrap a checkpoint from the running service before its first cache-aware restart.
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({path:'/opt/cloudmusic/server/.env'});
const {config}=require('/opt/cloudmusic/server/dist/config');
const jwt=require('jsonwebtoken');
const {writeSnapshot}=require('../dist/services/metadata-snapshots');
async function seed() {
  const cacheDirectory=process.env.LIBRARY_CACHE_DIR || '/opt/cloudmusic/server/.library-cache';
  for(const username of [...new Set([config.AUTH_USERNAME,config.AUTH_TEST_USERNAME])]) {
    const token=jwt.sign({username},config.JWT_SECRET,{expiresIn:'120s'});
    const options={headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)};
    const status=await (await fetch('http://127.0.0.1:3000/api/tracks/scan/status',options)).json();
    if(status.status==='running') throw Error('A library scan is running; defer deployment');
    const response=await fetch('http://127.0.0.1:3000/api/tracks',options);
    if(!response.ok) throw Error('Cannot read the existing library');
    const tracks=await response.json();
    const entries=[];
    for(const track of tracks) {
      const stat=await fs.stat(track.filePath);
      // The old index did not retain timestamps. Force a background metadata refresh.
      entries.push({track:{...track,fileSize:stat.size},size:stat.size,mtimeMs:-1});
    }
    await writeSnapshot(cacheDirectory,username,path.join(config.MUSIC_DIR,username),entries);
    console.log(JSON.stringify({seededTracks:entries.length}));
  }
}
seed().catch(error=>{console.error(error.message);process.exitCode=1;});
