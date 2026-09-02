# Configuration

Akno separates machine settings, secrets, and knowledge-base-owned structure. The split makes configuration
inspectable without turning credentials or private paths into repository data.

## Configuration layers

Precedence runs from lowest to highest:

```text
packaged default.jsonc → platform machine config → checkout config/local.jsonc → AKNO_* environment
```

| Layer                   | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `config/default.jsonc`  | Committed, machine-independent defaults and comments for every setting       |
| Platform machine config | `~/.akno/config.json` on macOS; `$XDG_CONFIG_HOME/akno/config.json` on Linux |
| `config/local.jsonc`    | Gitignored checkout-specific paths, endpoints, and model ids                 |
| Environment             | Invocation-specific paths and credentials                                    |

An installed package has no checkout `config/local.jsonc`. `AKNO_CONFIG` selects an explicit machine-config
path. Use `akno config` to see the resolved, redacted result and every contributing source.

The default private state is `~/.akno` on macOS and `$XDG_STATE_HOME/akno` on Linux (falling back to
`~/.local/state/akno`). The default Linux socket is `$XDG_RUNTIME_DIR/akno/akno.sock`; when no runtime directory
is available it stays under private state. `AKNO_STATE_DIR`, `AKNO_SOCKET`, `state_dir`, and `server.socket`
remain explicit overrides; environment values win over files.

## Secrets

A config names the environment variable containing a credential; it never contains the credential itself:

```jsonc
{
  "providers": {
    "openai": {
      "base_url": "https://api.openai.com/v1",
      "api_key": { "env": "AKNO_OPENAI_API_KEY" },
      "api": "responses",
    },
  },
}
```

`akno config`, setup previews, diagnostics, benchmark artifacts, and dream receipts redact or omit resolved
secret values.

`providers.<name>.api` selects the provider's generative transport. `responses` uses `/responses`,
`max_output_tokens`, `reasoning.effort`, Responses image parts, and `text.format` structured outputs;
`chat_completions` retains the existing OpenAI-compatible `/chat/completions` adapter. Providers that omit the
field default to `chat_completions`, so existing local and gateway configurations do not silently change.

`auto` is for an unfamiliar OpenAI-compatible endpoint. At the first handle or service startup, Akno sends a
single-word invented probe to Responses for every distinct configured generative model. It tries Chat
Completions only when Responses returns an absent-route status (`404`, `405`, or `501`); authentication,
rate-limit, timeout, malformed-response, and server failures leave the transport unresolved instead of being
misread as capability evidence. The successful selection is stored in
`<state_dir>/provider-capabilities.json`, keyed by a one-way fingerprint of the endpoint, authentication,
headers, and complete generative-model set. Changing any of those inputs invalidates the entry automatically. Run
`akno doctor --refresh-api` after an endpoint upgrades in place; `akno doctor --no-probe` never resolves a cache
miss or sends a model request. A failed probe stores no provider response: it records only a five-minute
content-free cooldown so repeated one-shot commands do not each wait on the same outage.

The guided OpenAI preset selects `responses` explicitly and sends `store: false` because Akno calls are
stateless and may contain private memory. A failed Responses call does not fall through to Chat Completions:
cross-transport retry could duplicate cost and change schema behavior. Automatic one-time capability resolution
uses only invented probe text. A real Akno request never falls through to the other transport.

Configuring a provider for a model role is the owner's authorization to send that role's necessary input to
that provider. Akno does not add per-page or per-call egress gates. It does keep the request on the exact
configured scheme, host, and effective port: model calls and `api: auto` probes refuse cross-origin redirects
before any authorization, custom header, or body can reach the target. Bounded same-origin `307`/`308`
redirects preserve the POST; `301`/`302`/`303`, loops, malformed or credential-bearing destinations, and
unsupported schemes fail with content-safe diagnostics. Retries and compatibility negotiation stay on the same
origin, and a failed configured provider never causes another provider block to be tried.

## Door and network policy

`server.mcp_allow` is the authoritative operation set for MCP. A stdio adapter that forwards through the
running service reads that policy from the service handshake. `akno serve --mcp --allow ...` may narrow the
set for one host, but cannot add an operation the service policy denied.

