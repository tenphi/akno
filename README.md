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

---

## Why

Agents make things up when retrieval is thin. They get back disconnected fragments, no indication of what was
searched or what was missing, and no way to cite anything. Then they fill the gaps.

The usual answer is a longer prompt — "always retrieve first", "never claim it isn't recorded", "notice when a
value is superseded". A prompt is a suggestion. Akno's position is that this belongs in the memory layer,
where it runs every time:

- Retrieval returns **page cards with line addresses**, so every claim traces to a sentence in a file.
- Absence is **a result** — and it distinguishes _nothing matched_ from _the index is unavailable_.
- A superseded value comes back **labelled as superseded**, not as a competing current claim.
- `question` mode reports **coverage**: which concepts of the question the results actually cover.
- Structure rules — where things go, what is quotable — are **enforced**, not requested.

## Quick start

Requires Node 22+ and pnpm. macOS only, [on purpose](#platform).

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

| File                         | Committed           | Holds                                                                                  |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `config/default.jsonc`       | **yes**             | Every key, with a machine-independent default. Documentation as much as configuration. |
| `config/local.example.jsonc` | **yes**             | The template you copy.                                                                 |
| `config/local.jsonc`         | **no** — gitignored | Your knowledge base path, your endpoints, your model ids.                              |
| `.env`                       | **no** — gitignored | Secrets only.                                                                          |

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

Rules can also travel with the notes: if `<akno_path>/akno.json` exists, its `folders` block wins over both
config files, so structure rules are versioned alongside the knowledge base they describe. That file is read as
configuration and never indexed as a note.

Changing a rule takes effect on the next `akno index`, including for pages nobody has touched since. The
resolved rules are fingerprinted, so a pass that would otherwise report "223 unchanged" re-examines the pages
whose class actually moved — a rule edit that silently did nothing was one of the first bugs found here.

## Models

Four roles, all optional, each degrading rather than failing. Any OpenAI-compatible endpoint; one local server
can host all of them.

| Role       | Without it                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Embedding  | lexical search only — no semantic matching, and question-mode hypothetical expansion is inert       |
| Reranker   | hybrid score ordering instead of cross-encoder reranking; ordering is coarser                       |
| Small chat | no summaries, keywords, fact derivation, query expansion, `remember` or observations — recall works |
| Vision     | photos with no text yield no page; OCR still covers scans and screenshots, which is most arrivals   |

`akno doctor` reports which roles resolved, their latency, and **what each missing one costs**. Model latency
and index latency are reported separately, because a memory system that feels slow after idling is almost never
suffering from its storage engine.

The maintenance cycle can point at a different chat model than per-turn work uses — see
[The maintenance cycle](#the-maintenance-cycle) for why that turned out to matter more than any other setting.

There is no model downloading or serving in this repo. Models are configuration, pointed at an endpoint you run.

## The ops

Ten, small on purpose: every additional op is another chance for an agent to pick the wrong one. Plus `context`,
the pre-turn bundle, normally called by the host rather than by the agent.

| Op         | What it does                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recall`   | Expand → hybrid search → rerank → assemble → fit a budget. `mode` (`lookup`/`question`/`explore`) selects the expansion strategy and is inferred from the query. |
| `read`     | One exact thing: a page by slug or id, or a document by id.                                                                                                      |
| `list`     | Browse structure: folders, pages by type/tag/class/recency, or a tree outline.                                                                                   |
| `timeline` | When things happened — by range, subject, or match.                                                                                                              |
| `context`  | The whole pre-turn bundle against **one** budget: pinned pages, recent timeline, structure, and this turn's recall.                                              |
| `write`    | Create, append, patch or replace a page. Carries documents, events, tags and links.                                                                              |
| `remember` | Hand over a transcript; Akno decides what is worth keeping and where it goes.                                                                                  |
| `forget`   | Retract a fact by removing the sentence that produced it; trash a page or document.                                                                              |
| `undo`     | Reverse a change by id.                                                                                                                                          |
| `move`     | Relocate a page with its documents.                                                                                                                              |
| `ingest`   | Extract, OCR, name, summarize and route a file, folder or URL.                                                                                                   |

Every op is advertised over every door from one registry, with its schema, so a caller discovers what exists
rather than being told in prose.

## Three doors, one registry

```ts
import { open } from '@akno/core';
const mem = await open({ aknoPath: '~/Notes' });
const { cards } = await mem.recall({ query: 'car insurance renewal', budget: 8000 });
```

```ts
import { connect } from '@akno/client';
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
reaching Akno over MCP cannot write until you say so.

**Exactly one process may write.** It takes a lock file with its pid; a second process opens read-only and says
so, rather than racing. That is why `akno index`, `akno inbox` and `akno dream` are sent over the socket
to a running service and executed _there_, falling back to in-process only when no service answers. They are
commands rather than ops — the ops above are what an agent calls about memory, these are operator work about
the process — and they are socket-only, because that is the door where filesystem permissions are the auth.

**Why a long-lived process:** spawning a process per memory call costs ~33 ms against ~0.04 ms for a long-lived
handle. None of that is the database — opening a SQLite file is half a millisecond regardless of size. A unix
socket round trip is ~18 µs, which is why IPC cost is not a reason to embed.

## How your files are treated

**Akno writes nothing into your knowledge base by default.** Not frontmatter, not fact tables, not a
`timeline.md` you did not ask for.

- Identity lives in the index (`pages.id`), and a rename is followed by body hash. Set `write_ids: true` to have
  Akno add a frontmatter `id:` — the only thing it ever writes into a page you wrote — for identity that
  survives a database rebuild and a move to another machine.
- `create_reserved_paths: false` by default, so a first run against an existing folder creates nothing.
- If a reserved path exists and isn't what Akno expects — a `timeline.md` that is a project plan — it is left
  completely alone. `doctor` reports it and points at the config key to remap it.
- Every frontmatter key except `id` is preserved byte for byte and ignored.

Three operations do author files, and each is journalled and reversible with `akno undo`: `write` and
`remember` (because you asked them to), `ingest` (a page for a document you handed over), and the maintenance
cycle (pages under `observations/`, and a page for a document that has none — both opt-outable).

## Page classes

Not everything in a knowledge base is knowledge. A lot of it is **evidence**: contract text, emails, statutes,
transcripts. You want it stored and findable. You do not want a fact extractor asserting things from it, or
eleven pages of contract text landing in a retrieval budget.

| Class              | Indexed | `recall` returns                                        | Fact-mined |
| ------------------ | ------- | ------------------------------------------------------- | ---------- |
| `full` _(default)_ | yes     | summary + matching lines; whole body on `depth: "full"` | yes        |
| `reference`        | yes     | summary + a capped quote window                         | **no**     |
| `excluded`         | no      | nothing                                                 | no         |

> Reference pages are evidence. Full pages are claims. Only claims become facts.

A page can switch class mid-body at a `<!-- reference -->` fence: above it, normal and mined; below, indexed for
search but never mined and never returned whole.

This is a **relevance policy, not access control** — `read({slug})` returns the full body of a `reference` page
every time, and `recall({ include: ['reference'], depth: 'full' })` lifts the cap.

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
chat model suggested, overriding a correct refusal with a weaker signal. A water bill reached `travel/2026`
twice before both were fixed.

### A document's own text is indexed as the document

Every attachment is extracted on arrival — including the ones that predate Akno, or that someone dropped into
a folder by hand. Their text is chunked **per page of the document** and indexed against the document itself, so
a stored PDF is searchable by its own content and a hit can say which page it is on:

```
recall "who replaced the drain pump"

  household/dishwasher-repair-2026-08 (full, 0.91)
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

A document with no page has nowhere to be returned, since recall returns page cards. Ownership comes from the
filename (`<page-basename>-<8 hex>.<ext>`), from a matching stem (`passport.pdf` beside `passport.md`), or from a
page embedding it with `![[filename]]` — the author saying which file belongs where. Anything still unowned gets
a page of its own from the [maintenance cycle](#the-maintenance-cycle).

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

`akno dream` runs five phases. They are independent, and each is safe to re-run.

| Phase          | Writes?   | What it does                                                                                                |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `observe`      | appends   | Combines repeated facts into stable patterns, under `observations/` with the evidence used. Off by default. |
| `reflect`      | appends   | Decision principles built on the tier above. Off by default.                                                |
| `adopt`        | new pages | A page for a document that has none, beside the file — so its text can be returned at all.                  |
| `conflicts`    | no        | Facts on **different** pages stating different values for one thing — which inline checking cannot see.     |
| `housekeeping` | no        | Broken links, orphaned documents, pages that have drifted from their folder's rules.                        |

`observe` and `reflect` only ever append: a changed pattern gets a new dated line, nothing is deleted. Each
phase's writes are their own `akno undo`, so reversing a night's inferences does not also reverse the pages
that made documents searchable. The rest report, because a maintenance process that tidies a knowledge base
behind its owner's back is worse than the mess it fixes.

`akno service install` also writes a nightly launchd agent (`dev.akno.dream`, 03:00 by default), which is
how the cycle runs on a schedule. `--no-dream` skips it, `--dream-hour` moves it.

**`adopt` is the one thing the cycle repairs.** Recall returns page cards, so an attachment nobody's page points
at is extracted, indexed, and unreachable. `adopt` writes the page `ingest` would have written — the title from
the filename, the body from the summary extraction already produced, then the embed that makes the link hold —
and the document's own text becomes answerable, cited by its page number inside the file. It honours a folder
rule of `ingest: "file"`, which exists for precisely the case where a stub page per file would be noise; it
leaves a page that is already there alone, since that is almost always your own notes about that very file; and
it is capped per run so a folder of 500 unowned PDFs does not become 500 pages before anyone has read the first
report.

**`observe` ships off, and what it produces is almost entirely a function of the model behind it.** Its
guardrails are enforced in code, not asked for in a prompt: at least two distinct source pages, every cited slug
checked against what the model was actually shown, `full` pages only, no observation admissible as evidence for
another, no hedged language, nothing about a person's private life, and nothing that describes the records
rather than what they record. The same pass over the same knowledge base:

| Chat model         | Candidates | Refused by a guard | Worth keeping |
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

`akno bench` asserts these budgets so CI fails on regression rather than someone noticing months later.
Measured against a real knowledge base — 221 indexed pages, 1,142 chunks (1,069 from page bodies and 73 from
inside documents), Apple Silicon:

|                              |            |                          |
| ---------------------------- | ---------- | ------------------------ |
| Structural index, cold       | 255 ms     |                          |
| Re-index, nothing changed    | **5.4 ms** | budget 50 ms             |
| First query, index path only | 3.4 ms     | budget 50 ms             |
| `recall`, lexical only       | 2.0 ms     | budget 20 ms             |
| Point lookup by slug         | 0.3 ms     | budget 10 ms             |
| `timeline`, 6-month window   | 0.1 ms     | budget 20 ms             |
| `recall`, hybrid + rerank    | 2,010 ms   | _reported, not budgeted_ |

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
`recall.expansion: false` or point the chat role at something faster if you would rather have the latency.

A restart does not re-index — it **stats**. Only files whose mtime or size moved get hashed. mtime is a fast
path, not a correctness guarantee, so a full hash sweep runs on the periodic backstop and on `index --verify`.

Vector search is exact brute force by decision, not omission: below ~20,000 chunks an approximate index costs
build time, recall accuracy and a second structure to keep in sync, to save milliseconds nobody notices.

## What ships switched off

Named plainly, because a README that implies more than exists is the same failure mode Akno is built to
prevent. Both of these are decisions with a measurement behind them, not gaps:

- **`observe`** — the tier that infers patterns and writes them as prose. Its guardrails hold; the quality of
  what survives them is the chat model's, and on a small local model most of it was not worth keeping.
- **`reflect`** — the tier above that, off until a knowledge base has the volume to make a "pattern" more than
  one coincidence.

Everything else is on: extraction for every attachment including the ones that predate Akno, `adopt`, the
cross-page conflict pass, and the housekeeping report.

## Platform

**macOS only, on purpose — not a gap.** There is no plan for Linux or Windows.

The engine leans on things macOS gives: FSEvents through recursive `fs.watch`, which reports renames as renames;
the dataless-file flag, because a notes folder lives in iCloud Drive or Dropbox more often than not; launchd for
`akno service`; and reconciliation on wake, because a closed laptop is exactly when the folder gets edited on
another device. A port would not be a build-matrix entry, it would be a second watcher with its own correctness
argument, and one tested watcher is worth more than two hopeful ones.

`@akno/core` and the `akno` CLI declare `"os": ["darwin"]`.

**`@akno/client` stays portable, and that is the useful part.** It has no native dependencies, so a Linux
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

`@akno/protocol` exists so `@akno/client` can share schemas with `@akno/core` without pulling
`better-sqlite3` and `sqlite-vec` into a host's build.

## Development

```bash
pnpm build         # tsc --build across the workspace
pnpm test          # vitest — 353 tests, no models required
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
