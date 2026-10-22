// Test-only worker. Never selectable through the public API or environment configuration.
import { chromium } from 'playwright';
process.on('message', async message => {
  if (message.type === 'cancel') return; // Prove parent force-cleanup when a child does not cooperate.
  if (message.type !== 'start') return;
  const mode = message.input.request.goals;
  if (mode === 'crash-with-browser') {
    const server = await chromium.launchServer({ headless: true, host: '127.0.0.1' });
    process.send({ type: 'browser', pid: server.process().pid });
    setTimeout(() => process.exit(47), 100);
  } else if (mode === 'hang' || mode === 'heartbeat-loss') {
    setInterval(() => {}, 1000);
  } else {
    process.send({ type: 'ready', environment: { engineVersion: '0.1.0', nodeVersion: process.version, platform: process.platform, targetKind: 'fixture', isolated: true } });
    setTimeout(() => { process.send({ type: 'done', partial: false }, () => process.exit(0)); }, 150);
  }
});