Loopback HTTP is usable without a credential and is limited to read operations in
`server.http_public_allow`; that list may narrow the public surface but cannot grant a write. Authenticated
identities are environment-backed secret references:

```jsonc
{
  "server": {
    "http_public_allow": ["recall", "answer", "read"],
    "http_access": [
      {
        "name": "vulpine-agent",
        "token": { "env": "AKNO_HTTP_AGENT_TOKEN" },
        "actor": "agent",
        "allow": ["recall", "answer", "read", "retain"],
      },
    ],
  },
}
```

A missing token variable disables that identity and appears in `akno doctor`. A non-loopback HTTP bind is
refused unless at least one identity has a resolved credential. The credential selects both actor and
operations; an HTTP caller cannot supply `actor: "user"` itself. `akno config` redacts resolved tokens. The
built-in listener is plain HTTP, so carry non-loopback traffic through a trusted tunnel or TLS reverse proxy.

URL ingest denies loopback, private, link-local, multicast, unspecified, metadata, and other non-public IPv4
and IPv6 destinations after DNS resolution. Every answer must pass, the request is pinned to one validated
address, and redirects are resolved and checked again. A known internal service can be opted in by exact
scheme, hostname, and port—never by path or wildcard—with `ingest.trusted_url_origins`. The exception does not
authorize another port, protocol, or redirect origin on the same host.

## Knowledge-base rules

Folder policy can travel with the notes in `<akno_path>/akno.jsonc`:

```jsonc
{
  // The most specific matching glob wins.
  "folders": {
    "memory/**": { "role": "knowledge", "remember": "integrate" },
    "topics/**": { "role": "knowledge", "observe": "integrate" },
    "sources/**": { "role": "source", "remember": "deny", "ingest": "document" },
    "templates/**": { "role": "ignored", "remember": "deny" },
    "inbox/**": { "ingest": "auto", "route": true },
    "notes/**": { "max_depth": 1, "relocate_to": "notes" },
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
content. With no page declaration or matching `remember` rule, a page remains searchable knowledge but is
read-only for fact injection. Observation authority is separate and also defaults to deny:
`observe: integrate` permits only Akno-owned L2 blocks on an existing exact-subject page, never retained-item
injection, page creation, or adjacent prose edits. Existing `remember` and `dream` settings do not imply it.
`akno doctor` reports admitted, read-only, and implicit read-only page counts so an upgrade can be reviewed
without adding a catch-all write rule. For the structural details, run:

```bash
akno doctor --no-probe --admission-preview
```

The opt-in preview groups implicit pages by top-level folder and prints exact `{ "remember": "deny" }` patches.
Those patches merely make the current default-deny behavior explicit: they do not infer a role or grant write
authority. Root-level pages are counted separately because proposing a global `**` rule would be broader than
the evidence. Routine `doctor` output omits folder names, and neither form writes configuration.

## Model roles

Every role is optional and degrades independently:

| Role        | If configured                                             | Without it                                             |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `embedding` | Semantic candidate generation                             | Lexical and exact-graph candidates only                |
| `reranker`  | Candidate ordering and optional irrelevance qualification | Rank-fusion order                                      |
| `derive`    | Summaries, facts, naming, `remember`, `retain`, and plans | Those derived capabilities report unavailable          |
| `expansion` | Query reformulation                                       | Search the original query only                         |
| `answer`    | Direct grounded synthesis and verification                | `answer` reports `not_answered`; discovery still works |
| `vision`    | Description of images with no readable text               | OCR and ordinary document extraction still work        |

One endpoint may host several roles, but embeddings still use a separate embedding model id. The qualified
OpenAI minimum is therefore a single-endpoint, two-model setup—not a single-model setup.

The generative roles have separate reasoning and output settings because their latency and quality needs
differ. Expansion and reranking are interactive and can use `reasoning_effort: "none"`; derivation and
maintenance can use more effort off the hot path.

See [`config/default.jsonc`](https://github.com/tenphi/akno/blob/main/config/default.jsonc) for every field and
[`config/local.example.jsonc`](https://github.com/tenphi/akno/blob/main/config/local.example.jsonc) for a
specialist setup.

## Reranking and qualification

`models.reranker.mode` selects either a native `/rerank` endpoint or Akno's bounded listwise LLM prompt.
Successful reranking can remove candidates confidently judged irrelevant. A failed or invalid reranker response
preserves fusion order and reports typed degradation; Akno never filters using an unvalidated result.

Native rerankers do not share a score scale. `score_offset: "auto"` calibrates a conservative boundary from an
invented anchor suite and caches it in derived state. If the model cannot separate the anchors, qualification is
disabled and recall keeps candidates rather than guessing a cutoff.

## Remember fallback

An optional exact page can catch durable claims when ordinary semantic routing and managed-page creation both
fail:

```jsonc
{
  "maintenance": {
    "retain": {
      "fallback_page": "memory/inbox",
      "evidence_grace_days": 30,
    },
  },
}
```

The default is `null`, so no fallback is used. This setting names a destination; it does not authorize one. An
existing page must itself resolve to `role: knowledge` and `remember: integrate`. A missing page can be created
only when its exact parent folder explicitly permits knowledge-page creation and remember integration. Reserved
paths, read-only pages, and existing Markdown files that are absent from the index are rejected rather than
overwritten. `akno doctor` reports the configured page as `existing page`, `new page`, or `unavailable` without
showing page content.

The fallback is deliberately last in the routing order: an admitted semantic match wins first, then an admitted
new managed page proposed by retention, then the configured fallback. Without any authorized destination,
`remember` returns a typed hold.

`evidence_grace_days` defaults to `30`. It applies only after retained support becomes inactive through exact
retraction or user forget; active support has no age limit. Nonterminal maintenance work that still names the
managed item also blocks pruning. A value of `0` permits immediate secure pruning once those dependencies are
gone. This removes bounded private quotes from local state, not Markdown, replay hashes, compact receipts, or
stored page/document bindings.

Interactive `akno init` can configure this boundary without examining page content. It classifies visible
top-level directories as managed memory, read-only knowledge, or source/reference material and can add a
dedicated fallback namespace. New setup writes an explicit decision for every directory it presents. An existing
installation keeps its current folder and fallback policy unless the user opts into reviewing it.

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
      "managed_item": "auto",
      "broken_link": "auto",
      "rule_drift": "auto",
      "merge": "review",
      "contradiction": "off",
    },
    "limits": {
      "max_items": 30,
      "max_files_changed": 40,
      "max_bytes_written": 500000,
      "max_high_risk_items": 3,
    },
    "plan_retention": {
      "payload_days": 30,
      "receipt_days": 180,
    },
    "max_revision_attempts": 1,
  },
}
```

