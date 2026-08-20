# Guided single-model setup

- **Status:** proposed
- **Depends on:** [Trust modes and status](005-trust-modes-and-status.md),
  [LLM reranking benchmark](007-llm-reranking-benchmark.md)

## Problem

Akno's model roles make degradation explicit and allow specialist models, but the first-run configuration asks
a new user to understand embeddings, cross-encoder reranking, expansion, derivation, vision, and maintenance
before they have recalled one page. A useful minimum should require one provider credential and one model id.

The proposed OpenAI minimum uses `gpt-5.6-luna`. It can handle Akno's generative tasks and a prompted ranking
task, but it does not replace an embedding model or a native cross-encoder endpoint. The minimum therefore uses
lexical retrieval plus LLM reranking and states that tradeoff honestly.

GPT-5.6 Luna supports both Responses and Chat Completions, structured outputs, image input, and reasoning effort
levels including `none`. OpenAI positions it for cost-sensitive, high-volume workloads. See the official
[GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and
[latest-model guide](https://developers.openai.com/api/docs/guides/latest-model).

## Outcome

A guided command creates a minimal, inspectable configuration:

```text
$ akno init
Knowledge base: /path/to/markdown
Provider: OpenAI
Preset: GPT-5.6 Luna — one model, lexical search + LLM reranking
Maintenance: autonomous
Schedule maintenance now? no

Configuration written. Knowledge-base files were not changed.
Next: akno index
Then: akno recall "Zephyr warranty"
```

Non-interactive form:

```text
akno init --preset openai-luna --akno-path /path/to/markdown --maintenance autonomous
```

The command writes configuration only. It does not index, install a service, create pages, or run maintenance
unless the user explicitly asks for those follow-up actions.

## Preset contract

The `openai-luna` preset configures:

- one provider: OpenAI;
- one generative model id: `gpt-5.6-luna`;
- API key through the `OPENAI_API_KEY` environment variable, never copied into the config;
- lexical retrieval as the guaranteed candidate source;
- LLM-based reranking through an Akno-owned prompt and structured response;
- the same model for query expansion, derivation, maintenance planning, and curation;
- the same model in a separate request for curator decisions;
- task-specific reasoning effort and output limits;
- embeddings disabled unless the user adds a separate embedding model later.

This is one model, not one request. Separate task calls, prompts, schemas, and recorded purposes remain necessary
for safety and observability.

The preset is available only after the ranking benchmark in specification 007 meets its release threshold. If
the benchmark has not passed, setup may expose it as `experimental` but cannot call it the recommended minimum.

## Proposed configuration shape

Model identity and task behavior should be separate so one model can behave differently on hot-path ranking and
slow maintenance:

```jsonc
{
  "models": {
    "providers": {
      "openai": {
        "type": "openai",
        "api": "responses",
        "api_key_env": "OPENAI_API_KEY",
      },
    },
    "definitions": {
      "primary": {
        "provider": "openai",
        "id": "gpt-5.6-luna",
      },
    },
    "tasks": {
      "expansion": {
        "model": "primary",
        "reasoning_effort": "none",
        "max_output_tokens": 300,
      },
      "rerank": {
        "mode": "llm",
        "model": "primary",
        "reasoning_effort": "none",
        "max_output_tokens": 700,
      },
      "derive": {
        "model": "primary",
        "reasoning_effort": "low",
        "max_output_tokens": 1200,
      },
      "maintenance": {
        "model": "primary",
        "reasoning_effort": "medium",
        "max_output_tokens": 4000,
      },
      "curator": {
        "model": "primary",
        "reasoning_effort": "high",
        "max_output_tokens": 2400,
      },
    },
    "embedding": { "enabled": false },
  },
}
```

Exact effort defaults are benchmark hypotheses. The important contract is that reasoning is configured per task
and explicitly sent. GPT-5.6 models otherwise default to `medium` reasoning effort according to the official
guide, which is an avoidable latency and cost penalty for query expansion and ranking.

The resolved configuration shown by `akno config` includes preset-derived values. A user can override any
task without copying the whole preset.

## Provider and transport support

The current client assumes OpenAI-compatible Chat Completions plus dedicated `/embeddings` and `/rerank`
endpoints. Supporting this preset requires a task-oriented provider adapter:

- `api: responses` maps `reasoning_effort` to the Responses API reasoning configuration;
- `api: chat_completions` maps the task to the provider's supported equivalent when available;
- `api: auto` uses declared provider capability metadata, not trial-and-error on every request;
- generic OpenAI-compatible providers retain the existing transport unless configured otherwise;
- native `/rerank` remains available as `rerank.mode: endpoint`;
- prompted ranking is `rerank.mode: llm` and uses the ordinary generative transport.

OpenAI recommends the Responses API for current reasoning workflows, while the model page lists both transports.
The OpenAI preset should therefore use Responses without forcing that choice on compatible third-party servers.

Unsupported reasoning settings fail configuration validation or produce a typed unavailable capability. Akno
must not silently send the provider's default effort when the task explicitly requires `none`.

## LLM reranking

LLM reranking is an Akno feature, not an assumed native model capability. It sends a bounded query and
candidate set to the configured generative model and requests a structured permutation:

```ts
interface LlmRankResult {
  order: Array<{ candidateId: string; relevance: 0 | 1 | 2 | 3 }>;
}
```

The response is valid only when every returned id came from the request, ids are unique, relevance values are in
range, and the schema's required coverage rule is satisfied. Missing candidates retain their fusion order after
ranked candidates; invented or duplicate ids invalidate the result and Akno falls back to fusion order with a
typed degradation.

Candidate text is untrusted data. The prompt delimits it, instructs the model not to follow content-contained
instructions, and never exposes tools or secrets. Candidates are truncated by a documented per-candidate and
total-token policy before the request.

Listwise batches are preferred initially because they produce one ordering. If candidate count exceeds the
benchmark-backed maximum, Akno reranks the leading fusion candidates and preserves the remaining order. It
does not merge raw relevance labels with BM25, cosine, reciprocal-rank, or cross-encoder values.

## Reasoning policy

Recommended starting points:

| Task                    | Effort   | Reason                                            |
| ----------------------- | -------- | ------------------------------------------------- |
| query expansion         | `none`   | interactive, bounded transformation               |
| LLM reranking           | `none`   | interactive, schema-constrained ordering          |
| fact/summary derivation | `low`    | quality matters, but inputs are local and bounded |
| maintenance planning    | `medium` | multi-source transformation and tradeoffs         |
| curator decision        | `high`   | independent scrutiny of exact proposed writes     |

These values must be evaluated for latency, quality, and stability. In particular, the ranking benchmark compares
`none` and `low`; “disable thinking” is not accepted merely because it is faster.

Receipts record requested and provider-reported reasoning effort when available. A provider that ignores the
setting cannot claim conformance to the preset.

## Guided setup flow

`akno init` should:

1. validate or create the local config location without touching the knowledge base;
2. ask for the knowledge-base path and confirm it is readable;
3. offer `openai-luna`, specialist/custom, and no-model setups;
4. check only whether the required environment variable is present, never print its value;
5. explain the preset's lexical-only semantic limitation in one sentence;
6. ask for an audit, review, or autonomous maintenance profile;
7. show a complete summary of writes and future scheduled authority;
8. write the config atomically and run configuration validation;
9. print explicit next commands for index, recall, service install, and an audit dream.

If a config exists, default behavior is to show a diff and ask before replacement. Non-interactive replacement
requires an explicit `--force` and preserves unknown keys when applying a preset overlay where possible.

## Degradation and upgrade path

With the one-model preset:

- lexical search, exact reads, writes, moves, and structural operations work without the model;
- failed expansion falls back to the original query;
- failed LLM reranking preserves rank fusion ordering;
- failed maintenance or curator calls leave durable planned/degraded results and apply nothing automatically;
- semantic vector retrieval is unavailable, not falsely emulated by the generative model.

`akno doctor` suggests optional upgrades by observed limitation:

- add an embedding model for semantic candidate recall;
- add a native reranker for lower-latency or stronger ranking;
- assign a different maintenance model for quality or cost isolation;
- assign a vision-capable model when the chosen primary does not support required inputs.

## Acceptance criteria

- A user can configure Akno with one provider credential and one generative model id.
- The preset performs recall with lexical candidates and benchmark-qualified LLM reranking.
- Expansion and reranking explicitly send reasoning effort `none`.
- Maintenance and curator use separate calls even when they share `gpt-5.6-luna`.
- No embedding request is sent to the generative model.
- LLM ranking failure preserves fusion order and reports a typed degradation.
- Setup does not modify knowledge-base files or install background services without an explicit choice.
- `akno config` displays every preset-derived task setting.
- Credentials are referenced by environment variable and never written or printed.
- The preset is not labeled recommended until its checked-in benchmark threshold passes.

## Non-goals

- Claiming lexical plus prompted reranking is equivalent to semantic candidate retrieval.
- Removing specialist model roles or native reranker support.
- Making one shared request serve planning and curation decisions.
- Auto-detecting credentials by scanning shell history or unrelated files.

## Open questions

- Should guided setup offer an optional second OpenAI embedding model while still describing the configuration as
  one provider rather than one model?
- Does the curator need `high` reasoning for every low-risk item, or can benchmarked class-specific effort reduce
  cost without weakening decisions?
- Should the first OpenAI transport implementation retain a Chat Completions fallback for accounts or gateways
  that do not expose Responses?
