# How Akno works

Akno turns a folder of Markdown pages and documents into a memory interface without replacing the folder as
the source of truth.

```text
knowledge-base files
       │
       ├── scan, parse, extract, derive
       │                 │
       │                 ▼
       │       disposable SQLite state
       │        search · facts · graph
       │                 │
       │                 ▼
       │       recall · answer · context
       │
       └── guarded mutations ◀── write · remember · ingest · dream
                 │
                 └── journal · re-index · verify
```

The design has three boundaries:

1. Files are authoritative; indexed state is derived and rebuildable.
2. Retrieval may expose evidence without promoting it to canonical knowledge.
3. A model may propose a mutation, but policy, deterministic validation, and current file hashes decide whether
   the mutation is allowed.

## Indexing

`akno index` reconciles the index with the current files. The long-running service performs the same work in
response to filesystem events.

For each changed path, Akno:

1. applies ignore and folder rules;
2. compares metadata and content hashes to avoid unnecessary work;
3. parses Markdown structure, frontmatter, links, stable identity, and authored events;
4. extracts supported document text or OCR with source-page locators;
5. divides searchable text into bounded chunks;
6. optionally derives summaries, facts, dates, aliases, and embeddings;
7. resolves exact identities and evidence edges; and
8. commits the new representation atomically.

Removed files are removed from the derived index. Renames preserve a stable identity when Akno can prove the
move. A complete rebuild produces the same public behavior without needing the previous database.

By default, indexing changes no knowledge-base files. Options such as `write_ids` and
`ingest.text_rendition` can create explicitly requested files, but they are off until enabled.

### Pages and documents

A Markdown page is authored knowledge: it can declare a subject, policy, links, facts, and events. A document
is source evidence: its extracted text is searchable and citable, but does not automatically become a durable
fact.

This distinction makes orphan documents useful immediately. A PDF does not need a generated Markdown wrapper
before `recall` can find a relevant page. `adopt` exists to organize it later.

### Facts and the evidence graph

Derived facts keep their source locator and confidence. Graph nodes represent stable page, document, chunk,
fact, event, and identity records; edges represent explicit relationships such as evidence, ownership, links,
aliases, and conflict status.

The graph is conservative. It follows exact authored or derived evidence and configured contextual identities;
it does not perform unrestricted entity discovery. [Limitations](limitations.md) describes that boundary.

## Retrieval

`recall` is a candidate-and-ranking pipeline:

```text
question
   ├── lexical candidates
   ├── semantic candidates, when embeddings are available
   └── bounded graph candidates
              │
              ▼
       rank-based fusion
              │
              ▼
       optional rerank and qualification
              │
              ▼
       cited evidence cards
```

The independent channels use different score units. Akno fuses their ranks; it does not compare a BM25 score
directly with a cosine value or reranker logit. A reranker may reorder candidates, and qualification may remove
results that are not relevant enough to return.

`recall` keeps discovery separate from synthesis. It returns bounded page or document sections with locators,
availability, and degradation information. The caller can inspect the evidence or pass it to its own model.

### Grounded answers

`answer` starts from retrieved evidence and asks the configured answer model for a direct response. A separate
verification step checks that answer claims are supported by the supplied citations. The result includes the
answer, citations, and related identities rather than repeating full source bodies.

No candidate can prove that memory is complete. Akno distinguishes:

- `empty`: the requested search completed and found nothing;
- `degraded`: a useful path ran, but one or more configured capabilities failed or were skipped; and
- `unavailable`: the operation could not make a trustworthy attempt.

This typed state is part of the result, not inferred from an exception string.

### Context for an agent turn

`context` assembles a complete pre-turn bundle against one output budget. Its `auto_recall` profile is for a
host that has the user's current prompt but no explicit memory question. It selects a small, diverse set of
useful evidence and may include an answer only when the prompt contains a sufficiently answerable memory need.

See [Reading memory](reading.md) for operation-level behavior.

## Mutations

All mutations go through the process that owns the write handle. They are journalled, followed by targeted
index reconciliation, and return a change id for `undo`.

