# Akno

**A two-way memory layer for agents, on top of a Markdown knowledge base you already have.**

Point it at a folder of notes. It indexes what is there, keeps watching, and gives agents a small set of
operations for reading and writing that knowledge — while you keep editing the same files by hand, in Obsidian
or any editor, with no import step and no proprietary store.

Delete the index and the folder is untouched. `akno index` rebuilds every chunk, embedding, summary, fact,
event and link from the Markdown.

> **Status: the read path works.** Indexing, watching, and `recall` / `read` / `list` / `timeline` / `context`
> are implemented and tested against a real 223-page knowledge base. The write ops (`write`, `remember`,
> `forget`, `undo`, `move`, `ingest`) have final schemas, are advertised over every door, and return
> `not_implemented` — see [What is not built yet](#what-is-not-built-yet).

---

## Why

Agents make things up when retrieval is thin. They get back disconnected fragments, no indication of what was
searched or what was missing, and no way to cite anything. Then they fill the gaps.

The usual answer is a longer prompt — "always retrieve first", "never claim it isn't recorded", "notice when a
value is superseded". A prompt is a suggestion. Akno's position is that this belongs in the memory layer,
where it runs every time:

- Retrieval returns **page cards with line addresses**, so every claim traces to a sentence in a file.
- Absence is **a result** — and it distinguishes *nothing matched* from *the index is unavailable*.
- A superseded value comes back **labelled as superseded**, not as a competing current claim.
- `question` mode reports **coverage**: which concepts of the question the results actually cover.
- Structure rules — where things go, what is quotable — are **enforced**, not requested.

## Quick start

Requires Node 22+ and pnpm.

```bash
pnpm install && pnpm build
cp config/local.example.jsonc config/local.jsonc   # set akno_path and your model ids
node packages/cli/dist/bin.js index
node packages/cli/dist/bin.js doctor
```

Then ask it something:

```bash
node packages/cli/dist/bin.js recall "when does the car insurance renew?"
```

```
ok mode=question 2 cards 1180 tokens
  coverage ✓ car insurance  ✗ renewal date
  nothing returned covers "renewal date" — do not answer that part

documents/car-insurance-2026 (full, 0.931)
  Car insurance 2026 › Policy
  Vulpine Mutual policy for the household car, renews 4 Nov 2026.
  documents/car-insurance-2026:11  Premium: €33/month (raised at the 2026 renewal; was €28) ~0.94
```

Every line carries `file:line`. The `~0.94` is derivation confidence — how sure the deriver is that the line
states a well-formed durable claim, not how sure it is that the claim is true.

## Configuration

Two files, and only one of them is ever committed.

| File | Committed | Holds |
|---|---|---|
| `config/default.jsonc` | **yes** | Every key, with a machine-independent default. Documentation as much as configuration. |
| `config/local.example.jsonc` | **yes** | The template you copy. |
| `config/local.jsonc` | **no** — gitignored | Your knowledge base path, your endpoints, your model ids. |
| `.env` | **no** — gitignored | Secrets only. |

Precedence, lowest to highest:

```
config/default.jsonc  →  ~/.akno/config.json  →  config/local.jsonc  →  AKNO_* env
```

**A config file never contains a credential.** It names the environment variable that holds one:

```jsonc
"providers": { "openai": { "api_key": { "env": "AKNO_OPENAI_API_KEY" } } }
```

So a config file is always safe to read, diff and paste into an issue. `akno config` prints the resolved
configuration with secrets redacted, and tells you which files it came from — the fastest way to check that
your `local.jsonc` is actually being read.

Rules can also travel with the notes: if `<akno_path>/akno.json` exists, its `folders` block wins over
both config files, so structure rules are versioned alongside the knowledge base they describe.

## Models

Three roles, all optional, each degrading rather than failing. Any OpenAI-compatible endpoint; one local
server can host all three.

| Role | Without it |
|---|---|
| Embedding | lexical search only — FTS5 with porter stemming still works |
| Reranker | hybrid score ordering instead of cross-encoder reranking |
| Small chat | no summaries, keywords, fact derivation or query expansion — recall still works |

`akno doctor` reports which roles resolved, their latency, and **what each missing one costs**. Model
latency and index latency are reported separately, because a memory system that feels slow after idling is
almost never suffering from its storage engine.

There is no model downloading or serving in this repo. Models are configuration, pointed at an endpoint you
run.

## The ops

Ten, small on purpose: every additional op is another chance for an agent to pick the wrong one.

| Op | | What it does |
|---|---|---|
| `recall` | ✅ | Expand → hybrid search → rerank → assemble → fit a budget. `mode` (`lookup`/`question`/`explore`) selects the expansion strategy and is inferred from the query. |
| `read` | ✅ | One exact thing: a page by slug or id, or a document by id. |
| `list` | ✅ | Browse structure: folders, pages by type/tag/class/recency, or a tree outline. |
| `timeline` | ✅ | When things happened — by range, subject, or match. |
| `context` | ✅ | The whole pre-turn bundle against **one** budget: pinned pages, recent timeline, structure, and this turn's recall. |
| `write` | ⬜ | Create, append, patch or replace a page. Carries documents, events, tags and links. |
| `remember` | ⬜ | Hand over a transcript; Akno runs the retain mission and produces the writes. |
| `forget` | ⬜ | Retract a fact by removing the sentence that produced it; trash a page or document. |
| `undo` | ⬜ | Reverse a change by id. |
| `move` | ⬜ | Relocate a page with its documents. |
| `ingest` | ⬜ | Extract, OCR, name, summarize and route a file, folder or URL. |

`⬜` ops validate their input against the final schema, then return `not_implemented`. They are advertised over
every door, so a caller can discover them today and will not need to change when they land.

## Three doors, one registry

```ts
import { open } from '@akno/core';
const mem = await open({ aknoPath: '~/Notes' });
const { cards } = await mem.recall({ query: 'car insurance renewal', budget: 8000 });
```

```ts
import { connect } from '@akno/client';
const mem = await connect();                 // unix socket, identical interface
```

```bash
akno serve                                 # unix socket — the default door
akno serve --mcp                           # stdio MCP, for any agent
akno serve --http 127.0.0.1:7777           # for agents in containers or on another host
```

```json
{ "mcpServers": { "memory": { "command": "akno", "args": ["serve", "--mcp"] } } }
```

Every door is generated from one op registry with one schema per op, so they cannot drift into different
behaviour. Trust is a parameter, not a property of the transport: `server.mcp_allow` restricts what a door
exposes without a second code path that can grow its own bugs.

**Why a long-lived process:** spawning a process per memory call costs ~33ms against ~0.04ms for a long-lived
handle. None of that is the database — opening a SQLite file is half a millisecond regardless of size. A unix
socket round trip is ~18µs, which is why IPC cost is not a reason to embed.

## How your files are treated

**Akno writes nothing into your knowledge base by default.** Not frontmatter, not fact tables, not a
`timeline.md` you did not ask for.

- Identity lives in the index (`pages.id`), and a rename is followed by body hash. Set `write_ids: true` to
  have Akno add a frontmatter `id:` — the only thing it ever writes into a page — for identity that survives
  a database rebuild and a move to another machine.
- `create_reserved_paths: false` by default, so a first run against an existing folder creates nothing.
- If a reserved path exists and isn't what Akno expects — a `timeline.md` that is a project plan — it is left
  completely alone. `doctor` reports it and points at the config key to remap it.
- Every frontmatter key except `id` is preserved byte for byte and ignored.

## Page classes

Not everything in a knowledge base is knowledge. A lot of it is **evidence**: contract text, emails, statutes,
transcripts. You want it stored and findable. You do not want a fact extractor asserting things from it, or
eleven pages of contract text landing in a retrieval budget.

| Class | Indexed | `recall` returns | Fact-mined |
|---|---|---|---|
| `full` *(default)* | yes | summary + matching lines; whole body on `depth: "full"` | yes |
| `reference` | yes | summary + a capped quote window | **no** |
| `excluded` | no | nothing | no |

> Reference pages are evidence. Full pages are claims. Only claims become facts.

A page can switch class mid-body at a `<!-- reference -->` fence: above it, normal and mined; below, indexed
for search but never mined and never returned whole.

This is a **relevance policy, not access control** — `read({slug})` returns the full body of a `reference` page
every time, and `recall({ include: ['reference'], depth: 'full' })` lifts the cap.

## Performance

`akno bench` asserts the spec's budgets so CI fails on regression rather than someone noticing months later.
Measured against a real 223-page knowledge base (1,068 chunks, Apple Silicon):

| | |
|---|---|
| Structural index, cold, 223 pages | 322 ms |
| Re-index, nothing changed | **10.7 ms** |
| Point lookup by slug | < 1 ms |
| FTS5 match | < 1 ms |

A restart does not re-index — it **stats**. Only files whose mtime or size moved get hashed. mtime is a fast
path, not a correctness guarantee, so a full hash sweep runs on the periodic backstop and on `index --verify`.

Vector search is exact brute force by decision, not omission: below ~20,000 chunks an approximate index costs
build time, recall accuracy and a second structure to keep in sync, to save milliseconds nobody notices.

## What is not built yet

Named honestly, because a README that implies more than exists is the same failure mode Akno is built to
prevent:

- **The write path.** `write`, `remember`, `forget`, `undo`, `move` — schemas, conflict-report and
  approval-request shapes, gating config and the journal table are all in place; the bodies are not.
- **Document extraction and OCR.** Attachments are discovered and attached to their page, and `doctor` reports
  how many are un-extracted. Nothing reads inside a PDF yet, so `read({document})` returns `degraded` with
  `text: null` rather than implying the file is empty.
- **The inbox and routing.** `route_threshold` and the inbox rule are configurable; nothing moves files.
- **The maintenance cycle** (`dream`, `observe`, `reflect`).
- **`akno approve`** for gated proposals.
- **Linux and Windows.** The watcher uses recursive `fs.watch` (FSEvents on macOS) and should work elsewhere,
  but only macOS is tested. `akno service` is launchd-only by design.

## Repo layout

```
packages/protocol   op registry, zod schemas, wire format — no dependencies beyond zod
packages/core       the memory layer: config, store, indexer, models, recall, watcher
packages/client     thin typed client over a running service; no native dependencies
packages/cli        commands and the three doors
config/             default.jsonc (committed) + local.jsonc (never)
```

Runtime dependencies, all of them: `better-sqlite3`, `sqlite-vec`, `yaml`, `zod`, and
`@modelcontextprotocol/sdk` for the MCP door. Terminal colour is `node:util`'s `styleText`, request deadlines are
`AbortSignal.timeout`, and the file walker is `node:fs` — none of that needs a package.

`@akno/protocol` exists so `@akno/client` can share schemas with `@akno/core` without pulling
`better-sqlite3` and `sqlite-vec` into a host's build.

## Development

```bash
pnpm build         # tsc --build across the workspace
pnpm test          # vitest — 143 tests, no models required
pnpm lint          # oxlint
pnpm knip          # dead exports and unused dependencies
pnpm bench
pnpm akno …      # the CLI from source, no bundler
```

The source runs on Node directly: `node packages/cli/src/bin.ts recall "…"`. That works because relative imports
name the file that is actually on disk (`./output.ts`, rewritten to `.js` on emit by
`rewriteRelativeImportExtensions`) and `erasableSyntaxOnly` keeps the source inside what Node's own type
stripping supports. There is no bundler or loader in the dev path.

The integration suite builds a real knowledge base on disk and indexes it **with no models configured** — the
most important thing to prove is that Akno degrades rather than fails. It also asserts that the knowledge
base is left byte-identical, and that deleting the index and re-indexing reproduces the same counts.

Fact lifecycle is tested against a stub chat endpoint (`packages/core/test/facts.test.ts`) rather than a live
model, because every assertion there is about the conclusion the indexer draws from a *given* derivation — a
real model cannot be scripted into producing the case you need.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other
noncommercial use is free, commercial use is not granted. Dependencies keep their own licences.
For a commercial licence, ask.
