# Configuration

Akno separates machine settings, secrets, and knowledge-base-owned structure. The split makes configuration
inspectable without turning credentials or private paths into repository data.

## Configuration layers

Precedence runs from lowest to highest:

```text
packaged default.jsonc → <state_dir>/config.json → checkout config/local.jsonc → AKNO_* environment
```

| Layer                     | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `config/default.jsonc`    | Committed, machine-independent defaults and comments for every setting |
| `<state_dir>/config.json` | Installed machine configuration, normally `~/.akno/config.json`        |
| `config/local.jsonc`      | Gitignored checkout-specific paths, endpoints, and model ids           |
| Environment               | Invocation-specific paths and credentials                              |

An installed package has no checkout `config/local.jsonc`. `AKNO_CONFIG` selects an explicit machine-config
path. Use `akno config` to see the resolved, redacted result and every contributing source.

## Secrets

A config names the environment variable containing a credential; it never contains the credential itself:

```jsonc
{
  "providers": {
    "openai": {
      "base_url": "https://api.openai.com/v1",
      "api_key": { "env": "AKNO_OPENAI_API_KEY" },
    },
  },
}
```

`akno config`, setup previews, diagnostics, benchmark artifacts, and dream receipts redact or omit resolved
secret values.

## Knowledge-base rules

Folder policy can travel with the notes in `<akno_path>/akno.jsonc`:

```jsonc
{
  // The most specific matching glob wins.
  "folders": {
    "sources/**": { "role": "source", "remember": "deny", "ingest": "document" },
    "templates/**": { "role": "ignored", "remember": "deny" },
    "inbox/**": { "ingest": "auto", "route": true },
  },
}
```

The `.jsonc` extension is deliberate: comments are valid and `akno folder` preserves them. The old
`akno.json` name is rejected with an exact rename instruction; if both names exist, Akno refuses to choose an
authority.

Knowledge-base rules override machine folder rules. They are configuration, not notes, and are never indexed as
memory. A rule change fingerprints the affected policy, so the next index pass reconsiders matching pages even
when their Markdown bytes did not change.

```bash
akno rules sources/example.md
```

This explains the winning rule, its source, and page-specific maintenance authority without emitting page
content.

## Model roles

Every role is optional and degrades independently:

| Role        | If configured                                             | Without it                                             |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `embedding` | Semantic candidate generation                             | Lexical and exact-graph candidates only                |
| `reranker`  | Candidate ordering and optional irrelevance qualification | Rank-fusion order                                      |
| `derive`    | Summaries, facts, naming, `remember`, and planner work    | Those derived capabilities report unavailable          |
| `expansion` | Query reformulation                                       | Search the original query only                         |
| `answer`    | Direct grounded synthesis and verification                | `answer` reports `not_answered`; discovery still works |
| `vision`    | Description of images with no readable text               | OCR and ordinary document extraction still work        |

One endpoint may host several roles, but embeddings still use a separate embedding model id. The qualified
OpenAI minimum is therefore a single-endpoint, two-model setup—not a single-model setup.

The generative roles have separate reasoning and output settings because their latency and quality needs
differ. Expansion and reranking are interactive and can use `reasoning_effort: "none"`; derivation and
maintenance can use more effort off the hot path.

See [`config/default.jsonc`](../config/default.jsonc) for every field and
[`config/local.example.jsonc`](../config/local.example.jsonc) for a specialist setup.

## Reranking and qualification

`models.reranker.mode` selects either a native `/rerank` endpoint or Akno's bounded listwise LLM prompt.
Successful reranking can remove candidates confidently judged irrelevant. A failed or invalid reranker response
preserves fusion order and reports typed degradation; Akno never filters using an unvalidated result.

Native rerankers do not share a score scale. `score_offset: "auto"` calibrates a conservative boundary from an
invented anchor suite and caches it in derived state. If the model cannot separate the anchors, qualification is
disabled and recall keeps candidates rather than guessing a cutoff.

## Maintenance authority

One profile defines the scheduled default:

```jsonc
{
  "maintenance": {
    "profile": "autonomous",
  },
}
```

| Profile      | Decision owner                                                                  |
| ------------ | ------------------------------------------------------------------------------- |
| `audit`      | Nobody; exact plans are retained without decisions or writes                    |
| `review`     | A human decides each eligible item                                              |
| `autonomous` | A separate curator model decides, then accepted items pass deterministic guards |

Transformation policies can lower individual classes:

```jsonc
{
  "maintenance": {
    "profile": "autonomous",
    "policies": {
      "hygiene": "auto",
      "broken_link": "auto",
      "merge": "review",
      "contradiction": "off",
    },
    "limits": {
      "max_items": 30,
      "max_files_changed": 40,
      "max_bytes_written": 500000,
      "max_high_risk_items": 3,
    },
  },
}
```

Policy values are `off`, `audit`, `review`, and `auto`. Supported classes are `observe`, `reflect`, `hygiene`,
`synthesis`, `split`, `extract`, `merge`, `contradiction`, `broken_link`, and `adopt`. Page opt-ins, folder
restrictions, merge allowlists, feature switches, and write budgets remain additional ceilings.

Read [The dream cycle](dream-cycle.md) before raising authority.

## Retries and deadlines

Akno retries rate limits and selected transient 5xx failures with bounded exponential backoff. It does not retry
a timeout: the attempt already spent the configured deadline, and repeating it would multiply latency without
evidence that the endpoint recovered.

`recall.expansion_timeout_ms` bounds the entire interactive expansion sequence. A background role's
`timeout_ms` applies per attempt because nobody is waiting on that request in the current turn.

## Settings that may create files

Indexing leaves the knowledge base byte-identical by default. Explicit opt-ins include:

- `write_ids: true`, which adds stable page ids to frontmatter;
- `ingest.text_rendition: true`, which maintains readable `<document>.txt` renditions;
- `create_reserved_paths: true`, which permits configured reserved paths to be created.

Write commands and authorized maintenance plans naturally modify files and record journal entries. See
[Writing and ingestion](writing.md) and [The dream cycle](dream-cycle.md).
