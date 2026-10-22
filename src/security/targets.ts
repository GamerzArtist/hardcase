import type { ScenarioDefinition, Target } from '../domain/models.js';

export class SafetyError extends Error { readonly code = 'SAFETY_REJECTED'; }
export function canonicalUrl(raw: string, forbiddenPorts: number[] = []): URL {
  if (raw.length > 2048 || /[\s\\]/.test(raw)) throw new SafetyError('Malformed target URL');
  const match = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):([0-9]{2,5})(?:[/?#]|$)/.exec(raw);
  if (!match) throw new SafetyError('Only explicit HTTP loopback addresses and ports are supported');
  const url = new URL(raw);
  const port = Number(match[2]);
  if (port < 1024 || port > 65535 || forbiddenPorts.includes(port)) throw new SafetyError('Target port is not permitted');
  if (url.username || url.password || url.hash) throw new SafetyError('Credentials and fragments are not permitted in targets');
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url;
}
export function validateTarget(target: Target, forbiddenPorts: number[] = []): Target {
  if (target.kind === 'fixture') return target;
  const base = canonicalUrl(target.baseUrl, forbiddenPorts);
  const origins = target.approvedOrigins.map(raw => {
    const url = canonicalUrl(raw, forbiddenPorts);
    if (url.pathname !== '/' || url.search) throw new SafetyError('Approved origins must contain only scheme, host, and port');
    return url.origin;
  });
  if (!origins.includes(base.origin)) throw new SafetyError('Base URL origin must be explicitly approved');
  return { ...target, baseUrl: base.href, approvedOrigins: [...new Set(origins)] };
}
export function assertAllowedUrl(raw: string, approvedOrigins: string[], forbiddenPorts: number[] = []): URL {
  const url = canonicalUrl(raw, forbiddenPorts);
  // A browser must not resolve aliases differently from the controller. Inputs are canonicalized before execution.
  if (new URL(raw).hostname === 'localhost') throw new SafetyError('Runtime requests must use the pinned numeric loopback address');
  if (!approvedOrigins.includes(url.origin)) throw new SafetyError('Request or redirect leaves the approved origins');
  return url;
}
export function validateScenario(scenario: ScenarioDefinition): void {
  const ids = new Set<string>();
  for (const assertion of scenario.assertions) {
    if (ids.has(assertion.id)) throw new SafetyError('Duplicate assertion ID');
    ids.add(assertion.id);
    if (['visible', 'text', 'count', 'value'].includes(assertion.kind) && !assertion.selector) throw new SafetyError('Assertion requires a selector');
    if (assertion.kind === 'count' && (!Number.isSafeInteger(assertion.expected) || Number(assertion.expected) < 0)) throw new SafetyError('Count assertion requires a nonnegative integer');
    if (['text', 'value', 'url'].includes(assertion.kind) && typeof assertion.expected !== 'string') throw new SafetyError('Assertion requires expected text');
    if (assertion.selector) validateSelector(assertion.selector);
  }
  const used = new Set<string>();
  for (const step of scenario.steps) {
    if ('selector' in step) validateSelector(step.selector);
    if (step.action === 'assert') {
      if (!ids.has(step.assertionId)) throw new SafetyError('Unknown assertion reference');
      used.add(step.assertionId);
    }
    if (step.action === 'navigate' && (!scenario.safetyPermissions.includes('navigation') || /%2f|%5c|%00/i.test(step.path))) throw new SafetyError('Unsafe navigation or missing permission');
    if (['fill', 'click', 'press'].includes(step.action) && !scenario.safetyPermissions.includes('form-interaction')) throw new SafetyError('Interaction permission is required');
  }
  if ([...ids].some(id => !used.has(id))) throw new SafetyError('Every declared assertion must be executed');
  if (scenario.requiredFixtures.length) throw new SafetyError('Custom scenarios cannot request privileged fixtures');
}
function validateSelector(selector: string): void {
  // Deliberately a CSS-only subset. No custom selector engines, scripts, XPath or locator chaining.
  if (/>>|\b(?:xpath|text|internal|javascript)\s*=|[\r\n\x00]|:has\(/i.test(selector)) throw new SafetyError('Only simple CSS selectors are supported');
}
