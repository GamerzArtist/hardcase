import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const env={...process.env,VITE_HARDCASE_MODE:'recorded-demo'};
const root=process.cwd();
const run=(file,args,cwd)=>new Promise((ok,fail)=>{const child=spawn(process.execPath,[file,...args],{cwd,env,stdio:'inherit',windowsHide:true});child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error('Build failed: '+code)));});
await run(resolve(root,'node_modules/typescript/bin/tsc'),['-b'],resolve(root,'apps/web'));
await run(resolve(root,'node_modules/vite/bin/vite.js'),['build','--outDir','dist-demo'],resolve(root,'apps/web'));
