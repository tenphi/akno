# Akno

**A two-way memory layer for agents, on top of a Markdown knowledge base you already have.**

Point it at a folder of notes. It indexes what is there, keeps watching, and gives agents a small set of
operations for reading and writing that knowledge — while you keep editing the same files by hand, in Obsidian
or any editor, with no import step and no proprietary store.

Delete the index and the folder is untouched. `akno index` rebuilds every chunk, embedding, summary, fact,
event and link from the Markdown.

> **Status: complete and in use.** Indexing, watching, retrieval, the write path, the inbox, `ingest` from a
> file, a folder or a URL with extraction and OCR, and the nightly maintenance cycle — developed and measured
> against a real 223-page knowledge base. Two parts ship switched **off** for reasons measured on that base
> rather than guessed: see [The maintenance cycle](#the-maintenance-cycle).

**New here?** [HOW-IT-WORKS.md](HOW-IT-WORKS.md) walks through every command and every background process in
plain language, with examples and diagrams. This README is the argument for why it is built this way.

---

## Why

Agents make things up when retrieval is thin. They get back disconnected fragments, no indication of what was
searched or what was missing, and no way to cite anything. Then they fill the gaps.

The usual answer is a longer prompt — "always retrieve first", "never claim it isn't recorded", "notice when a
value is superseded". A prompt is a suggestion. Akno's position is that this belongs in the memory layer,
where it runs every time:

- Retrieval returns **page and document cards with citations**, so every claim traces to its source.
- Absence is **a result** — and it distinguishes _nothing matched_ from _the index is unavailable_.
- A superseded value comes back **labelled as superseded**, not as a competing current claim.
- `question` mode reports **coverage**: which concepts of the question the results actually cover.
- Structure rules — where things go, what is quotable — are **enforced**, not requested.

## Quick start

macOS only, [on purpose](#platform). Requires Node 22.18+.

```bash
npm install -g @tenphi/akno
```

Akno refuses to start until you say which folder holds your notes — there is no sensible default for that.
The machine config lives beside the state directory:

```bash
mkdir -p ~/.akno && cat > ~/.akno/config.json <<'JSON'
{
  "akno_path": "~/Notes",
  "providers": { "local": { "base_url": "http://127.0.0.1:8080/v1" } },
  "models": {
    "embedding": { "id": "text-embedding-qwen3-embedding-0.6b", "dimensions": 1024 },
    "derive":    { "id": "gemma-4-12b-it" },
    "expansion": { "id": "llama-3.2-3b-instruct" }
  }
}
JSON
akno index
akno doctor
```

`index` before `doctor`: most of what `doctor` reports is counted out of the index. Then ask it something:

```bash
akno recall "when does the car insurance renew?"
```

```
ok mode=question 2 results 1180 tokens
  coverage ✓ car insurance  ✗ renewal date
  nothing returned covers "renewal date" — do not answer that part

household/car-insurance (knowledge, 0.931)
  Car insurance › Policy
  Vulpine Mutual policy for the household car, renews 4 Nov 2026.
  household/car-insurance:11  Premium: 33 EUR/month (raised at the 2026 renewal; was 28 EUR) ~0.94
```

Every line carries `file:line`. The `~0.94` is derivation confidence — how sure the deriver is that the line
states a well-formed durable claim, not how sure it is that the claim is true.

No notes to point it at yet? [`examples/demo-brain`](examples) is a small invented one — eleven pages with
the shapes that matter, and a table of things to try.

**Working on Akno itself** is a checkout rather than an install, and needs pnpm:

```bash
pnpm install && pnpm build
cp config/local.example.jsonc config/local.jsonc   # set akno_path and your model ids
pnpm akno index
```

`bin/akno` is a launcher that resolves the checkout and pins the Node major from `.nvmrc`; symlink it
somewhere on `PATH` and `akno` works from any directory without shadowing an installed copy's config.

## Configuration

Two files, and only one of them is ever committed.

| File                         | Committed           | Holds                                                                                  |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `config/default.jsonc`       | **yes**             | Every key, with a machine-independent default. Documentation as much as configuration. |
| `config/local.example.jsonc` | **yes**             | The template you copy.                                                                 |
| `config/local.jsonc`         | **no** — gitignored | Your knowledge base path, your endpoints, your model ids.                              |
| `.env`                       | **no** — gitignored | Secrets only.                                                                          |

Precedence, lowest to highest:

```
config/default.jsonc  →  <state_dir>/config.json  →  config/local.jsonc  →  AKNO_* env
```

An **installed** copy only sees the first, second and fourth: there is no checkout, so there is no
`local.jsonc`, and `config/default.jsonc` is the copy shipped inside `@tenphi/akno-core`. That is why the
quick start above writes `~/.akno/config.json` — for an install, the machine config _is_ the config. A
**checkout** adds `config/local.jsonc` on top, which is the layer that never gets committed.

**A config file never contains a credential.** It names the environment variable that holds one:

```jsonc
"providers": { "openai": { "api_key": { "env": "AKNO_OPENAI_API_KEY" } } }
```

So a config file is always safe to read, diff and paste into an issue. `akno config` prints the resolved
configuration with secrets redacted, and tells you which files it came from — the fastest way to check that
your `local.jsonc` is actually being read.

The first guided setup slice exposes the OpenAI minimum as an **experimental, non-writing preview**. It prints
the exact one-endpoint/two-model overlay and, with `--check`, sends only invented fixtures to verify both
embedding access and Luna's ranking transport/schema:

```bash
akno init --preset openai-luna --akno-path /path/to/markdown \
  --maintenance autonomous --dry-run --check
```

The command never writes configuration, installs a service, indexes, schedules maintenance, or changes the
knowledge base. Configuration writing remains mechanically blocked until the checked-in ranking release gate
passes. This is deliberate: a valid credential may allow Luna while the same OpenAI project denies every
embedding model, and writing that preset would silently replace semantic recall with lexical degradation.

Rules can also travel with the notes: if `<akno_path>/akno.json` exists, its `folders` block wins over both
config files, so structure rules are versioned alongside the knowledge base they describe. That file is read as
configuration and never indexed as a note.

Changing a rule takes effect on the next `akno index`, including for pages nobody has touched since. The
resolved rules are fingerprinted, so a pass that would otherwise report "223 unchanged" re-examines the pages
whose role or management policy actually moved — a rule edit that silently did nothing was one of the first
bugs found here.

## Models

Six roles, all optional, each degrading rather than failing. Any OpenAI-compatible endpoint can host multiple
roles. “One endpoint” does not mean “one model”: semantic retrieval still needs an embedding model, while one
general-purpose model may cover generation, expansion, vision, maintenance, and prompted reranking.

| Role      | Without it                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------- |
| Embedding | lexical search only — no semantic matching, and question-mode hypothetical expansion is inert     |
| Reranker  | hybrid score ordering instead of cross-encoder reranking; ordering is coarser                     |
| Derive    | no summaries, keywords, fact derivation, `remember`, naming an arrival, observations              |
| Expansion | recall searches the words you typed and nothing more                                              |
| Answer    | direct synthesis is unavailable; `answer` still returns compact related memory identities         |
| Vision    | photos with no text yield no page; OCR still covers scans and screenshots, which is most arrivals |

The reranker supports two explicit modes. `mode: "endpoint"` calls a native cross-encoder at `/rerank`.
`mode: "llm"` sends a bounded listwise request through the ordinary generative endpoint. The latter uses opaque
per-request candidate ids, constrains strict decoding to that request's exact id set, treats candidate text as
untrusted JSON data, requires every candidate exactly once, canonicalizes the coarse relevance grades, and
preserves the untouched fusion order with typed `rerank_failed` degradation if the response is missing,
duplicated, invented, or malformed. The compact response keeps each id attached to its grade; the model's
ordering is preserved within each grade, while grades remain authoritative across grades because they also
decide qualification.

Successful reranking also qualifies results. LLM grade `0` candidates are removed; native candidates below their
calibrated relevance boundary are removed. Candidates outside the bounded `top_k` window are reported as
`qualification.unjudged` and omitted rather than used to fill holes the ranker never approved. If every judged
candidate is rejected, recall returns honest `empty`. A failed reranker still preserves fusion order and reports
degradation—the filter is never applied to a response Akno could not validate.

Native score scales are learned automatically by default. `score_offset: "auto"` runs a small wholly invented
anchor suite, chooses a conservative boundary that rejects no positive anchor, and caches it in derived state for
seven days. If the model cannot separate the anchors, `qualification.basis` is `calibration_failed` and Akno
keeps all candidates. A measured numeric `score_offset` remains an explicit override; users do not need to guess
one during setup. `akno bench ranking --system native` reports how that portable boundary transfers to a
larger invented corpus, including direct-answer, supporting, marginal, irrelevant, and adversarial retention.

**`derive` and `expansion` are split because their constraints are opposite.** Derive runs off the hot path —
during indexing, on arrival, at night — and what it produces ends up in the notes, so it is allowed to be slow
and good. Expansion runs on every recall that asks for it, where a second of latency is felt in the answer.
Pointing both at one model is a perfectly good answer; pointing `derive` at a 12B and `expansion` at a 3B is
what a laptop wants, and it is what `config/local.example.jsonc` shows.

Reasoning effort is configurable per generative role and sent explicitly when set. A practical hosted minimum
therefore uses one OpenAI endpoint and credential, `text-embedding-3-small` for embeddings, and
`gpt-5.6-luna` for generative roles and prompted reranking. Expansion and reranking can use
`reasoning_effort: "none"`; slower derivation or maintenance can choose a higher effort independently. The
prompted reranker remains experimental until the relevance benchmark meets its release threshold.
`akno init --preset openai-luna --akno-path /path/to/markdown --dry-run --check` verifies the two required
model roles separately before setup, so “the provider works” cannot hide an embedding-specific access
restriction.

**Every prompt that asks for JSON also sends the shape as a JSON Schema**, so the endpoint constrains decoding
rather than the prompt requesting it politely — a llama-server compiles it to a GBNF grammar, and OpenAI's
strict structured outputs does the equivalent. The two speak different dialects, so the client tries
llama.cpp's `{"type":"json_object","schema":…}` first, steps down to OpenAI's `{"type":"json_schema",…}` on the
rejection OpenAI actually sends, and finally to a plain JSON request. That order is chosen by which rejection
is _detectable_: llama.cpp answers an unknown `response_format` shape with an error, but has a history of
accepting `json_schema` and applying no constraint at all. Each rung is learned once per role per process, and
the loose JSON parser stays behind all three — a schema removes the syntactic failures, not the need to check
that a fact's line number is one the model was actually shown.

**A rate limit is retried; a timeout is not.** A 429 or a transient 5xx backs off — obeying `Retry-After` when
one is sent, otherwise exponentially with full jitter — up to `providers.<name>.max_retries` times. A timeout
is left alone: the attempt has already spent its deadline, and the callers that care have a better answer than
repetition — a derivation that times out asks for the summary alone, which is both cheaper and likelier to
land. So is a transport error, which is usually nothing listening, and `doctor` should say so at once rather
than three backoffs later.

**The two deadlines bound different things, so retries spend them differently.** `recall.expansion_timeout_ms`
bounds _felt latency_ — someone is waiting — so it is the budget for the whole sequence, and a retrying recall
can never outlast one with retrying switched off. A role's `timeout_ms` bounds _an endpoint that has stopped
answering_, and nothing waits on a background derivation, so it applies per attempt: a 500 arriving late into a
long generation must not leave the retry a fraction of the budget that number was tuned for. Only refusals
returned without doing work are retried, which keeps a real sequence backoff-dominated and measured in seconds.

`akno doctor` reports which roles resolved, their latency, and **what each missing one costs**. Model latency
and index latency are reported separately, because a memory system that feels slow after idling is almost never
suffering from its storage engine.

The maintenance cycle can point at a different model than indexing uses — see
[The maintenance cycle](#the-maintenance-cycle) for why that turned out to matter more than any other setting.

There is no model downloading or serving in this repo. Models are configuration, pointed at an endpoint you run.

## The ops

The operation surface stays small on purpose: every additional choice is another chance for an agent to pick
the wrong one. `context` is normally called by the host rather than by the agent.

| Op         | What it does                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recall`   | Expand → lexical, semantic, and bounded graph candidates → rank fusion → qualification/rerank → cited cards under one budget. `--no-graph` disables graph.           |
| `answer`   | Run question-oriented recall and generate a cited answer. Reranking is opt-in; `include_context` returns the bounded evidence already used.                          |
| `read`     | One exact thing: a page by slug or id, or a document by id.                                                                                                          |
| `graph`    | Inspect bounded exact evidence paths and locators without returning page bodies or copied claims.                                                                    |
| `list`     | Browse structure: folders, pages by type/tag/role/recency, or a tree outline.                                                                                        |
| `timeline` | Authored events and typed orphan-document date evidence — by range, subject, source, or match.                                                                       |
| `context`  | The whole pre-turn bundle against **one** budget: pinned pages, recent timeline, structure, and this turn's recall.                                                  |
| `write`    | Create, append, patch or replace a page. Carries documents, events, tags and links.                                                                                  |
| `folder`   | Declare a folder and what belongs in it. Never gated — a folder needs a description, not an approval.                                                                |
| `remember` | Hand over a transcript; Akno decides what is worth keeping and where it goes. It sees the complete folder taxonomy and only writes into existing eligible folders. |
| `forget`   | Retract a fact by removing the sentence that produced it; trash a page or document.                                                                                  |
| `undo`     | Reverse a change by id.                                                                                                                                              |
| `move`     | Relocate a page with its documents.                                                                                                                                  |
| `ingest`   | Extract, OCR, name, summarize and route a file, folder or URL.                                                                                                       |

Every op is advertised over every door from one registry, with its schema, so a caller discovers what exists
rather than being told in prose.

## Three doors, one registry

```ts
import { open } from '@tenphi/akno-core';
const mem = await open({ aknoPath: '~/Notes' });
const { results } = await mem.recall({ query: 'car insurance renewal', budget: 8000 });
```

```ts
import { connect } from '@tenphi/akno-client';
const mem = await connect(); // unix socket, identical interface
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
exposes without a second code path that can grow its own bugs — it defaults to the five read ops, so an agent
reaching Akno over MCP cannot write until you say so. Add `"adopt"` to that list when the agent should be
able to invoke a document card's scoped, plan-backed filing action; this does not expose human plan decisions.

**Exactly one process may write.** It takes a lock file with its pid; a second process opens read-only and says
so, rather than racing. That is why `akno index`, `akno inbox` and `akno dream` are sent over the socket
to a running service and executed _there_, falling back to in-process only when no service answers. They are
commands rather than ops — the ops above are what an agent calls about memory, these are operator work about
the process — and they are socket-only, because that is the door where filesystem permissions are the auth.

**Why a long-lived process:** spawning a process per memory call costs ~33 ms against ~0.04 ms for a long-lived
handle. None of that is the database — opening a SQLite file is half a millisecond regardless of size. A unix
socket round trip is ~18 µs, which is why IPC cost is not a reason to embed.

## How your files are treated

**An index pass writes nothing into your knowledge base by default.** Not frontmatter, not fact tables, not a
`timeline.md` you did not ask for. Explicit write operations do. The scheduled dream cycle starts under the
`audit` profile, which may seal proposals but applies none until the owner chooses `review` or `autonomous`.
Install the watcher with `akno service install --no-dream` if you do not want scheduled maintenance at all.

- Identity lives in the index (`pages.id`), and a rename is followed by body hash. Set `write_ids: true` to have
  Akno add a frontmatter `id:` — the only index-time write into a page you wrote — for identity that
  survives a database rebuild and a move to another machine.
- `create_reserved_paths: false` by default, so a first run against an existing folder creates nothing.
- If a reserved path exists and isn't what Akno expects — a `timeline.md` that is a project plan — it is left
  completely alone. `doctor` reports it and points at the config key to remap it.
- Every frontmatter key except Akno's own `id` and `akno` policy block is preserved byte for byte.
- The one way a caller changes a declaration is to send it: `write({content})` whose text opens with a
  frontmatter block adopts that block as the page's, verbatim, and the reply names any key the old block had
  and the new one does not. `role`, `management` and `temporal` are declarable nowhere else in the write API,
  so this is deliberate rather than a leak — and it is what stops a page accumulating a second block, since
  `read` returns the file with its frontmatter and a revised page comes back carrying one. `append`, `patch`
  and `replace` never touch the head; a block arriving in one of those is text somebody pasted.

Four workflows author files, and each is journalled and reversible with `akno undo`: `write`, `remember`,
`ingest`, and enabled maintenance phases. Dream can append observations, curate opted-in pages, adopt unowned
documents, and apply bounded broken-link items through maintenance plans. The default `audit` profile allows no
automatic maintenance write.

A separate optional output is maintained rather than journalled. `ingest.text_rendition: true` keeps the
extracted text of each readable document as `<file>.txt` beside it — so a `grep`, an editor, a git diff or an
agent holding the folder can read a scanned contract without OCRing it again. Akno itself never needs it: the
text is indexed against the document and `read({document})` returns all of it. A rendition is recognised as the
same document rather than a second one, so it costs no extra summary and returns no second hit; one you have
edited by hand is left alone, and one you delete stays deleted.

## Page roles and management

Not everything in a knowledge base is knowledge. A lot of it is **evidence**: contract text, emails, statutes,
transcripts. You want it stored and findable. You do not want a fact extractor asserting things from it, or
eleven pages of contract text landing in a retrieval budget.

| Role                    | Indexed | `recall` returns                                        | Fact-mined |
| ----------------------- | ------- | ------------------------------------------------------- | ---------- |
| `knowledge` _(default)_ | yes     | summary + matching lines; whole body on `depth: "full"` | yes        |
| `source`                | yes     | summary + a capped quote window                         | **no**     |
| `inference`             | yes     | matching derived interpretation, ranked below knowledge | no         |
| `ignored`               | no      | nothing                                                 | no         |

> Source pages are evidence. Knowledge pages are claims. Only claims become facts.

A knowledge page can switch to evidence mid-body at a `<!-- source -->` fence: above it, canonical and mined;
below it, indexed for search but never mined and never returned whole.

Role is a **relevance policy, not access control** — `read({slug})` returns the full body of a `source` page
every time, and `recall({ include: ['source'], depth: 'full' })` lifts the cap.

Automatic write authority is a separate dimension. `remember: integrate|deny` controls whether retained
knowledge may be placed on a page; page frontmatter overrides folder policy, which overrides role defaults.
`dream: none|hygiene|synthesize` is deliberately page-only and controls unattended maintenance: hygiene may
make conservative formatting and local-language repairs, while synthesis may rewrite and reorganize a
canonical page, accumulate linked evidence, preserve unresolved conflicts, and split oversized coherent
sections beneath the canonical slug. Synthesis may also extract one reusable subject from a mixed-purpose
page into an independent page in an existing or declared eligible knowledge folder. A split says “this is part of the
same subject”; an extraction says “this deserves its own subject and can be reused elsewhere.”

Opt-in is permission, not a nightly work order. Hygiene runs again only after the page or its policy changes.
Synthesis also watches its linked evidence and unresolved conflicts. Unchanged drafts and guard-rejected
rewrites are fingerprinted in the disposable index; they are reconsidered only when those inputs change. An
unfinished plan is reused at the same authority; changing authority can reseal the current exact input through
the newly authorized lifecycle.

Bounded event pages are time-aware. Curation first uses explicit date fields and structured event slugs, then
lets the model select only from complete dates actually present in an ambiguous page. With writes enabled it
adds a journalled, surgically inserted Akno-owned boundary:

```yaml
akno:
  temporal:
    kind: event
    start: '2031-04-10'
    until: '2031-04-12'
    timezone: 'Europe/Amsterdam'
  management:
    dream: synthesize
```

A date-only `until` includes the whole day in the event timezone; an exact timestamp is used only when the page
actually supplies an end time. Set `akno.temporal: false` to keep a date-heavy evergreen page out of automatic
classification. The current timestamp and timezone are supplied to drafting and verification but do not enter
the daily fingerprint. Crossing `until` changes the page exactly once into archival synthesis. After that,
only a direct page edit, explicit `about` evidence, a directly relevant fact, or a targeted timeline event wakes
it; ordinary link churn does not. The archival pass never treats a plan as something that happened merely
because its date passed, and an event with no meaningful later knowledge is left byte-for-byte alone.

```yaml
akno:
  role: knowledge
  management:
    remember: integrate
    dream: synthesize
  about:
    - people/ada-marlow
```

`about` names the entities a page contributes evidence about. A canonical entity page does not point at
itself, and aliases equal to its title, slug, or basename are discarded as redundant.

Indexing also projects exact page links, `about`, document ownership, and event participation into a disposable
evidence graph. Every knowledge page anchors a separate canonical entity node; source and inference pages stay
evidence rather than silently becoming canonical records. Canonical slugs, declared aliases, and unique exact
title or basename matches resolve after Unicode, case, and punctuation normalization. Every `about` value is
recorded as exact, ambiguous, or unresolved, but only an exact result becomes a traversable edge. Valid links
to knowledge pages also produce exact mention edges.

Every edge retains a current source hash and a line, frontmatter field, document, or event locator. This graph
also projects derived facts whose subjects resolve exactly. Scalar values remain attribute facts; values that
resolve exactly to another entity create entity-to-entity relationships. Low-confidence, unresolved,
unverified, qualified, and non-current conflict claims do not become current traversable edges. Superseded
authored facts may remain as explicitly historical edges with their original validity bounds.

`akno graph` exposes this derived state as bounded, read-only evidence paths. Seed one exact page slug,
canonical entity id, or query containing exact declared entity names; restrict direction or relation; and
traverse one to three hops. Results contain compact node identities and source locators, never page bodies or
copied claims. Ambiguity, partial indexing, unavailable document evidence, and safety-cap truncation remain
typed rather than becoming guessed paths or false proof of absence.

`recall` also uses exact query entities and up to three qualified lexical page hits as bounded two-hop graph
seeds. Graph candidates join lexical and semantic candidates through rank fusion, then pass through the same
reranker, irrelevance qualification, filters, assembly, and budget. Returned cards expose `matched_by` and a
compact node/relation/locator path; they still cite ordinary page lines or document quotes as evidence.
Optional contextual disambiguation can choose only among existing exact-name candidates. It is off by default
and should be enabled only after `akno bench entities` passes for the configured derive model. A choice needs
one grade-3 candidate and no alternative above grade 1; everything else abstains. Accepted edges are marked
`contextual`, use conservative confidence, and are invalidated when the source, candidate pages, model, or
prompt changes. The model cannot discover, create, merge, rename, or write entities.

## Documents

`akno ingest <path>` does in one call what is otherwise three instructions in a prompt: run extraction and
OCR, give `IMG_4821.HEIC` a name that means something, and decide where a dropped file belongs.

**Extraction uses what macOS already has.** PDFKit reads a text layer; the Vision framework does OCR. A
~200-line Swift helper is compiled on first use (about 6 seconds) and cached in `~/Library/Caches`. Measured on
Apple Silicon:

|                                            |                                                     |
| ------------------------------------------ | --------------------------------------------------- |
| PDF text layer, 9 pages                    | 0.12 s                                              |
| Receipt photo, OCR                         | 1.4 s at 0.99 mean confidence                       |
| 4-page bill, forced OCR                    | 2.4 s, recovering 99.5% of what its text layer held |
| Whole `ingest`: OCR + name + route + index | ~8 s                                                |

The alternative was `brew install poppler tesseract`, which makes a memory layer's first run depend on two
unrelated projects being installed and on their CLI flags not changing. Since Akno is macOS-only on purpose,
using the platform's own frameworks is the honest choice rather than a shortcut — and Vision is both faster and
more accurate than tesseract.

Office formats go through `textutil`, which also ships with macOS. The vision role is optional and only reached
when OCR finds _no_ text in an image — a photo rather than a document.

**Three things `ingest` refuses to do:**

- **Rename a file whose name already says something.** `2024-lease-agreement.pdf` is kept; `IMG_4821.HEIC` is
  not. Renaming is the one destructive act here, and a name someone chose carries intent no model can
  reconstruct.
- **Name a file it could not read.** Below `ingest.name_confidence` the file keeps its name, gets no page, and is
  reported. A confident wrong name is worse than none.
- **File a document it cannot place.** Nothing clears `route_threshold` → the file stays where it is with a
  proposal. An inbox with three things in it is a to-do list; a misfiled document is a lost one.

Stored files are content-addressed as `<page-basename>-<sha8>.<ext>`, so they are unique by construction and
re-ingesting the same bytes is a no-op that tells you where they already live. Every page records **where its
text came from** — a text layer, OCR with its confidence, or a vision model's _description_ — because those are
different claims and reporting them identically would be a false one.

### A file, a folder, or a URL

```bash
akno ingest ~/Downloads/policy.pdf          # one file
akno ingest ~/Downloads --limit 20          # one level deep, a verdict per file
akno ingest https://example.com/policy.pdf  # fetched, then treated identically
```

A folder is walked **one level deep**. A recursive pass over a folder someone pointed at by mistake is a
thousand model calls and a knowledge base full of pages nobody asked for; a flat pass over `~/Downloads` is the
case that actually comes up. Every file gets its own verdict, one unreadable file does not abandon the rest, and
a `--limit` that cut the pass short says so — a silent cap reads as "that was all of them".

A URL is fetched with three limits worth naming: **http and https only** (`file://` would make `ingest` a way to
read any path on the machine through something that looks like it fetches the web), the size cap applies to
**the bytes that arrive** rather than to the `Content-Length` a server claims, and the filename comes from
`Content-Disposition`, then the URL, then the content type — each of which can be useless, which is fine,
because naming happens from the content anyway. The final URL lands in the page's `source_url`, since "where did
this come from" is the one question a downloaded document cannot otherwise answer.

### The inbox

A folder where you drop anything and it files itself. `route: true` is what makes a folder an inbox — not its
name:

```jsonc
"folders": {
  "inbox/**": { "ingest": "auto", "route": true }
}
```

`akno serve` processes arrivals as they land; `akno inbox` does a one-off pass. Above `route_threshold` the
file and its page move to where they belong. Below it, the file **stays in the inbox** with a proposal — visible
where you dropped it, rather than filed confidently into the wrong place where you would never look for it.

**The inbox is the only place Akno moves files.** A file dropped straight into `documents/` was put there on
purpose: Akno will name it, page it and index it, but never relocate it. Every move is journalled and
reversible with `akno undo`.

Routing scores candidate folders by relevance and refuses below the threshold, and both halves of that are
load-bearing. Two bugs found on real data: a query built from the document's summary _plus 400 characters of its
text_ collapsed the spread across folders from 0.49 to 0.014 — everything at 0.98, so nothing could fail the
threshold and the winner was noise. And below the threshold, routing used to fall through to whatever folder the
model suggested, overriding a correct refusal with a weaker signal. A water bill reached `travel/2026`
twice before both were fixed.

### A document's own text is indexed as the document

Every attachment is extracted on arrival — including the ones that predate Akno, or that someone dropped into
a folder by hand. Their text is chunked **per page of the document** and indexed against the document itself, so
a stored PDF is searchable by its own content and a hit can say which page it is on:

```
recall "who replaced the drain pump"

  household/dishwasher-repair-2026-08 (knowledge, 0.91)
    household/dishwasher-repair-2026-08-8e7705eb.pdf p1
      MERIDIAN APPLIANCE CARE
      Replaced the drain pump
```

The text deliberately does **not** go into the Markdown page. Document text is derived from the _file_ and
invalidated when the file's hash changes, which a page body cannot honour; indexing the same words twice made
every match inside a document arrive as two hits against one recall budget; and a copy pasted into someone's
page is a copy no later change to the file can ever correct. The page says what the document is and where it
lives — what a person would have written — and recall quotes the document as a quote, attributed to the document
and its page, never as a line citation on a page that has no such line.

A document does not need an owning page to be found. Readable orphan documents are indexed under their own
stable identity and returned as `type: "document"`, with their relative path, bounded quote, extraction method,
and a handle accepted by `read({document})`. Owned document hits remain nested under their page and are never
duplicated as standalone results. Ownership still adds useful organization; it comes from a matching stem,
Akno's content-addressed filename, or a page embedding the file with `![[filename]]`.

If an original document disappears outside Akno, its identity and extracted evidence are retained instead
of becoming “nothing recorded.” Recall and read expose a typed `availability`: a surviving indexed copy or text
rendition is `degraded`; an identity with no readable copy is `unavailable`; restoring the original returns it
to `available`. Exact filename recall still finds an unreadable identity. Explicit `forget({document})` remains
the retraction boundary and removes the retained chunks as well as trashing files that are present.

`timeline` can also return dated orphan documents as `type: "document_evidence"`. A date found in the text is
returned with a bounded quote, page number when available, and extraction provenance. If no supported date can
be extracted, one explicitly labelled `file_created` or `file_modified` metadata result may be used instead.
Model-generated image descriptions cannot supply extracted dates. These are
source observations, never authored events; `results` is the mixed view and the compatibility `events` field
continues to contain authored events only.

**A scanner that produced `passport.pdf` and `passport-2.pdf` produced one document, not two.** Files that
differ only by a trailing `-<n>` are read as parts of one document: one owning page, one summary, and page
numbers that run through the whole thing — so a hit on the second file's first page is cited as page 5 of the
passport, which is a page a reader can actually look up. `read({document})` on any part returns all of it, and
says how many files it is made of.

The rule is narrow on purpose, because the cost of a wrong guess is two unrelated documents welded together with
one summary describing neither: the extension has to match (`passport.jpg` beside `passport.pdf` is another
rendition, not a second half), the suffix has to be one or two digits and not follow another digit
(`waternet-annual-bill-2026-07-28.pdf` is not part 28), the folder has to match (two people can each have a
`residence-permit-2.jpg`), and part one has to exist.

### Attachments on `write`

`write` takes documents too, for when the caller already knows where something belongs:

```bash
akno write --slug home/dishwasher --append "Repaired on 4 August." \
             --attach ~/Desktop/receipt.pdf=The invoice
```

The file is copied in beside the page, content-addressed off it, extracted, and embedded with `![[…]]` plus a
line recording where its text came from. The document's own text is indexed against the document, exactly as
above — so the receipt is searchable by its contents without a word of it being pasted into the page you wrote.
Nothing is routed or named, because the caller already decided both.

## The maintenance cycle

`akno dream` runs seven selectable, repeat-safe phases. Conflict classification runs first so unresolved or
unverified claims cannot feed observation, reflection, or synthesis. Selecting `observe`, `reflect`, or
`curate` alone still performs that prerequisite inspection.

| Phase          | Writes?    | What it does                                                                                                                                                                                                      |
| -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conflicts`    | no         | Classifies incompatible cross-page facts as safe, time-scoped, superseded, qualified, unresolved, or unverified; disputed claims are withheld from inference.                                                     |
| `observe`      | plan/write | Combines conflict-eligible repeated facts into stable patterns, then seals exact append-only items with source hashes. Off by default.                                                                            |
| `reflect`      | plan/write | Decision principles built from sealed observation-page evidence, with append-only verified plans. Off by default.                                                                                                 |
| `curate`       | plan/write | Hygiene, synthesis, split, extraction, exact-alias merge, broken-link fixes, and plan-backed contradiction handling for explicitly opted-in pages. Draft, verifier, curator, and deterministic guards must agree. |
| `adopt`        | plan/write | Exact low-risk filing-page items for readable orphan documents, with sealed source hashes and ownership verification.                                                                                             |
| `repair`       | no         | Legacy compatibility view of exact broken-link proposals. Durable fixes are low-risk `curate` plan items.                                                                                                         |
| `housekeeping` | no         | Broken links, orphaned documents, rule drift, and read-only graph review candidates for identity collisions, unresolved authored subjects, and traversal hubs.                                                    |

`observe` and `reflect` only ever append: a changed conclusion gets a new dated line, nothing is deleted. Both
use durable per-conclusion plans under their resolved transformation policy. Writing phases are journalled by
purpose, so reversing a night's
inferences does not also reverse the pages that made documents searchable. `conflicts`, legacy `repair`, and
`housekeeping` only report. Graph candidates carry no operation and grant no merge, creation, or rewrite
authority; private identities appear only with `--private-details`.

For a coherent scheduled policy, set one profile:

```jsonc
{
  "maintenance": { "profile": "audit" }, // or review, autonomous
}
```

`audit` seals plans without applying them. `review` waits for human decisions. `autonomous` uses a separate
curator call and applies only accepted, verified items. Enabled observation and reflection phases follow that
lifecycle. Profiles enable plan-backed observe/reflect/curate/adopt behavior but
do not override page opt-ins, folder restrictions, merge allowlists, guards, or limits, and do not enable the
model-sensitive observe or reflect phases themselves.

Individual transformation classes can be stricter than the profile:

```jsonc
{
  "maintenance": {
    "profile": "autonomous",
    "policies": {
      "observe": "auto",
      "reflect": "auto",
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

Policy keys are `observe`, `reflect`, `hygiene`, `synthesis`, `split`, `extract`, `merge`, `contradiction`,
`broken_link`, and `adopt`; values are `off`, `audit`, `review`, or `auto`. Omitted keys inherit the profile.
Policy is sealed per item, allowing one plan to apply autonomous repairs while leaving higher-risk proposals
for human review. A command-line mode can only lower every effective item policy.

Both inference tiers use the same modes when enabled:

```bash
akno dream --phase observe --mode audit   # exact append/create diff; no observation write
akno dream --phase observe --mode review  # wait for a human decision per pattern
akno dream --phase observe --mode auto    # separate curator, append, reindex, verify
akno dream --phase reflect --mode audit   # exact principle diff; no write
akno dream --phase reflect --mode review  # wait for a human decision per principle
akno dream --phase reflect --mode auto    # separate curator, append, reindex, verify
```

Each observation item seals the exact output plus the current hash of every cited knowledge page. Apply refuses
changed evidence, never edits an earlier pattern, journals each accepted pattern independently, and verifies
that the result is indexed as derived inference with exactly the sealed citations. An unchanged human or
curator rejection is not resubmitted until the conclusion, evidence, or destination input changes. Reflection
uses the same checks with a floor of at least three distinct live observation pages and writes only
`observations/principles.md`.

A full named-profile or explicit-policy run has a planning barrier: conflicts and every enabled writable
planner seal their phase plans before the first curator call or knowledge-base write. Automatic plans are then
decided in `observe` → `reflect` → `curate` → `adopt` order, then accepted items apply in stable dependency
order with one shared budget; repair and housekeeping inspect the resulting state. A selected `--phase` remains
immediate while using the same policy and plan lifecycle.

Before the curation plan is sealed, Akno can resolve one narrow dependency cycle without guessing at a merged
document. If two to four independently drafted `hygiene` or `synthesis` replacements target different pages
and each page was evidence for another replacement, compatible drafts with the same policy and risk become one
atomic plan item. Their exact proposed bytes are not regenerated or text-merged: one curator sees every complete
before/after operation and all sealed evidence, then all preimages are rechecked and every page applies,
reindexes, verifies, rolls back, recovers, and undoes as one unit. A rejection suppresses every unchanged
component. Same-path edits, mixed transformation classes or policies, more than four components, and oversized
review payloads remain separate and use the ordinary dependency/replan path.

At the barrier Akno blocks a remaining later automatic item if it would write the same path as an earlier item, or if
an earlier write would invalidate its sealed input. The item skips its curator call and all writes, reports
`dependency_conflict`, and unrelated work continues. After those independent items apply and reindex, Akno
replans every affected phase once from the resulting state, seals all of those retry plans, and passes them
through one final decision/apply barrier with the same run budget. The obsolete pre-apply plan remains visible
as `superseded`. A dependency that still exists after this bounded retry waits for the next full cycle.

The barrier also parses exact proposed Markdown outputs. If one item creates a canonical page referenced by
another item's wikilink, Markdown link, or `akno.about`, the creator is applied and verified first even when
its phase normally comes later. Curator decisions still all finish before either write. Duplicate planned page
identities and reference cycles are blocked; if the creator is rejected, stale, or budget-deferred, its
dependant writes nothing with typed status `dependency_unmet` and is replanned on the next full cycle. A same-run
retry would be unsafe because its required page still does not exist. Deletions are checked in the other
direction: if another sealed output would still reference the deleted canonical page, the new deletion waits
and replans after that output is indexed. Interrupted deletion recovery retains priority, so a new referencer
waits instead. Both cases report `dependency_conflict` without exposing either path.

Akno also revalidates every automatic item's sealed operation and evidence bytes before any curator call. A
changed item reports `snapshot_drift` and is replanned next cycle rather than in the same run, while apply
repeats the check after approval in case a later edit arrives.

The `limits` block is one cumulative apply budget. A full `akno dream` shares it across observe, reflect, curate, and adopt;
`akno plan apply` and direct `akno adopt` each receive a fresh budget. Planning and audit/review output are
not truncated. Instead, apply reserves a complete atomic item before its first write. `max_items` counts logical
transformations—normally one per plan item, but every independently drafted component in a composed curation
item still counts. `max_high_risk_items` follows the same rule for high-risk components.
`max_files_changed` counts distinct paths, `max_bytes_written` counts the full UTF-8 output of creates and
replacements. Zero is valid, including zero high-risk writes.
An item that would cross any ceiling changes nothing, returns to `proposed` with the typed
`budget_exhausted` reason, and can be reconsidered with a fresh budget on a later run. `akno dream status`
shows both configured ceilings and any budget-deferred backlog; each run receipt records exact usage.

Curate is included whenever at least one curation transformation policy is not `off`. Opted-in hygiene and
synthesis pages use the profile, a lower per-transformation policy, or a lower one-run mode:

```bash
akno dream --phase curate --mode audit   # persistent exact diffs; no note changes
akno dream --phase curate --mode review  # wait for human item decisions
akno dream --phase curate --mode auto    # separate curator turn, then verified apply
akno dream --phase curate --mode audit --private-details  # include private page-level diagnostics
akno dream --phase adopt --mode audit    # exact filing-page diffs; no page creation
akno dream --phase adopt --mode review   # human decides each document group
akno dream --phase adopt --mode auto     # separate curator, apply, ownership verification
akno adopt <document-id>                 # same policy, one recalled document group only

akno plan diff <plan-id>
akno plan decide <plan-id> --item <item-id> --approve
akno plan apply <plan-id>
akno dream status
```

All three modes seal the same exact operations and each item retains its effective transformation policy.
Apply refuses changed inputs, journals each item separately,
re-indexes it, verifies disk and index state, and rolls back a proven failed result. Synthesis items retain the
bounded evidence graph given to the independent curator. A split is one atomic item: it replaces the canonical
page and creates every child together, or changes nothing. A command-line mode can cover the full run or one
selected phase and may lower, but never raise, configured authority. Stable item markers and provenance survive rewrites and moves,
and a split keeps the canonical `page.md` while adding children under `page/`. An extraction instead moves
one exact source section of authored Markdown verbatim into an independent page, leaves a managed source bridge
and destination backlink, and uses only an existing or declared folder whose effective policy is integrated knowledge.
The replacement and creation are still one collision-checked item and one undo. See the
[dream-cycle guide](HOW-IT-WORKS.md#the-dream-cycle-phase-by-phase) before enabling writes.

An exact-alias merge is a high-risk plan item available only in configured `merge_folders`. It preserves every
unique authored line, rewrites all eligible inbound links, records the retired slug and title as aliases, and
deletes the duplicate in one verified, undoable transaction. Conflicts, document ownership, protected inbound
pages, ambiguous identity, or unique frontmatter without a lossless disposition block the merge.

Contradictions use the same high-risk plan path. `not_a_conflict` and explicitly `time_scoped` claims need no
edit. `unresolved` adds a managed warning while retaining both authored claims. `superseded` may turn only the
stale line into history. `qualified` may prefix one broad claim with a short scope copied exactly from a
different claim that also states the broad claim's value. Every affected page must declare
`dream: synthesize`, and exact before bytes for all evidence pages are sealed. Supersession additionally
requires an explicit dated as-of/effective/from/since boundary; the same date is copied into history and no
other numeric value may be added. Qualification adds only the evidence phrase and fixed connective Markdown;
it cannot invent an opposite scope or paraphrase the authored claim. Model confidence, page order, and indexing
date cannot select a winner.

Synthesis has a deterministic materiality floor: cosmetic headings, formatting-only rewrites, and pure
reorganization never reach the curator. Completed unchanged and rejected inputs are fingerprinted in
plan-backed mode too, so later runs do not resample them unless page, evidence, conflict, or temporal inputs
change. Long runs print content-free planning/curator/apply progress. Dream output and `--json` are redacted by
default; `--private-details` deliberately includes page names and source-level diagnostics.

`akno service install` also writes a nightly launchd agent (`dev.akno.dream`, 03:00 by default), which is
how the cycle runs on a schedule. `--no-dream` skips it, `--dream-hour` moves it.

**`akno redeploy` applies a local change.** It builds, restarts `dev.akno`, and then waits for the socket
to come back — `launchctl kickstart` returns when launchd has spawned the process, not when it is listening, so
without the wait the next command fails with "no Akno service at …" and reads like a broken deploy. The two
steps serve different consumers: launchd runs the CLI TypeScript directly, but that CLI imports
`@tenphi/akno-core` from `packages/core/dist`, so core changes require the build and the running service needs
the restart. Hosts importing `@tenphi/akno-client` also read package `dist` output. `--no-build` restarts only;
`--no-restart` builds only. A failed build restarts nothing, so a deploy never reports success with the previous
code back in service.

**`adopt` files documents; it does not make them searchable.** An orphan is already returned as a document card.
`adopt` plans the page `ingest` would have written — the title from the filename, the body from the summary
extraction already produced, then the embed that gives the document a browsable home. One document group is one
low-risk item. Apply re-hashes every source, confirms it is still unowned, creates and journals only the sealed
page, forces ownership re-indexing, and verifies the relationship. It honours a folder rule of `ingest: "file"`,
turns a target-path collision into a blocked plan instead of inventing a near-duplicate, and is capped per run
so a folder of 500 unowned PDFs does not become 500 pages before anyone has read the first report. A recall
document card includes a typed action for the single-document form, `akno adopt <document-id>`; invoking it
plans only that document group. The nightly `adopt` phase remains the bounded bulk form. Both use the configured
audit/review/auto policy, and auto still requires a separate curator decision.

Here “owned” means “attached to a Markdown page by an embed.” It does not mean a human account, access control,
or multi-user ownership; Akno currently treats the brain as one shared knowledge base.

**`observe` ships off, and what it produces is almost entirely a function of the model behind it.** Its
guardrails are enforced in code, not asked for in a prompt: at least two distinct source pages, every cited slug
checked against what the model was actually shown, `full` pages only, no observation admissible as evidence for
another, no hedged language, nothing about a person's private life, and nothing that describes the records
rather than what they record. The same pass over the same knowledge base:

| Cycle model        | Candidates | Refused by a guard | Worth keeping |
| ------------------ | ---------- | ------------------ | ------------- |
| local 3B           | 15         | 18                 | about four    |
| a strong API model | 8          | **0**              | most of them  |

The guards hold either way — with the better model they never had to fire. What they cannot do is make a small
model insightful, which is why the tier is opt-in and why `maintenance.model` exists: the cycle runs unattended
once a night and is worth a better model than per-turn work needs, without sending every recall expansion to a
paid API. Read the first run with `--dry-run`.

Two findings from that base shaped the tier. Grouping facts by the subject a deriver assigned joined a bag with
a drum kit and a Roman church with a person's page, because a small model writes the _attribute_ into that field
— grouping is now by folder and subject. And the prompt rule against inferring about someone's private life was
not enough on its own: a run wrote "…lives with a wife" anyway, which is why that rule is now a code guard with
a test.

The same run is why the conflict pass reports rather than repairs. It found five cross-page candidates and the
model correctly cleared all five — three months of banking pages stating different totals, and three Rome
addresses under one `location` heading. A pass that had "fixed" those would have destroyed correct records.

## Performance

`akno bench` asserts storage-path budgets against the configured knowledge base and retrieval quality against
a fixed corpus of invented pages, owned documents, and orphan documents. That split catches both kinds of
regression: a fast wrong answer and a correct slow one. The configured-base timings below were measured against
221 indexed pages and 1,142 chunks (1,069 from page bodies and 73 from inside documents), Apple Silicon:

|                              |            |                          |
| ---------------------------- | ---------- | ------------------------ |
| Structural index, cold       | 255 ms     |                          |
| Re-index, nothing changed    | **5.4 ms** | budget 50 ms             |
| First query, index path only | 3.4 ms     | budget 50 ms             |
| `recall`, lexical only       | 2.0 ms     | budget 20 ms             |
| Point lookup by slug         | 0.3 ms     | budget 10 ms             |
| `timeline`, 6-month window   | 0.1 ms     | budget 20 ms             |
| `recall`, hybrid + rerank    | 2,010 ms   | _reported, not budgeted_ |

The fixed mixed-result corpus is asserted on every run:

| Assertion                                  | Required |
| ------------------------------------------ | -------- |
| Orphan recall at 3                         | 100%     |
| Owned/standalone duplicate document rate   | 0%       |
| Page-only recall at 2                      | 100%     |
| Page-recall change after mixed assembly    | ≥ 0      |
| Two-hop graph-only discovery at 5          | 100%     |
| Graph path provenance completeness         | 100%     |
| Direct-query top-1 preservation with graph | 100%     |
| Lexical hits with typed model degradation  | 100%     |
| Mixed assembly and budget fitting, p50     | ≤ 20 ms  |

`akno bench --retrieval-only` runs only that invented corpus. It neither opens the configured knowledge base
nor calls its models, which makes it the safe, reproducible quality gate for CI and ranking changes.

`akno bench graph` runs the separate frozen, model-free graph gate. Its 62-page, 25-case held-out corpus
covers every exact identity signal, Unicode/case normalization, a stable-id move, ambiguous names, explicit
subjects, one-to-three-hop traversal, edge provenance, scalar and entity facts, history, unverified conflicts,
hub truncation, missing and orphan documents, instruction-shaped evidence, graph-only false positives,
maintenance discovery, rebuild equivalence, and index byte preservation. Every correctness ratio must be
100%, graph-only false positives must be zero, graph p95 must stay within 100 ms, and the existing mixed
retrieval gate must also pass. It opens neither the configured knowledge base nor any model. `--output` stores
the content-safe result atomically; the artifact records that independent corpus review is still pending.

`akno bench ranking --probe` is the separate opt-in live smoke check for prompted reranking. It sends three
invented excerpts—including one instruction-bearing irrelevant passage—to the selected provider, and reports
transport, schema, order, labels, and latency. It never opens the index. Passing verifies the integration, not
the larger relevance release gate.

`akno bench entities` runs the separate contextual-identity gate against eight invented same-name cases. It
never opens the configured knowledge base. The gate requires valid structured responses, perfect selection
precision, and perfect abstention on deliberately indistinguishable and instruction-bearing inputs before the
off-by-default feature should be enabled.

`akno bench ranking` runs the 60-query development side of an invented 80-query corpus without opening the
knowledge base. The corpus has 120 sources, 40 candidates per query, 3,200 stable-id judgments, and a fact-level
60/20 development/test split that preserves all eight categories on both sides. A normal run selects the first
20 candidates; `--candidates 10|20|40` changes that window without changing the frozen pool. It compares the
same candidates across rank fusion, the configured native reranker, or a prompted LLM:

```bash
akno bench ranking --system fusion
akno bench ranking --system native
akno bench ranking --system llm --provider openai --model gpt-5.6-luna --reasoning none
akno bench ranking --system llm --provider openai --model gpt-5.6-luna --reasoning low
```

The repeatability matrix compares no reasoning at 10, 20, and 40 candidates with low reasoning at 20. Fusion
and an available native reranker provide references. LLM variants run five times by default, with bounded
request concurrency; reported latency remains per request rather than hiding it behind wall-clock parallelism.

```bash
akno bench ranking --matrix --concurrency 4 \
  --output benchmarks/ranking/results/development-openai-luna.json
```

The artifact contains aggregate metrics, prompt/schema identifiers, and stable invented candidate ids for the
top three results. It contains no knowledge-base text, endpoint URL, credential, or raw model request. Writes
are atomic, so an interrupted benchmark cannot leave a result that appears complete.

The end-to-end track then tests the matrix selection through the production index and recall path. It creates a
temporary knowledge base containing the same invented 120 sources, embeds it, measures whether each direct
answer reaches the selected candidate window, and separately measures the final assembled order after
reranking. It never opens the configured knowledge base. Passing `--matrix-artifact` binds the run to that
matrix's exact split, candidate count, excerpt limit, provider, model, reasoning effort, prompt, and schema, then
attaches the evidence atomically:

```bash
akno bench ranking --track end-to-end \
  --matrix-artifact benchmarks/ranking/results/development-openai-luna.json \
  --output benchmarks/ranking/results/development-end-to-end-openai-luna.json
```

For an OpenAI matrix selection, the single-endpoint defaults are `text-embedding-3-small` at 1,536 dimensions
plus `gpt-5.6-luna`; both roles must use the same provider. The report records embedded/total chunks and fails
before candidate queries when the embedding role is disabled, denied, or incomplete. This prevents lexical
fallback from being reported as evidence for an embedding model that never ran. Candidate misses and ranking
misses remain separate because a reranker cannot recover evidence absent from its input window.

Development is the default. `--split test` explicitly selects the held-out 20 queries; prompt work must use the
default split so test evidence is not quietly turned into tuning data. Only generic distractors and adversarial
snippets cross the boundary—answer, support, marginal, and stale fact sources do not.

The report covers overall and category-level nDCG, reciprocal rank, top-result success, hard-negative inversions,
response validity, latency, and qualification separately. Qualification distinguishes retained direct answers,
strong support, marginal context, rejected grade-0 candidates, and instruction-bearing negatives. Its
development gate requires a valid response for every query, no nDCG regression from fusion, every direct answer
retained, and every instruction-bearing negative rejected.

Matrix selection is deliberately separate from release. It chooses the least expensive comparable variant:
`none` wins unless `low` improves nDCG@10 by more than 0.01, then the smallest equivalent candidate window
wins. The mechanical release gate still requires an explicitly selected held-out run, independent corpus
review, a persisted artifact, end-to-end direct-answer candidate recall at the selected window, five
repetitions, quality and exact-entity floors, valid/fallback-safe responses, perfect instruction-negative
rejection, stable top-three results, and the latency budget. The selected prompt and schema must also match the
current runtime contract, so refreshing an old artifact cannot authorize unbenchmarked code. A useful
development result can therefore recommend the next experiment without silently authorizing the setup preset.

The current [v4 development matrix](benchmarks/ranking/results/development-openai-luna-v4-2026-08-22.json)
selects Luna with `none` reasoning and 10 candidates. Across five runs it reached 0.962 mean nDCG@10, 100%
median top-three overlap, 100% valid responses, 100% direct-answer and instruction-negative retention/rejection,
zero fallbacks, and 2.26 s aggregate p95 latency. The optional native reference reached 0.907 nDCG and 1.13 s
p95. `none` at 20 and 40 candidates reached 0.958/0.941 nDCG and 3.71/9.82 s p95; the 40-candidate variant had
12 fallbacks. `low` at 20 reached 0.943 nDCG and 5.65 s p95 with one fallback. The smallest window without
reasoning is therefore both the selected quality-equivalent configuration and the fastest prompted-ranking
variant tested.

Every development-side release check now passes: current persisted contract, five runs, overall and category
quality, exact-entity MRR, response validity, fallback preservation, instruction safety, top-three stability,
latency, and cheapest-equivalent selection. This is still tuning evidence rather than release authorization.

The current [held-out v4/v3 matrix](benchmarks/ranking/results/test-openai-luna-v4-2026-08-22.json) also selects
Luna with `none` reasoning and 10 candidates. It reached 0.921 mean nDCG@10 against fusion's 0.483, 100% median
top-three overlap, complete direct-answer retention, and 1.90 s p95 latency. One of its 100 responses remained
invalid after the bounded semantic retry and fell back exactly to fusion, leaving response validity and
instruction-negative rejection at 99%. The 20-candidate `none` variant was 100% valid and reached 0.927 nDCG,
but its 3.36 s p95 missed the latency gate; `low` at 20 was slower still at 4.74 s. No tested held-out variant
therefore satisfies both reliability and latency. This artifact is final test evidence, not another prompt-tuning
input, and the preset remains experimental.

The current `akno-listwise-v4` / `compact-entries-v3` contract uses per-request candidate-id enums, requires
the output array to have exactly the candidate count, and explicitly grades instruction-only excerpts as 0.
Semantic validation still rejects duplicates and invented ids. A complete but invalid permutation receives one
bounded retry; transport, configuration, and output-budget failures do not retry, and a second invalid response
falls back to fusion. Five targeted 10-candidate development runs under v3 produced 300/300 valid responses,
100% instruction-negative rejection and direct-answer retention, 0.959 mean nDCG@10, and per-run p95 latency
from 2.08 to 2.53 seconds. The full matrix above confirms the same reliability and safety over another 300
selected-variant responses.

Completion limits reserve extra space when reasoning is enabled, because OpenAI's completion budget includes
hidden reasoning tokens as well as visible JSON. A role's configured output ceiling remains the hard cap. The
earlier end-to-end development run remains useful failure-handling evidence—it stopped when the selected
embedding model produced 0 of 120 vectors—but it cannot satisfy the current contract's release gate. A fresh
setup preflight confirms the configured OpenAI project can call Luna but receives a redacted 403 for
`text-embedding-3-small`; its model list exposes no embedding model id. End-to-end single-endpoint evidence is
therefore blocked on provider capability, not replaced with lexical fallback or a second endpoint.

**Index-path budgets are asserted; model-path timings are reported.** On the last row the model stack is
2,008 ms of the 2,010 ms — 99.9%. A bench that adds a local 3B model's latency to a 20 ms budget and prints FAIL
has measured somebody's GPU, not this code, and gets ignored within a week. `doctor` reports the two apart for
the same reason. That row was 1,820 ms before documents' own text joined the index: more candidates now reach
the reranker, which is the cost of a stored PDF being searchable at all.

Where the model time goes, measured by removing one stage at a time:

| Pipeline                | p50       |
| ----------------------- | --------- |
| Lexical only            | 4 ms      |
| \+ embedding            | 33 ms     |
| \+ cross-encoder rerank | ~1,030 ms |
| \+ query expansion      | ~1,820 ms |

The reranker dominates, and its cost is per _candidate_, not per character — truncating candidates from 4,000
chars to 800 changed neither latency nor a single result, while dropping `top_k` from 40 to 20 saved 400 ms and
changed which pages came back. So `top_k` stays at 40 and `config/default.jsonc` records the trade. Set
`recall.expansion: false` or point the `expansion` role at something faster if you would rather have the
latency — that split is exactly what the role is for.

A restart does not re-index — it **stats**. Only files whose mtime or size moved get hashed. mtime is a fast
path, not a correctness guarantee, so a full hash sweep runs on the periodic backstop and on `index --verify`.

Vector search is exact brute force by decision, not omission: below ~20,000 chunks an approximate index costs
build time, recall accuracy and a second structure to keep in sync, to save milliseconds nobody notices.

## What ships switched off

Named plainly, because a README that implies more than exists is the same failure mode Akno is built to
prevent. These defaults keep inference and unattended edits behind explicit permission:

- **`observe`** — the tier that infers patterns and can write them as derived prose. Under named profiles or an
  explicit policy/mode, every accepted pattern goes through a sealed evidence-backed plan, separate curator or
  human decision, budgeted append, reindex, and verification. Its guardrails hold; the quality of what survives
  them is the model's, and on a small local model most of it was not worth keeping.
- **`reflect`** — the tier above that, off until a knowledge base has the volume to make a "pattern" more than
  one coincidence. When enabled under a named profile or policy, each principle seals exact observation-page
  hashes, receives a separate decision, and is appended and verified through the same plan lifecycle.
- **automatic `curate` writes** — off under the default `audit` profile. Curate only considers pages whose own
  frontmatter opts into `hygiene` or `synthesize`; set a stricter transformation to `off` to skip even planning.
  `review` waits for a human and `autonomous` uses the independent curator before any verified write.
- **`repair`** — the legacy standalone phase, now a report-only compatibility view and off by default.
  `maintenance.repair.links` defaults on, but it produces durable link items only when plan-backed curate is
  enabled. Those items require exact move, alias, or canonical identity evidence; similarity never authorizes
  a write. Audit/review/auto controls them alongside other curation work.
- **`maintenance.log_changes`** — a full record of every cycle run appended to
  `<state_dir>/logs/dream.jsonl`: what it applied with the lines it added, what a guardrail refused and which
  guard refused it, what was skipped and why. It is the fastest way to decide whether to trust the cycle, and
  it is off by default because a log of inferences drawn from private notes is a second copy of the sensitive
  part, kept outside the notes. That is the owner's call, not a default.

Everything else is on: extraction for every attachment including the ones that predate Akno, audit-mode
`adopt` planning, the cross-page conflict pass, and the housekeeping report.

## Platform

**macOS only, on purpose — not a gap.** There is no plan for Linux or Windows.

The engine leans on things macOS gives: FSEvents through recursive `fs.watch`, which reports renames as renames;
the dataless-file flag, because a notes folder lives in iCloud Drive or Dropbox more often than not; launchd for
`akno service`; and reconciliation on wake, because a closed laptop is exactly when the folder gets edited on
another device. A port would not be a build-matrix entry, it would be a second watcher with its own correctness
argument, and one tested watcher is worth more than two hopeful ones.

`@tenphi/akno-core` and the `akno` CLI declare `"os": ["darwin"]`.

**`@tenphi/akno-client` stays portable, and that is the useful part.** It has no native dependencies, so a Linux
container reaching a macOS host over the loopback HTTP door is a supported shape — the knowledge base and the
index never enter the sandbox, which is also what keeps the single-writer property intact.

## Repo layout

```
packages/protocol   op registry, zod schemas, wire format — no dependencies beyond zod
packages/core       the memory layer: config, store, indexer, models, recall, watcher, maintenance
packages/client     thin typed client over a running service; no native dependencies
packages/cli        commands and the three doors
config/             default.jsonc (committed) + local.jsonc (never)
```

Runtime dependencies, all of them: `better-sqlite3`, `sqlite-vec`, `yaml`, `zod`, and
`@modelcontextprotocol/sdk` for the MCP door. Terminal colour is `node:util`'s `styleText`, request deadlines
are `AbortSignal.timeout`, and the file walker is `node:fs` — none of that needs a package.

`@tenphi/akno-protocol` exists so `@tenphi/akno-client` can share schemas with `@tenphi/akno-core` without pulling
`better-sqlite3` and `sqlite-vec` into a host's build.

## Development

```bash
pnpm build         # tsc --build across the workspace
pnpm test          # vitest — no models required; includes the fixed mixed-retrieval corpus
pnpm smoke         # both end-to-end scripts, through the built dist
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
most important thing to prove is that Akno degrades rather than fails. It also asserts that the knowledge base
is left byte-identical, and that deleting the index and re-indexing reproduces the same counts.

Anything model-shaped is tested against a stub endpoint rather than a live model, because every assertion is
about the conclusion Akno draws from a _given_ answer — a real model cannot be scripted into producing the
case you need. That is how the maintenance guardrails are covered: each one has a test that feeds it exactly the
output it exists to refuse.

[CONTRIBUTING.md](CONTRIBUTING.md) collects the invariants worth knowing before changing the indexer, the write
path or the recall pipeline — most of them written down because breaking one produced a bug that was hard to see.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other
noncommercial use is free, commercial use is not granted. Dependencies keep their own licences.
For a commercial licence, ask.
