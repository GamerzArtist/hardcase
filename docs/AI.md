# Optional AI adapter

The deterministic engine and judge demo need no AI provider. Both `useAi: true` on a run and configured `AI_ENABLED=true`, `AI_ENDPOINT`, and `AI_MODEL` are required for analysis. `AI_API_KEY` is optional for an authenticated gateway. No model name, vendor endpoint, account or credit purchase is assumed.

The adapter uses a small vendor-neutral **analysis gateway protocol**, not an untested direct OpenAI/Anthropic API integration. The configured gateway must implement the request/response contract below and enforce requested token limits with its model's tokenizer. No live gateway was used during verification.

```json
{
  "protocolVersion": 1,
  "model": "operator-configured-model",
  "maxInputTokens": 8000,
  "maxOutputTokens": 1000,
  "instruction": "Bounded explanation instruction from engine",
  "goals": "redacted, truncated optional goals",
  "findings": [],
  "scenarioSchema": {}
}
```

The engine makes at most one request per analysis, with a default 10-second timeout (hard maximum 15 seconds), maximum 32,000 input characters, maximum 64,000 response bytes and output-token request capped at 2,000. Requested token caps are not a verified vendor-side billing guarantee; only the selected gateway can enforce its model-specific token/account ceiling. Failed/oversized/invalid responses produce an `unavailable` or `failed` AI status while retaining deterministic results. There are no automatic provider retries.

Response:

```json
{
  "explanation": "Evidence-based explanation; root causes remain hypotheses",
  "suggestions": ["Suggested verification or remediation"],
  "proposedScenarios": []
}
```

At most three proposed scenarios are accepted, each validated against the same strict browser-only schema and semantic safety checks. Unsupported actions or invalid assertion references reject the response. Proposals are **never executed automatically**. Grouping and likely root-cause discussion can appear in the explanation; they cannot change observed assertions, severity, classification, or terminal status. The gateway receives only bounded redacted goals and short finding summaries, not screenshots, traces, target credentials or raw request/response bodies.

Automated tests cover disabled operation with zero calls, missing configuration, valid responses, HTTP failure, invalid JSON, unsafe plans, oversized responses and timeout. Live provider interoperability, tokenizer enforcement and monetary limits remain unverified and optional.