Policy values are `off`, `audit`, `review`, and `auto`. Supported classes are `observe`, `reflect`, `hygiene`,
`managed_item`, `synthesis`, `split`, `extract`, `merge`, `contradiction`, `broken_link`, `rule_drift`, and `adopt`. Page
opt-ins, folder restrictions, merge allowlists, feature switches, and write budgets remain additional ceilings.

`max_revision_attempts` is the number of correction calls permitted after an automatic curator returns
`revise`; it defaults to `1` and accepts `0` through `3`. Each correction may replace complete after-state bytes
only for paths already sealed on the item, must pass deterministic preflight, and receives a fresh curator
decision. Another revision request at the limit becomes a rejection. Model or schema failure blocks the item
without writing or caching a semantic rejection, so a later cycle can retry from fresh planning.

`managed_item` is intentionally different from whole-page curation. It inspects only fragments introduced by
a strict `akno:item` marker on `remember: integrate` knowledge pages; those pages do not also need `dream`
authority. Its deterministic repair set removes empty markers and byte-identical payload/provenance duplicates.
Malformed or conflicting markers are counted as held findings and leave the page unchanged.

`rule_drift` is also independent from page-wide dream opt-in. It can replace an existing top-level scalar
`type` on a knowledge page only when a matching folder rule explicitly declares the exact expected `type`.
For an over-deep page, `max_depth` diagnoses the problem but does not authorize a guessed move. Pair it with
`relocate_to` in the same rule to name the exact destination folder; Akno preserves the basename and page
identity, moves the page's complete owned document and rendition set with byte and identity checks, and rewrites
only source link addresses required to keep self-links, relative page links, and owned local-file references on
their original targets. It updates every inbound knowledge-page link and exact authored `akno.about` value in
the same high-risk item. Multiple references on one page compile into one replacement. The page, document
relations, reference updates, and full change remain undoable. It declines relocation when the target exists,
destination rules reject it, an owned document is missing, changed, externally related, or would collide, a
relative local-file reference is unowned or escapes the knowledge-base root, or a source/reference page points
to it. An inherited, malformed, or already-duplicated `about` value is also held because it is not one exact
page-owned rewrite. `slug_pattern` drift remains report-only because a pattern does not name one exact filename.
Source/reference pages are never rule-drift write targets.
`maintenance.curate.max_rule_drifts` bounds both forms per cycle; the default is `20`.