An exact `write` is validated against folder rules and the current page. `remember` has more work to do: it
extracts durable claims from raw material, ranks relevant pages, checks an independent fact-injection admission,
and either performs a bounded write or returns a proposal. A plain knowledge page is searchable but read-only;
only explicit page or folder `remember: integrate` metadata admits injection. If the strongest match is
read-only, a weaker writable result cannot win merely because Akno may edit it. A new explicitly managed page or
a configured exact fallback can receive the claim only when its own page or parent-folder rule admits the write;
otherwise a typed `no_writable_destination` hold is safer. The routing order is an admitted semantic match, an
admitted new managed page proposed by retention, the configured fallback, and finally a hold. Per-claim
destination classes distinguish existing admitted pages, new managed pages, configured fallback use, and the
absence of an authorized home without requiring a host to parse prose. Each new managed sentence may also retain
one validated exact input quote
in private state, with only a hash of the full input. This lets the dream cycle verify or narrowly correct the
generated sentence later without granting authority over the containing page. Ingestion similarly separates
extraction, naming, routing, file movement, page creation, and indexing.

Maintenance adds another boundary:

```text
inspect → seal exact plan → decide → recheck inputs → apply → re-index → verify
```

Planning and deciding are separate turns. In autonomous mode the curator receives the sealed proposal, not an
open-ended request to edit files. Current policy, hashes, dependencies, and whole-run budgets can still block an
accepted item. See [The dream cycle](dream-cycle.md).

## Models and degradation

Akno assigns models by role instead of assuming one model can do every job:

- embeddings provide semantic candidates;
- expansion rewrites a query for retrieval;
- reranking orders and qualifies candidates;
- derivation extracts structured summaries, facts, and events;
- answer generates and verifies grounded responses;
- maintenance proposes or curates controlled changes; and
- vision describes textless visual evidence.

Several roles can point to the same OpenAI-compatible endpoint and generation model. Embeddings still require a
separate embedding model. Every model-dependent path has a declared degradation behavior, and `doctor` reports
the consequence of each missing role.

The provider chooses a generative transport explicitly or asks for `api: auto`. Auto-resolution runs at handle
or service startup with invented text, caches the endpoint-and-model-bound result, and tries Chat Completions
only after a definitively absent Responses route. The OpenAI preset uses the Responses API with stateless
storage disabled; existing compatible providers default to Chat Completions. Both adapters preserve the same
task-facing `chat` contract, strict schema validation, reasoning setting, usage receipt, retry policy, and typed
degradation. Akno never retries a real failed request through the other transport.

Structured model outputs are parsed and validated before use. Retries are bounded by error type and operation
deadline. Model text never grants itself filesystem authority.

## One operation registry, several doors

The protocol package defines each operation once: description, input schema, output schema, trust class, and
implementation status. Akno exposes that registry through:

- the in-process API;
- an owner-only Unix socket for local clients;
- loopback HTTP for a containerized agent; and
- stdio MCP for general agent hosts.

The default service owns the database, file watcher, models, and single write handle. A CLI command uses the
running socket when available and can otherwise open an in-process instance unless `--connect` requires the
service. MCP normally translates onto that same socket instead of opening a second writer.

Socket filesystem permissions are the local authentication boundary. HTTP has no built-in authentication and
should remain on loopback; its allowed operation set is deliberately narrower. MCP has its own explicit allow
list because an agent cannot claim the user's authority.

## State and recovery

The state directory contains the SQLite index, write journal, recoverable trash, private maintenance plans and
receipts, service socket, and logs. These have different recovery properties:

- the index is disposable and rebuilt with `akno index`;
- journal and trash preserve undo history and should not be deleted casually;
- sealed maintenance plans remain reviewable across restarts;
- terminal plans shed exact private payloads before their compact audit receipts expire;
- interrupted runs are reconciled from durable item state rather than assumed successful.

The knowledge base itself should be backed up normally. Akno's journal is an operational reversal mechanism,
not a substitute for version control or backups.

For service management, diagnostics, privacy, and recovery commands, see [Operations](operations.md).
