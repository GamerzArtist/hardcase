import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exists = path => access(path).then(() => true, () => false);
export async function stageRuntime(destination, { includeWeb = true } = {}) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This release packager currently supports Windows x64 only.');
  const runtime = resolve(destination);
  await mkdir(runtime, { recursive: false });
  const manifest = { at: new Date().toISOString(), platform: process.platform, architecture: process.arch, node: process.version, packages: [], browsers: [] };
  const sourcePackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(join(runtime, 'package.json'), JSON.stringify({ name: 'hardcase-runtime', version: sourcePackage.version, private: true, type: 'module', dependencies: sourcePackage.dependencies }, null, 2));
  await cp(join(root, 'dist'), join(runtime, 'dist'), { recursive: true });
  await mkdir(join(runtime, 'scripts'));
  for (const name of ['local-app.mjs', 'desktop-engine.mjs']) await cp(join(root, 'scripts', name), join(runtime, 'scripts', name));
  if (includeWeb) { await access(join(root, 'apps/web/dist/index.html')); await cp(join(root, 'apps/web/dist'), join(runtime, 'apps/web/dist'), { recursive: true }); }
  await cp(join(root, 'examples/reviewboard'), join(runtime, 'examples/reviewboard'), { recursive: true });
  await cp(process.execPath, join(runtime, 'node.exe'));
  manifest.nodeSha256 = createHash('sha256').update(await readFile(process.execPath)).digest('hex');
  const nodeLicense = ['LICENSE', 'LICENSE.txt'].map(name => join(dirname(process.execPath), name));
  for (const path of nodeLicense) if (await exists(path)) { await cp(path, join(runtime, 'NODE-LICENSE.txt')); break; }
  if (!await exists(join(runtime, 'NODE-LICENSE.txt'))) {
    const url = `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Cannot obtain the exact Node redistribution license.');
    await writeFile(join(runtime, 'NODE-LICENSE.txt'), await response.text());
    manifest.nodeLicenseSource = url;
  }

  // Copy the exact installed dependency graph, including nested versions, with licenses.
  // No package install scripts or registry downloads run during packaging.
  const seen = new Set();
  async function copyDependency(name, from, optional = false) {
    let packageRoot;
    try {
      const require = createRequire(join(from, 'package.json'));
      try { packageRoot = dirname(require.resolve(`${name}/package.json`)); }
      catch {
        let candidate = dirname(require.resolve(name));
        for (;;) {
          if (await exists(join(candidate, 'package.json')) && JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8')).name === name) { packageRoot = candidate; break; }
          const parent = dirname(candidate); if (parent === candidate) throw new Error(`Cannot resolve package root for ${name}`); candidate = parent;
        }
      }
    } catch (error) { if (optional) return; throw error; }
    if (seen.has(packageRoot)) return; seen.add(packageRoot);
    const path = relative(join(root, 'node_modules'), packageRoot);
    if (path.startsWith('..') || resolve(join(root, 'node_modules'), path) !== packageRoot) throw new Error(`Dependency escapes installed workspace: ${name}`);
    const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    await cp(packageRoot, join(runtime, 'node_modules', path), { recursive: true, filter: source => source === packageRoot || !relative(packageRoot, source).split(sep).includes('node_modules') });
    manifest.packages.push({ name: pkg.name, version: pkg.version, path: `node_modules/${path.replaceAll(sep, '/')}` });
    for (const dependency of Object.keys(pkg.dependencies ?? {})) await copyDependency(dependency, packageRoot);
    for (const dependency of Object.keys(pkg.optionalDependencies ?? {})) await copyDependency(dependency, packageRoot, true);
  }
  for (const dependency of Object.keys(sourcePackage.dependencies)) await copyDependency(dependency, root);
  const registry = JSON.parse(await readFile(join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'));
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH) : join(process.env.LOCALAPPDATA, 'ms-playwright');
  for (const name of ['chromium', 'chromium-headless-shell', 'ffmpeg', 'winldd']) {
    const browser = registry.browsers.find(item => item.name === name);
    if (!browser) continue;
    const folder = `${name.replaceAll('-', '_')}-${browser.revision}`;
    const source = join(cache, folder);
    if (!await exists(source)) throw new Error(`Missing installed browser component ${folder}. Run npx playwright install chromium.`);
    await cp(source, join(runtime, 'browsers', folder), { recursive: true });
    manifest.browsers.push({ name, revision: browser.revision, version: browser.browserVersion ?? null });
  }
  await writeFile(join(runtime, 'runtime-manifest.json'), JSON.stringify(manifest, null, 2));
  const launcher = `$ErrorActionPreference = 'Stop'\n$releaseRoot = $PSScriptRoot\n$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $releaseRoot 'browsers'\nif (-not $env:ENGINE_DATA_DIR) { $env:ENGINE_DATA_DIR = Join-Path $env:LOCALAPPDATA 'hardcase/web' }\nPush-Location $releaseRoot\ntry { & (Join-Path $releaseRoot 'node.exe') (Join-Path $releaseRoot 'scripts/local-app.mjs'); exit $LASTEXITCODE } finally { Pop-Location }\n`;
  await writeFile(join(runtime, 'Start-Hardcase.ps1'), launcher);
  await writeFile(join(runtime, 'Start-Hardcase.cmd'), '@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nset "PLAYWRIGHT_BROWSERS_PATH=%~dp0browsers"\r\nif not defined ENGINE_DATA_DIR set "ENGINE_DATA_DIR=%LOCALAPPDATA%\\hardcase\\web"\r\n"%~dp0node.exe" "%~dp0scripts\\local-app.mjs"\r\nif errorlevel 1 pause\r\n');
  await mkdir(join(runtime, 'licenses'));
  const webPackage = JSON.parse(await readFile(join(root, 'apps/web/package.json'), 'utf8'));
  const notices = ['Hardcase third-party materials', '', 'Backend package licenses remain in node_modules. Chromium and Node include their own license files. Frontend dependency licenses are copied below when supplied by the installed package.', ''];
  for (const name of Object.keys(webPackage.dependencies ?? {})) {
    const packageRoot = join(root, 'node_modules', name);
    if (!await exists(join(packageRoot, 'package.json'))) continue;
    const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    notices.push(`${name}@${pkg.version}: ${typeof pkg.license === 'string' ? pkg.license : 'See package license'}`);
    for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'OFL.txt']) {
      if (await exists(join(packageRoot, file))) await cp(join(packageRoot, file), join(runtime, 'licenses', `${name.replaceAll('/', '__')}-${file}`));
    }
  }
  const vendorLicense = join(root, 'apps/web/src/components/effects/vendor/LICENSE.md');
  if (await exists(vendorLicense)) await cp(vendorLicense, join(runtime, 'licenses/frontend-vendor-LICENSE.md'));
  await writeFile(join(runtime, 'THIRD-PARTY-NOTICES.txt'), notices.join('\r\n'));
  await writeFile(join(runtime, 'README.txt'), 'Hardcase local web release for Windows x64\r\n\r\nRun in PowerShell: powershell -File .\\Start-Hardcase.ps1\r\nOpen http://127.0.0.1:4327/app after the ready message. Ctrl+C stops the application.\r\nNode, Chromium, the backend and frontend are included. No npm install or API key is required.\r\nHistory is saved in %LOCALAPPDATA%\\hardcase\\web. Keep its session.json and raw traces private.\r\nSet HARDCASE_WEB_PORT to another local port if 4327 is occupied.\r\nThis is a local application, not a hosted scanner. Public and private-LAN targets remain unsupported.\r\n');
  console.log(`Staged ${manifest.packages.length} runtime packages and ${manifest.browsers.length} browser components: ${runtime}`);
  return runtime;
}