Housekeeping does not leave an unplanned rule finding unexplained. Each displayed finding carries one typed
repair disposition: `ready` when the exact planner can seal it, `plan_backed` when a nonterminal item already
owns it, `report_only` when the rule does not determine one correction, or `held` with a deterministic safety
code such as `document_unavailable`, `document_destination_occupied`, `reference_about`,
`about_unrewritable`, `reference_backlink`, or `location_dependent_reference`. Ordinary JSON output
retains only aggregate disposition counts; page-specific codes and reasons require `--private-details`.

Canonical fragments are also checked against the current derived fact row: item id, page identity, payload
line, and exact source-line hash must agree. Reusing an id on two pages or participating in a typed fact
conflict that excludes the claim from inference yields `item_conflict`; disabled, stale, or missing fact derivation yields `source_unavailable`
rather than pretending verification passed. A fragment without one unique `##` section—or under the explicit
`## Unsorted` fallback—starts as `misplaced_item`. Qualified semantic placement may choose only `keep`,
`move`, or `uncertain`; an accepted move must name one existing unique `##` section in the same page, and
deterministic code moves the complete owned block without rewriting it. `placement_uncertain` and
`placement_unavailable` are held. Verdicts are cached by exact content and model contract without storing page
text or headings. Cross-page routing separately retrieves at most three existing `remember: integrate`
knowledge pages and may move one exact owned block only to a supplied page. The destination may be an existing
unique `##` section or the one plain heading deterministically derived from the current fact attribute. The
classifier cannot invent another label; creating the supplied heading is permitted only when no existing
section fits. Same-page placement uses the same rule. The operation is medium risk when it creates a section or
touches two pages, and it cannot create a page or replacement text. When the same page first needs deterministic
marker normalization, semantic placement is reported unavailable for that run and resumes against the canonical
bytes on the next cycle.
Shareable JSON and durable run receipts keep only aggregate counts. Use `akno dream --private-details` during a
live run to see the exact `slug:line` for repairable or held findings.

Merge discovery remains exact by default. Enable the qualified semantic candidate source only after choosing
explicit eligible folders:

```jsonc
{
  "maintenance": {
    "curate": {
      "merge_folders": ["people"],
      "merge_discovery": "semantic",
    },
  },
}
```

`exact` uses authored aliases and conservative evidence-graph identity. `semantic` keeps those signals and may
also compare complete, compact, sibling pages that explicitly allow synthesis. Embedding similarity only
prefilters a bounded queue; the qualified same-subject classifier still cannot authorize a write. Every
selected pair must pass the lossless planner, independent verifier, curator or human policy, budgets, stale
checks, and atomic apply verification. Classifier verdicts are cached by content and model fingerprints, so an
unchanged rejected pair is not repeatedly sent to the classifier. Model outages appear as typed dream
degradation and exact discovery continues.

Complete-page semantic signatures are cached separately from retrieval chunks. An unchanged eligible page is
therefore not sent to the embedding model again on every nightly cycle. The cache key includes the exact
semantic input, page identity, embedding endpoint, and signature version; changing any of them re-embeds only
the affected page. Stale signatures and pair verdicts are replaced instead of accumulating. The derived cache
stores hashes and vectors, but no page text, slug, title, or classifier rationale.

Plan retention has two stages. `payload_days` removes exact private operations and evidence from terminal
plans while keeping compact decisions, hashes, and verification receipts. `receipt_days` then removes those
terminal plan rows; it must be at least as large as `payload_days`. Active review, apply, partial, and
verification states never expire through this policy. A zero-day value means immediate expiry at the end of a
writable dream run. Preview the current boundary with `akno plan prune`; apply it manually with
`akno plan prune --apply`. Full writable dream runs enforce the configured boundary automatically.

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
