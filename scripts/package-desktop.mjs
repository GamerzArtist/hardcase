import { spawn } from 'node:child_process';
import { mkdir, writeFile, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stageRuntime, root } from './package-runtime.mjs';

const run = (command, args, cwd = root) => new Promise((ok, fail) => { const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true }); child.on('error', fail); child.on('exit', code => code === 0 ? ok() : fail(new Error(`${command} exited ${code}`))); });
if (!process.argv.includes('--skip-build')) {
  await run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json']);
  await run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-b'], join(root, 'apps/web'));
  await run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], join(root, 'apps/web'));
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(root, 'release', `hardcase-windows-x64-${stamp}`);
await mkdir(output, { recursive: true });
const runtime = await stageRuntime(join(output, 'hardcase-runtime'));
// NSIS cannot open long Chromium resource paths. Bundle from a short temporary prefix.
const shortRoot = await mkdtemp(join(tmpdir(), 'hc-'));
const bundleRuntime = join(shortRoot, 'runtime');
await cp(runtime, bundleRuntime, { recursive: true });
const config = { build: { beforeBuildCommand: '' }, bundle: { active: true, targets: ['nsis'], icon: ['icons/32x32.png', 'icons/128x128.png', 'icons/128x128@2x.png', 'icons/icon.ico'], resources: { [bundleRuntime.replaceAll('\\', '/') + '/']: 'hardcase-runtime/' }, windows: { nsis: { installMode: 'currentUser' } } } };
const configFile = join(output, 'tauri-package.json'); await writeFile(configFile, JSON.stringify(config, null, 2));
if (!process.argv.includes('--web-only')) {
  await run(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'build', '--config', configFile], join(root, 'apps/web'));
  await cp(join(root, 'apps/web/src-tauri/target/release/bundle/nsis'), join(output, 'installer'), { recursive: true });
}
console.log(`Release directory: ${output}`);
