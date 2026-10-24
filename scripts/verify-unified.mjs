import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { request } from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
const secret = randomBytes(32).toString('hex');
const child = fork('scripts/local-app.mjs', [], { env: {...process.env, HARDCASE_WEB_PORT:'4347', HARDCASE_PUBLIC_ORIGIN:'https://hardcase.example', HARDCASE_GATEWAY_SECRET:secret, ENGINE_DATA_DIR:'.engine/public-ingress-check'}, stdio:['ignore','ignore','ignore','ipc'] });
const ready = new Promise((resolve,reject) => { child.once('message', resolve); child.once('exit', () => reject(new Error('Launcher exited before readiness'))); setTimeout(() => reject(new Error('Readiness timeout')), 15000).unref(); });
async function get(path, headers={}) { return new Promise((resolve,reject) => { const req = request({hostname:'127.0.0.1',port:4347,path,headers:{Host:'hardcase.example',...headers}}, res => { let body='';res.on('data', data => body+=data);res.on('end',()=>resolve({status:res.statusCode,body})); });req.on('error',reject);req.end(); }); }
try {
 await ready;
 assert.equal((await get('/')).status,403);
 const gateway={'X-Hardcase-Gateway':secret};
 assert.equal((await get('/',gateway)).status,200);
 assert.equal((await get('/api/v1/runs',gateway)).status,401);
 const bootstrap=await get('/__hardcase/session',{...gateway,'X-Hardcase-Bootstrap':'1'});
 assert.equal(bootstrap.status,200);
 const session=JSON.parse(bootstrap.body);
 assert.equal(session.origin,'https://hardcase.example/api');
 assert.equal((await get('/api/v1/runs',{...gateway,Authorization:`Bearer ${session.token}`})).status,200);
 assert.equal((await get('/api/v1/runs',{...gateway,Origin:'https://untrusted.example'})).status,403);
 assert.equal((await get('/healthz',gateway)).status,200);
 await mkdir('.engine',{recursive:true});
 await writeFile('.engine/unified-ingress-proof.json',JSON.stringify({gateRejectsUnauthenticated:true,spaServed:true,apiRequiresBearer:true,sameOriginBootstrap:true,authenticatedApi:true,crossOriginRejected:true,ready:true,verifiedAt:new Date().toISOString()},null,2));
 console.log('7 unified ingress assertions passed; credentials were not recorded.');
} finally { child.send({type:'shutdown'}); }
