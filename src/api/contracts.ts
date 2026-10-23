import { z } from 'zod';
import { CreateRunSchema, EvidenceSchema, EventSchema, RunSchema, RunStateSchema, ScenarioSchema, TargetSchema, ScenarioResultSchema } from '../domain/models.js';
import { IdempotencyKeySchema } from './idempotency.js';
import { ReportSchema } from '../reporting/reports.js';

export const IdParamsSchema = z.strictObject({ id: z.string().uuid() });
export const EvidenceParamsSchema = z.strictObject({ id: z.string().uuid(), artifactId: z.string().uuid() });
export const ReplaySchema = z.strictObject({ scenarioIds: z.array(z.string().min(1).max(80)).min(1).max(20) });
export const CompareSchema = z.strictObject({ before: z.string().uuid(), after: z.string().uuid() });
export const ComparisonSchema = z.strictObject({ before: z.string(), after: z.string(), changes: z.array(z.strictObject({ scenarioId: z.string(), before: z.string(), after: z.string(), change: z.enum(['not_comparable', 'resolved_in_this_run', 'regression', 'unchanged', 'changed']) })) });
export const ErrorSchema = z.strictObject({ error: z.string(), message: z.string() });
export const HealthSchema = z.strictObject({ ok: z.boolean(), version: z.string() });
export const ReadinessSchema = HealthSchema.extend({ checks: z.strictObject({ storage: z.boolean(), worker: z.boolean(), chromium: z.boolean() }), issues: z.array(z.strictObject({ code: z.string(), message: z.string() })) });
export const EventPageSchema = z.strictObject({ events: z.array(EventSchema), nextCursor: z.number().int(), hasMore: z.boolean(), terminal: z.boolean(), state: RunStateSchema });
export const RecipeSchema = z.strictObject({
  id: z.string(), version: z.union([z.literal(1), z.literal(2)]), title: z.string(), level: z.number().int(), category: z.string(),
  targetKinds: z.array(z.enum(['fixture', 'loopback'])), prerequisites: z.array(z.string()), requiredFixtures: z.array(z.string()),
  steps: z.array(z.string()), expectedBehavior: z.string(), assertions: z.array(z.string()), safetyPermissions: z.array(z.string()),
  budget: z.record(z.string(), z.number()), cleanup: z.array(z.string()), evidenceRequirements: z.array(z.string()), replayable: z.boolean(), limitations: z.array(z.string()),
});
export const CapabilitiesSchema = z.strictObject({
  version: z.string(), apiVersion: z.literal('v1'), levels: z.array(z.strictObject({ level: z.number(), name: z.string(), targetKinds: z.array(z.string()) })),
  targetKinds: z.array(z.string()), aiOptional: z.boolean(), aiConfigured: z.boolean(),
  limits: z.record(z.string(), z.number()), restrictions: z.array(z.string()),
});
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const result = z.toJSONSchema(schema, { target: 'draft-07', io: 'input' }); delete result.$schema; return result;
};
const components = { CreateRun: CreateRunSchema, Run: RunSchema, Target: TargetSchema, Scenario: ScenarioSchema, ScenarioResult: ScenarioResultSchema,
  Evidence: EvidenceSchema, Event: EventSchema, Report: ReportSchema, Error: ErrorSchema, Replay: ReplaySchema, ComparisonRequest: CompareSchema,
  Comparison: ComparisonSchema, Health: HealthSchema, Readiness: ReadinessSchema, EventPage: EventPageSchema, Recipe: RecipeSchema, Capabilities: CapabilitiesSchema,
};
const ref = (name: string): Record<string, unknown> => ({ $ref: `#/components/schemas/${name}` });
const array = (name: string): Record<string, unknown> => ({ type: 'array', items: ref(name) });
type Endpoint = { method: string; path: string; summary: string; body?: string; response: Record<string, unknown>; code?: number; media?: string; query?: Array<{ name: string; schema: Record<string, unknown> }> };
const endpoints: Endpoint[] = [
  { method: 'get', path: '/v1/health', summary: 'Local liveness; no authentication required', response: ref('Health') },
  { method: 'get', path: '/v1/ready', summary: 'Authenticated storage, worker and actual Chromium launch readiness; cached 30 seconds', response: ref('Readiness') },
  { method: 'get', path: '/v1/capabilities', summary: 'Supported execution profiles and hard caps', response: ref('Capabilities') },
  { method: 'post', path: '/v1/targets/validate', summary: 'Validate and canonicalize an owned local target', body: 'Target', response: ref('Target') },
  { method: 'get', path: '/v1/recipes', summary: 'Executable built-in recipe definitions', response: array('Recipe') },
  { method: 'get', path: '/v1/scenarios/schema', summary: 'Allowlisted custom scenario JSON Schema', response: { type: 'object' } },
  { method: 'post', path: '/v1/scenarios/validate', summary: 'Validate schema and execution semantics', body: 'Scenario', response: ref('Scenario') },
  { method: 'post', path: '/v1/runs', summary: 'Queue a validated run', body: 'CreateRun', response: ref('Run'), code: 202 },
  { method: 'get', path: '/v1/runs', summary: 'List newest runs with pagination', response: array('Run'), query: [{ name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { name: 'offset', schema: { type: 'integer', minimum: 0 } }] },
  { method: 'get', path: '/v1/runs/{id}', summary: 'Inspect durable execution status and results', response: ref('Run') },
  { method: 'post', path: '/v1/runs/{id}/cancel', summary: 'Idempotent cancellation; terminal state follows cleanup', response: ref('Run'), code: 202 },
  { method: 'get', path: '/v1/runs/{id}/events', summary: 'SSE, resumable with Last-Event-ID or after cursor; closes after terminal state', response: { type: 'string', 'x-event-schema': ref('Event') }, media: 'text/event-stream', query: [{ name: 'after', schema: { type: 'integer', minimum: 0 } }] },
  { method: 'get', path: '/v1/runs/{id}/events/poll', summary: 'Bounded cursor page of durable events for polling and reconnect fallback', response: ref('EventPage'), query: [{ name: 'after', schema: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } }, { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } }] },
  { method: 'get', path: '/v1/runs/{id}/findings', summary: 'Assertion-backed scenario results including passes and inconclusive cases', response: array('ScenarioResult') },
  { method: 'get', path: '/v1/runs/{id}/evidence', summary: 'Artifact metadata with stable IDs and SHA-256', response: array('Evidence') },
  { method: 'get', path: '/v1/runs/{id}/evidence/{artifactId}', summary: 'Authenticated local artifact download; PNG, ZIP or JSON', response: { type: 'string', format: 'binary' }, media: 'application/octet-stream' },
  { method: 'get', path: '/v1/runs/{id}/report', summary: 'Structured or Markdown report; optionally compare to a compatible baseline', response: ref('Report'), query: [{ name: 'format', schema: { type: 'string', enum: ['json', 'markdown'] } }, { name: 'compareTo', schema: { type: 'string', format: 'uuid' } }] },
  { method: 'post', path: '/v1/runs/{id}/replay', summary: 'Replay eligible fixture scenarios with a fresh isolated state', body: 'Replay', response: ref('Run'), code: 202 },
  { method: 'post', path: '/v1/compare', summary: 'Compare compatible terminal runs; fixture variants may differ', body: 'ComparisonRequest', response: ref('Comparison') },
  { method: 'get', path: '/v1/openapi.json', summary: 'Complete versioned API description', response: { type: 'object' } },
];
export function openApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of endpoints) {
    const parameters: unknown[] = [...e.path.matchAll(/\{(\w+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }));
    parameters.push(...(e.query ?? []).map(p => ({ ...p, in: 'query', required: false })));
    if (e.media === 'text/event-stream') parameters.push({ name: 'Last-Event-ID', in: 'header', required: false, schema: { type: 'string', pattern: '^[0-9]+$' } });
    const idempotent = e.method === 'post' && (e.path === '/v1/runs' || e.path.endsWith('/replay'));
    if (idempotent) parameters.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: jsonSchema(IdempotencyKeySchema), description: 'Same validated body and replay parent reuses its persisted run, even after restart. Different body is 409. Keep the key for uncertain retries; use a new key for a deliberate new run.' });
    const responses: Record<string, unknown> = { [e.code ?? 200]: { description: 'Success', content: { [e.media ?? 'application/json']: { schema: e.response } } } };
    if (idempotent) (responses['202'] as Record<string, unknown>).headers = { 'Idempotency-Replayed': { schema: { type: 'string', enum: ['true', 'false'] } } };
    if (e.path.endsWith('/report')) (responses['200'] as { content: Record<string, unknown> }).content['text/markdown'] = { schema: { type: 'string' } };
    for (const code of [400, 401, 403, 404, 409, 429, 500]) responses[code] = { description: 'Structured error', content: { 'application/json': { schema: ref('Error') } } };
    if (e.path === '/v1/ready') responses['503'] = { description: 'Dependency unavailable; inspect issue codes and retry after remedy', content: { 'application/json': { schema: ref('Readiness') } } };
    (paths[e.path] ??= {})[e.method] = { summary: e.summary, operationId: `${e.method}_${e.path.replace(/[^a-zA-Z0-9]/g, '_')}`, parameters, responses,
      ...(e.path.endsWith('/health') ? { security: [] } : {}), ...(e.body ? { requestBody: { required: true, content: { 'application/json': { schema: ref(e.body) } } } } : {}),
    };
  }
  return { openapi: '3.1.0', info: { title: 'Adversarial application testing engine', version: '0.1.0' }, servers: [{ url: 'http://127.0.0.1:4318' }], security: [{ localSession: [] }], paths,
    components: { securitySchemes: { localSession: { type: 'http', scheme: 'bearer', description: 'Local execution token; never put it in a URL or persist it in browser localStorage.' } }, schemas: Object.fromEntries(Object.entries(components).map(([name, schema]) => [name, jsonSchema(schema)])) },
  };
}
