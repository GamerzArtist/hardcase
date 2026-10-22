import { z } from 'zod';
import { ScenarioSchema, type AiAnalysis, type ScenarioResult } from '../domain/models.js';
import { validateScenario } from '../security/targets.js';
import { redact, redactText } from '../security/redact.js';

export interface AiOptions { endpoint?: string; model?: string; apiKey?: string; timeoutMs?: number; maxOutputTokens?: number; enabled?: boolean; fetcher?: typeof fetch; }
const OutputSchema = z.strictObject({ explanation: z.string().max(6000), suggestions: z.array(z.string().max(1000)).max(10), proposedScenarios: z.array(ScenarioSchema).max(3) });
export const disabledAi = (): AiAnalysis => ({ status: 'disabled', explanation: 'Deterministic execution; AI analysis is disabled.', suggestions: [], proposedScenarios: [], requests: 0 });
export async function analyzeRun(input: { goals?: string; results: ScenarioResult[] }, options: AiOptions = {}): Promise<AiAnalysis> {
  const enabled = options.enabled ?? process.env.AI_ENABLED === 'true';
  if (!enabled) return disabledAi();
  const endpoint = options.endpoint ?? process.env.AI_ENDPOINT;
  const model = options.model ?? process.env.AI_MODEL;
  const apiKey = options.apiKey ?? process.env.AI_API_KEY;
  const unavailable = (explanation: string): AiAnalysis => ({ ...disabledAi(), status: 'unavailable', explanation });
  if (!endpoint || !model) return unavailable('AI requires an explicitly configured endpoint and model.');
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))) return unavailable('AI endpoint must be HTTPS or an explicit local HTTP gateway, with no URL credentials.');
  } catch { return unavailable('Invalid AI endpoint configuration.'); }
  const timeoutMs = Math.min(15000, Math.max(100, options.timeoutMs ?? 10000));
  const maxOutputTokens = Math.min(2000, Math.max(100, options.maxOutputTokens ?? 1000));
  try {
    // A small evidence summary only: no screenshots, traces, request bodies, selectors or target credentials.
    const summary = redact(input.results.slice(0, 10).map(r => ({ scenarioId: r.scenarioId, classification: r.classification, expected: r.expectedBehavior.slice(0, 300), observed: r.observedBehavior.slice(0, 300) })));
    const body = JSON.stringify({ protocolVersion: 1, model, maxOutputTokens, maxInputTokens: 8000,
      instruction: 'Explain only observed evidence. Root causes and fixes are hypotheses. Propose only schema-defined browser scenarios; never code. Output explanation, suggestions, proposedScenarios.',
      goals: redactText(input.goals ?? '').slice(0, 2000), findings: summary, scenarioSchema: z.toJSONSchema(ScenarioSchema),
    });
    if (body.length > 32000) throw new Error('AI input exceeds the 32000 character limit');
    const response = await (options.fetcher ?? fetch)(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body,
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Provider HTTP ${response.status}`); }
    const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    if (!reader) throw new Error('Provider returned no body');
    try {
      for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 64000) throw new Error('Provider output exceeds limit'); chunks.push(part.value); }
    } finally { await reader.cancel(); }
    const output = OutputSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    output.proposedScenarios.forEach(validateScenario);
    return { ...output, explanation: redactText(output.explanation), suggestions: output.suggestions.map(redactText), status: 'completed', requests: 1 };
  } catch (error) {
    return { ...disabledAi(), status: 'failed', explanation: `Optional AI analysis failed: ${error instanceof Error ? redactText(error.message) : 'Unknown provider error'}`, requests: 1 };
  }
}
