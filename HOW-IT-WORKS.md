# How Akno works

Akno is a memory layer for agents, built on a folder of Markdown files that you own.
It helps an agent find what your notes actually say, show where each answer came from, and
make deliberate, reversible changes without taking control of the folder away from you.

This guide explains the user workflows first, then the machinery behind them. If Akno is
not installed yet, start with the [README quick start](README.md#quick-start).

---

## Contents

- [What Akno is useful for](#what-akno-is-useful-for)
- [The mental model](#the-mental-model)
- [Choose the right method](#choose-the-right-method)
- [A first useful run](#a-first-useful-run)
- [How indexing works](#how-indexing-works)
- [Ways to retrieve knowledge](#ways-to-retrieve-knowledge)
- [Ways to capture and change knowledge](#ways-to-capture-and-change-knowledge)
- [How folders, roles, and rules work](#how-folders-roles-and-rules-work)
- [How documents and the inbox work](#how-documents-and-the-inbox-work)
- [The dream cycle, phase by phase](#the-dream-cycle-phase-by-phase)
- [Models and graceful degradation](#models-and-graceful-degradation)
- [Running Akno as a service](#running-akno-as-a-service)
- [Diagnostics and recovery](#diagnostics-and-recovery)
- [What Akno does not solve yet](#what-akno-does-not-solve-yet)
- [Command reference](#command-reference)

---

## What Akno is useful for

Akno is most helpful when an agent needs continuity across conversations but the knowledge
must remain inspectable and under your control.

It turns common requests into grounded workflows:

- **“What did we decide?”** Search the notes, return the relevant page and exact lines, and
  say which parts of the question were not answered.
- **“Keep this for later.”** Extract the durable parts of a conversation, find the canonical
  page, append the knowledge, and record the change for undo.
- **“File this scan.”** Extract or OCR it, give an unhelpful filename a meaningful name, route
  it only when the destination is sufficiently clear, and make its contents searchable.
- **“What changed over time?”** Combine a central event ledger with dated lines from any page.
- **“Is the knowledge base still coherent?”** Find cross-page conflicts, broken links,
  unowned documents, and pages that have drifted from their folder rules.

The useful distinction is that Akno does not answer on the agent's behalf. It supplies
**evidence with addresses** and an explicit account of missing coverage. The agent still
reasons and writes the final response.

Akno is a good fit when:

- Markdown is already the durable record, or you want it to become the durable record.
- You want people and agents to edit the same files.
- Citations, reversibility, and honest absence matter more than a frictionless black box.
- You are comfortable running a local service on macOS and configuring model endpoints.

It is not a replacement for a note editor, a chat interface, a backup system, or a source of
truth about the world. It only knows what the indexed files and documents contain.

---

## The mental model

```mermaid
flowchart LR
    Person["You<br/>Obsidian, vim, Finder"] -->|"edit normally"| Notes["Markdown + documents<br/>your knowledge base"]
    Notes -->|"watch and index"| Index[("Disposable index<br/>state directory")]
    Index -->|"cards, citations, coverage"| Agent["Agent or CLI"]
    Agent -->|"write, remember, ingest"| Notes
    Agent -->|"undoable changes"| Journal["Journal + trash<br/>state directory"]
```

Four rules explain most of the system:

1. **The files are the truth.** The database is a derived reading of them. Delete it and run
   `akno index`; the knowledge base remains intact.
2. **The index is not a second knowledge base.** Search chunks, embeddings, summaries, facts,
   links, and events can all be rebuilt.
3. **Every returned claim has an address.** Page text is cited as `slug:line`; document text is
   cited with the document name and page number.
4. **Missing capabilities degrade explicitly.** If a model or the index is unavailable, Akno
   returns a typed degraded or unavailable result instead of quietly pretending it searched
   normally.

### Pages and documents have different jobs

A Markdown page says what a document is and why it matters. The document keeps its own text.
Akno indexes both, but it does not paste an extracted PDF into the page beside it. That avoids
duplicate search hits and prevents a stale copy from surviving after the file changes.

### Evidence and knowledge have different jobs

Not every page should be treated as a claim you endorse. A contract, email, transcript, or
article may be useful evidence without being canonical knowledge.

| Role        | Searchable? | Normal recall behavior                                | Fact-derived? |
| ----------- | ----------- | ----------------------------------------------------- | ------------- |
| `knowledge` | yes         | Summary plus matching lines; full body when requested | yes           |
| `source`    | yes         | Summary plus a capped quotation window                | no            |
| `inference` | yes         | Returned below authored knowledge                     | no            |
| `ignored`   | no          | Never returned                                        | no            |

A `<!-- source -->` fence can switch a knowledge page into evidence partway through the file.
Content above the fence is canonical; content below it remains searchable but is not fact-mined
or returned in full by default.

Roles are retrieval policy, not access control. An exact `read` can still return a source page.

---

## Choose the right method

The command surface is deliberately small, but several commands can look similar. Choose by how
much you already know about the answer or change.

| Your intent                                 | Method                   | Why this one                                                    | Writes files?    |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------- | ---------------- |
| Ask a fuzzy or natural-language question    | `recall`                 | Finds relevant pages and reports coverage                       | no               |
| Open a page or document you already know    | `read`                   | No ranking or truncation policy                                 | no               |
| Browse the shape of the knowledge base      | `list`                   | Shows folders, pages, or a tree                                 | no               |
| Ask what happened in a period               | `timeline`               | Uses structured events and dated lines                          | no               |
| Prepare everything an agent turn needs      | `context`                | Fits pins, recent events, structure, and recall into one budget | no               |
| Put exact wording on an exact page          | `write`                  | The caller controls destination and text                        | yes              |
| Keep the durable parts of unstructured text | `remember`               | Akno decides what lasts and where it belongs                  | yes              |
| Bring in a file, folder, or URL             | `ingest`                 | Extracts, names, routes, stores, and indexes                    | yes              |
| Process a drop folder                       | `inbox`                  | Applies ingest automatically to arrivals                        | yes              |
| Correct, remove, or relocate something      | `forget`, `undo`, `move` | Preserves file-level semantics and history                      | yes              |
| Run slow maintenance                        | `dream`                  | Performs bounded, repeat-safe background phases                 | depends on phase |

Two rules of thumb prevent most misuse:

- If you know the destination and wording, use `write`; if you are handing over raw material,
  use `remember`.
- If you know the slug, use `read`; if you only know the subject, use `recall`.

The CLI exposes these methods to a person. The in-process, socket, HTTP, and MCP interfaces expose
the same operations to an agent from one registry, with the same schemas and errors.

---

## A first useful run

After configuring `akno_path`, start read-only. Index, diagnose, ask a question, and inspect the
source before enabling any automatic writing.

```bash
akno index
akno doctor
akno recall "when does the car insurance renew and what is the excess?"
akno read household/car-insurance
```

No notes to use yet? The repository includes a completely invented example:

```bash
cp -R examples/demo-brain ~/akno-demo
export AKNO_STATE_DIR=~/akno-demo-state
akno --akno-path ~/akno-demo index
akno --akno-path ~/akno-demo doctor
akno --akno-path ~/akno-demo recall "who services the boiler?"
```

Copy the demo before using write operations; `remember`, `ingest`, and enabled dream phases can
change the folder.

A practical adoption path is:

1. **Search only:** index, recall, read, list, timeline, and context.
2. **Explicit writes:** use `write`, `remember --dry-run`, and `undo` until the filing behavior is
   familiar.
3. **Document intake:** declare folder rules, then try one file with `ingest` before enabling an
   inbox.
4. **Background operation:** install only the service and watcher with `akno service install --no-dream`.
5. **Maintenance:** inspect `dream --dry-run`, then install the schedule after choosing which phases may write.

This sequence is about learning the trust boundaries, not satisfying a technical prerequisite.

---

## How indexing works

`akno index` reconciles the derived index with the folder. Run it once after setup. A running
service then watches for file changes and performs targeted re-indexing.

```mermaid
flowchart TD
    scan["1. Walk the folder"] --> stat["2. Skip unchanged paths"]
    stat --> hash["3. Hash changed candidates"]
    hash --> parse["4. Parse pages, roles, links, and dates"]
    parse --> chunk["5. Split pages on headings"]
    chunk --> docs["6. Discover and extract documents"]
    docs --> embed["7. Embed searchable chunks"]
    embed --> derive["8. Derive summaries, keywords, and facts"]
    derive --> store["9. Commit the new reading to the index"]
```

| Pass                | Method                                                                 | Model         |
| ------------------- | ---------------------------------------------------------------------- | ------------- |
| Walk                | Ignore configured paths, dot folders, and unsupported page types       | none          |
| Skip                | Compare size and modification time with the previous pass              | none          |
| Verify              | Hash likely changes; periodic sweeps also catch misleading timestamps  | none          |
| Parse               | Read frontmatter, headings, wikilinks, dates, roles, and source fences | none          |
| Chunk               | Follow headings and configured size limits                             | none          |
| Extract             | Read PDF text, OCR scans, and convert supported Office files           | none on macOS |
| Embed               | Turn chunks into vectors for semantic search                           | embedding     |
| Derive              | Produce page summaries, keywords, and durable fact candidates          | derive        |
| Summarize documents | Describe each document without copying its body into Markdown          | derive        |

The fast path is why a second index pass is normally quick: unchanged bytes are not re-read,
re-embedded, or re-derived.

Useful variants:

```bash
akno index --structural  # parse and reconcile without model-backed work
akno index --verify      # hash every file instead of trusting timestamps
akno index --rederive    # regenerate summaries, keywords, and facts
akno index --rebuild     # discard the derived index and recreate it
```

`--rebuild` deletes derived state, not the knowledge base. Indexing does not write into the notes
by default. Two opt-in settings are exceptions: `write_ids` can add an Akno id to frontmatter,
and `ingest.text_rendition` can keep extracted text beside readable documents.

---

## Ways to retrieve knowledge

### `recall`: ask when you know the subject, not the file

```bash
akno recall "when does the car insurance renew and what is the excess?"
```

An abbreviated result might look like this:

```text
ok mode=question 1 card 620 tokens
  coverage ✓ renewal date  ✗ excess
  nothing returned covers "excess" — do not answer that part

household/car-insurance (knowledge, 0.93)
  Car insurance › Policy
  Vulpine Mutual policy for the household car.
  household/car-insurance:11  Renews 4 November 2031. ~0.94
```

The important fields are:

| Output              | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `mode=question`     | The retrieval strategy chosen for this query                                   |
| `1 card 620 tokens` | The number of page cards and their approximate prompt cost                     |
| `coverage ✓ … ✗ …`  | Which concepts the returned evidence covers                                    |
| `knowledge`         | The page role                                                                  |
| `0.93`              | Relevance of the page to this query                                            |
| `slug:11`           | The exact Markdown line to inspect                                             |
| `~0.94`             | Confidence that the line expresses a durable claim, not that the claim is true |

Coverage is a guardrail for the answer. A relevant page can still fail to answer one part of a
compound question. The caller should answer the covered part and be explicit about the missing one.

#### The recall pipeline

```mermaid
flowchart LR
    query["Your query"] --> expand["1. Expand<br/>optional expansion model"]
    expand --> lexical["2a. Keyword search"]
    expand --> semantic["2b. Meaning search<br/>optional embeddings"]
    lexical --> fuse["3. Fuse by rank"]
    semantic --> fuse
    fuse --> rerank["4. Rerank candidates<br/>optional reranker"]
    rerank --> cards["5. Assemble page cards<br/>and fit one budget"]
```

The search arms use different score scales, so they are merged by rank rather than comparing raw
scores. The final cards are built only after fusion and optional reranking.

Recall has three modes:

| Mode       | Best for                             | Expansion method                                                               |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `lookup`   | `car insurance renewal`              | Add synonyms and word forms                                                    |
| `question` | `when does the car insurance renew?` | Search a hypothetical answer because questions and answers use different words |
| `explore`  | `anything about the car`             | Search broadly and favor summaries                                             |

The mode is inferred, or you can set it explicitly. Filters narrow the candidate set before cards
are assembled:

```bash
akno recall "renewal" --folder household
akno recall "invoice" --type receipt
akno recall "policy wording" --include source --depth full
akno recall "rent" --tag legal,household --budget 2000
```

### `read`: open one exact page or document

```bash
akno read household/car-insurance
akno read household/car-insurance --from 10 --to 20
akno read --document doc_a1b2c3d4
akno read --document household/policy-8e7705eb.pdf
```

`read` is not a search. It returns the requested object directly and can return a complete source
page that recall would normally quote only briefly.

### `list`: browse the structure

```bash
akno list
akno list --kind pages --folder household
akno list --kind tree --depth 2
akno list --type receipt --order recent
```

This is useful before writing. A caller that can see the existing taxonomy is less likely to invent
a duplicate page or folder.

### `timeline`: retrieve events by time

```bash
akno timeline --since 2031-01 --until 2031-06
akno timeline --match boiler
akno timeline --subject people/ada-marlow
```

Events come from the configured timeline ledger and from dated lines on any page. A page can remain
the canonical home of an event while `timeline` still finds it globally.

### `context`: prepare one bounded agent turn

```bash
akno context "the boiler is making a noise again" \
  --budget 8000 --pin household/boiler
```

`context` combines pinned pages, recent events, a structure outline, and this turn's recall under
one token budget. The parts compete for the same space, so four individually reasonable calls do not
overflow the model's context when combined.

---

## Ways to capture and change knowledge

### `write`: exact destination, exact wording

`write` creates, appends, patches, or replaces a page. The caller owns the wording; Akno enforces
the folder, conflict, journaling, and re-indexing rules around it.

```mermaid
flowchart TD
    request["write request"] --> validate["Validate target and operation"]
    validate --> folder{"Folder declared<br/>when required?"}
    folder -->|no| stop1["Return requires_folder"]
    folder -->|yes| conflict{"Structured claim<br/>conflicts locally?"}
    conflict -->|yes| stop2["Return both values<br/>and a resolution token"]
    conflict -->|no| disk["Write atomically"]
    disk --> journal["Record before/after bytes"]
    journal --> index["Re-index touched files"]
```

Examples:

```bash
akno write --slug household/lease --append "- Deposit: 2222 EUR"
akno write --slug household/wifi --title "Wi-Fi" \
  --content "Router in the hallway cupboard."
akno write --slug household/lease --replace "1111 EUR" --with "2222 EUR"
akno write --slug household/boiler --append "- Serviced 4 August." \
  --event "2031-08-04=Boiler serviced."
akno write --slug household/boiler --append "Invoice attached." \
  --attach ~/Desktop/invoice.pdf="The invoice"
akno write --slug household/lease --append "- Deposit: 2222 EUR" --dry-run
```

`append`, `patch`, and `replace` never alter frontmatter. A full `content` replacement can replace
frontmatter only when the submitted content starts with a frontmatter block. The response names keys
removed from the previous declaration so a missing policy or temporal boundary is visible.

#### Local conflict detection

If a page says `Rent: 1111 EUR` and a write proposes `Rent: 2222 EUR`, Akno stops before touching
the file and returns both lines plus a conflict token. After deciding which value is current, repeat
the write with the resolution token.

This immediate check is deliberately narrow: it compares structured values containing numbers or
dates on the target page. Thorough cross-page conflict detection belongs in the dream cycle, where a
model call does not delay an interactive write.

### `remember`: raw material in, durable knowledge out

Use `remember` when you do not know which sentences should survive or where they belong.

```bash
akno remember "Decision: extend the Zephyr QX-100 warranty for €33/month from 1 October 2031."
akno remember "..." --dry-run
```

Its method is:

1. Extract durable decisions, values, dates, preferences, and proven experience. Drop chatter,
   speculation, and facts that are only momentarily true.
2. Use the visible folder taxonomy to choose a branch. It never creates a folder.
3. Recall candidate pages inside that branch and require the routing score to clear the threshold.
4. Run the same local conflict check as `write`.
5. Choose a section, append prose with provenance, and fall back to `## Unsorted` if placement fails.
6. Add dated material to the timeline in the same undoable change.

`maintenance.model` handles this when configured; otherwise `derive` does. A call can include a
`mission` such as “attribute forwarded content to its original author.” The mission adds emphasis to
the fixed retention rules; it cannot replace their safety constraints.

When a durable claim has no confident destination, Akno proposes instead of guessing:

```bash
akno approve --list
akno approve prop_5c1e77a2 --slug household/warranties
akno decline prop_5c1e77a2
```

### `forget`, `undo`, and `move`: correct the record

```bash
akno forget --fact fact_9c2e11ab
akno forget --slug household/old-notes
akno forget --document doc_a1b2c3d4

akno undo --list
akno undo chg_7f3a9c21

akno move household/lease household/rental/lease
```

- Forgetting a fact removes the sentence that produced it; there is no hidden fact store to edit
  instead of the Markdown.
- Forgetting a page or document moves it to Akno's trash, retained for the configured period.
- Undo restores exact previous bytes. If a change created a file, undo removes that created file.
- Move relocates a page and its owned documents, updates embeds within the page, and reports inbound
  links from other pages instead of silently rewriting them.

---

## How folders, roles, and rules work

An agent that invents folders without describing them can turn a useful taxonomy into a pile of
near-duplicates. Akno gates the missing description, not the user's approval.

If an agent writes into an undeclared folder, the write returns `requires_folder` and suggests nearby
existing folders. The caller declares the new folder, then retries:

```bash
akno folder warranties \
  --description "Appliance and electronics warranties, with expiry dates."
akno folder conversations \
  --description "Chat transcripts: what was said." \
  --role source --remember deny
```

The description helps later agents decide where pages belong. Role and management defaults prevent
evidence folders from receiving canonical remembered claims.

Rules can live in machine config or in `<akno_path>/akno.json`. Rules beside the notes win, so a
taxonomy can travel with the knowledge base. They are glob-scoped and the most specific match wins.

```jsonc
{
  "folders": {
    "sources/**": { "role": "source", "remember": "deny", "ingest": "document" },
    "templates/**": { "role": "ignored", "remember": "deny" },
    "inbox/**": { "ingest": "auto", "route": true },
  },
}
```

Use `akno rules <path>` to see the resolved policy and which file supplied it. Changing rules causes
affected pages to be reconsidered on the next index pass even when their content has not changed.

Automatic write policy has two independent dimensions:

- `remember: integrate|deny` controls whether retained knowledge may be appended.
- Page frontmatter `akno.management.dream: none|hygiene|synthesize` controls whether curation may
  rewrite that page during a dream cycle.

A person's manually created folder is not gated. The default `gate: top-level` requires declarations
for agent-created top-level folders while allowing subfolders beneath a declared branch.

---

## How documents and the inbox work

### `ingest`: one file, folder, or URL

```bash
akno ingest ~/Downloads/policy.pdf
akno ingest ~/Downloads --limit 20
akno ingest https://example.com/policy.pdf
akno ingest ~/Desktop/scan.pdf --folder documents
```

The method is:

```mermaid
flowchart TD
    input["File arrives"] --> extract["Extract text or OCR"]
    extract --> usable{"Usable content?"}
    usable -->|no| report1["Leave it alone and explain why"]
    usable -->|yes| describe["Name and summarize"]
    describe --> named{"Naming confidence<br/>high enough?"}
    named -->|no| report2["Keep its name and location"]
    named -->|yes| route["Score eligible folders"]
    route --> clear{"Destination clears<br/>the threshold?"}
    clear -->|no| report3["Leave it in place with a proposal"]
    clear -->|yes| store["Store, page, link, and index"]
```

Extraction uses PDFKit, Vision OCR, and `textutil` on macOS. `derive` names and summarizes. The
optional `vision` role is used only when an image contains no readable text and needs a visual
description.

Ingest refuses three risky guesses:

- It does not rename a file whose existing name is already meaningful.
- It does not name a file whose contents it could not understand confidently.
- It does not route a file when no folder clears `route_threshold`.

A folder ingest walks one level deep and reports one verdict per file. A URL ingest accepts HTTP and
HTTPS, enforces the size limit on bytes actually received, and stores the final URL as provenance.

Stored documents are content-addressed, so ingesting identical bytes again is a no-op. File text is
chunked by document page, making a result cite the original page number:

```text
household/boiler-service (knowledge, 0.91)
  household/boiler-service-8e7705eb.pdf p1
    VULPINE MUTUAL
    Renewal date: 4 November 2031
```

Split scans such as `policy.pdf`, `policy-2.pdf`, and `policy-3.pdf` can form one document with
continuous page numbers. The rule is intentionally narrow: extension and folder must match, part one
must exist, and only a short trailing part number qualifies.

### The inbox: ingest on arrival

An inbox is a folder rule with `route: true`; its name is not special.

```jsonc
{
  "folders": {
    "inbox/**": { "ingest": "auto", "route": true },
  },
}
```

```bash
akno inbox
```

A running service processes arrivals automatically. Above the routing threshold, the file and its new
page move together. Below it, the file remains visibly in the inbox with a proposal.

The inbox is the only place where Akno automatically moves an existing document. A file manually
placed in another folder may be extracted, named, paged, and indexed, but it is not relocated.

### Why an unowned document needs a page

Recall returns page cards. A document that no page owns may be extracted and indexed but still have no
card through which its matching text can be returned. Ownership is established by:

- Akno's content-addressed `<page>-<8 hex>.<ext>` filename;
- a matching page and document stem; or
- a `![[filename]]` embed from a page.

The dream cycle's `adopt` phase creates a minimal owning page for readable documents that still have
none.

---

## The dream cycle, phase by phase

`akno dream` is not one model prompt that rewrites the knowledge base. It is an ordered maintenance
run containing seven bounded phases with different inputs, permissions, and side effects.

```bash
akno dream
akno dream --dry-run
akno dream --phase housekeeping
akno dream --phase curate
```

`--dry-run` executes the selected checks and model decisions but does not change knowledge-base files.
The phases are designed to be safe to repeat: unchanged input should not create duplicate output.

### The retention ladder is not the execution order

Akno has a conceptual ladder for turning raw material into progressively more derived knowledge:

```mermaid
flowchart TD
    conversation["Conversation or raw notes"] --> remember["retain / remember<br/>durable claims"]
    remember --> facts["Authored knowledge pages<br/>and derived facts"]
    facts --> observe["observe<br/>patterns across pages"]
    observe --> observations["Inference pages<br/>with evidence"]
    observations --> reflect["reflect<br/>decision principles"]
```

`retain` is the `remember` operation and happens when a person or agent asks for it. It is deliberately
not rerun at night: fresh conversation context should not wait for a schedule, and the dream cycle has
no new conversation to retain.

`observe` and `reflect` are the two inference tiers. Both are off by default because their usefulness
depends strongly on data volume and model quality.

### The actual nightly order

```mermaid
flowchart LR
    observe["1. observe"] --> reflect["2. reflect"] --> curate["3. curate"] --> adopt["4. adopt"] --> conflicts["5. conflicts"] --> repair["6. repair"] --> housekeeping["7. housekeeping"]
```

Order matters in three places:

- `reflect` reads observations, so `observe` runs first.
- Claim repair consumes conflict verdicts from the same full run, so `conflicts` runs before `repair`.
  Running `--phase repair` alone can still repair uniquely resolvable links, but it has no fresh
  conflict verdicts to act on.
- `housekeeping` runs last so its counts describe the state after adoption and enabled repairs.

### Phase summary

| Phase          | Reads                                                                        | Produces                                                | Writes by default?                  | Model?                          |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------- | ------------------------------- |
| `observe`      | Durable facts from at least two knowledge pages                              | Evidence-linked patterns under `observations/`          | no; phase disabled                  | maintenance or derive           |
| `reflect`      | Existing observation pages                                                   | Higher-level principles under `observations/principles` | no; phase disabled                  | maintenance or derive           |
| `curate`       | Explicitly opted-in knowledge pages, linked evidence, conflicts, event state | Verified hygiene or synthesis proposals                 | no; phase and write switch disabled | maintenance or derive           |
| `adopt`        | Readable documents with no owning page                                       | Minimal page beside each eligible document              | **yes**, capped at 20 per run       | no new call                     |
| `conflicts`    | Live facts on different knowledge pages                                      | Conflict candidates and optional verdicts               | no                                  | optional verification           |
| `repair`       | Broken links and conflict verdicts                                           | Bounded link and stale-claim edits                      | no; phase disabled                  | only ambiguous choices/rewrites |
| `housekeeping` | Links, documents, pages, and folder rules                                    | Counts and actionable diagnostics                       | no                                  | no                              |

The default dream therefore has one automatic write-capable phase: `adopt`. It creates pages for
otherwise unreachable documents, but never moves or edits the document itself. `conflicts` and
`housekeeping` report. The other writing phases require explicit opt-in.

### Phase 1: `observe` — infer patterns across authored facts

**Problem it solves:** repeated facts can imply a stable pattern that no single page states.

**Method:** group sufficiently confident live facts by subject and top-level folder, require evidence
from at least two distinct knowledge pages, and ask the maintenance model for a pattern that is not a
restatement of any source fact.

**Output:** an inference page under `observations/`. Every line is dated, links to the evidence pages,
and is marked as derived. Recall ranks it below authored knowledge.

**Write behavior:** append-only. A changed pattern adds a new line; it does not delete or overwrite the
old one. Repeated wording is detected so an unchanged run writes nothing.

**Guards:** source pages cannot become evidence, observations cannot feed other observations, every
cited slug must have been shown to the model, hedged patterns are refused, and sensitive conclusions
about health, relationships, finances, beliefs, or character are out of bounds.

**Default:** off. Enable only after reviewing a dry run with a model that produces useful patterns:

```jsonc
{
  "maintenance": {
    "model": { "provider": "openai", "id": "your-maintenance-model" },
    "observe": { "enabled": true, "min_evidence": 2, "max_subjects": 40 },
  },
}
```

### Phase 2: `reflect` — derive principles from observations

**Problem it attempts to solve:** useful observations may support a durable decision principle or
long-term tendency.

**Method:** read summaries from at least two observation pages, require a higher evidence floor than
`observe`, and reject anything that merely repeats a raw fact or an existing observation.

**Output:** append-only, evidence-linked lines in `observations/principles.md`.

**Default:** off and best understood as an extension point. On a knowledge base with only a few hundred
pages, an apparent pattern may be one coincidence away from noise. Enable it only when `observe` already
produces consistently valuable material and the knowledge base contains enough repeated history.

### Phase 3: `curate` — maintain pages that explicitly permit it

**Problem it solves:** a canonical page can accumulate duplicated sections, weak formatting, unresolved
contradictions, and scattered linked evidence.

Curate has two page-owned modes:

```yaml
akno:
  management:
    dream: hygiene
```

- `hygiene` permits Markdown cleanup, minor language repair, and local restructuring while preserving
  top-level organization and meaning.
- `synthesize` permits a full rewrite of a canonical knowledge page, organization of linked evidence,
  explicit preservation of unresolved conflicts, and bounded splitting of oversized coherent sections.

**Method:** select only `knowledge` pages with an explicit mode; build a draft from the page and allowed
evidence; run a separate verifier; then enforce deterministic checks for markers, values, links, size,
and split limits.

**Write authority has three gates:**

1. The page opts in with `dream: hygiene` or `dream: synthesize`.
2. `maintenance.curate.enabled` includes the phase in scheduled runs.
3. `maintenance.curate.write` allows an accepted draft to reach disk.

With `enabled: true` and `write: false`, scheduled runs are summary previews: they report that a page would
change, its mode, verification issues, proposed child slugs, and temporal handling. They do **not** currently
return the proposed body or a diff. Input fingerprints are recorded so unchanged pages do not spend model
calls every night. An explicit `--dry-run` is observational and does not record that state.

```jsonc
{
  "maintenance": {
    "curate": {
      "enabled": true,
      "write": false,
      "verify": true,
      "max_pages": 8,
    },
  },
}
```

For bounded event pages, synthesis can add an Akno-owned temporal declaration using complete dates
already present in the page. When an event ends, one archival assessment may reorganize later knowledge,
but a passed date is never treated as proof that a plan happened.

### Phase 4: `adopt` — make unowned documents retrievable

**Problem it solves:** extracted document text cannot appear in a page-card result when no page owns the
document.

**Method:** find readable unowned documents, make a page name from the existing filename, and create the
same minimal page shape used by ingest: title, available summary, embeds, and extraction provenance.

**Write behavior:** enabled by default and capped at 20 created pages per run. It never renames, moves,
or edits the document. A folder rule of `ingest: "file"` or `ingest: "ignore"` disables adoption there.
If a page already occupies the intended path, adopt reports the collision and asks for an explicit embed
instead of creating a near-duplicate.

**Model use:** no new call. It uses extraction and summary data already in the index; if no summary exists,
the page states only that the stored document is indexed and searchable.

### Phase 5: `conflicts` — find disagreements across pages

**Problem it solves:** the interactive write check sees only the page being changed. Two untouched pages can
state different values for the same subject and attribute.

**Method:** join sufficiently confident live facts from different `knowledge` pages, find disagreeing
values, and optionally ask the maintenance model whether they truly describe the same thing at the same time.

**Output:** every candidate receives one of three honest verdicts:

- `real`: the claims appear to conflict;
- `not_a_conflict`: different periods, scopes, or equivalent values explain the difference;
- `unverified`: structural evidence exists, but no reliable model verdict was available.

**Write behavior:** never. This phase reports evidence and a likely-current page when the verifier can
identify one. It does not choose a truth or edit a sentence.

### Phase 6: `repair` — apply only bounded, guardable fixes

**Problem it solves:** a report-only cycle can accumulate the same actionable findings every night.

Repair has two independently configurable actions:

- **Links:** repoint a broken wikilink when there is one credible target. If several candidates exist,
  the model may select only from that list; it cannot invent a page.
- **Conflicts:** when the preceding conflict phase verified a conflict and identified one current page,
  rewrite stale lines into historical wording. Values from the original line must survive unchanged.

It never deletes a claim. Ambiguous targets, changed line addresses, and rewrites that alter a value are
left alone with a reason.

```jsonc
{
  "maintenance": {
    "repair": {
      "enabled": true,
      "links": true,
      "conflicts": true,
      "max_changes": 25,
    },
  },
}
```

**Default:** off. Run a full `akno dream --dry-run` before enabling it. A real repair run groups its edits
into one change id so the night's repairs undo together.

### Phase 7: `housekeeping` — report the remaining structural work

**Problem it solves:** some problems require a person's intent, not an automatic rewrite.

Housekeeping reports:

- broken non-embed wikilinks;
- documents with no owning page, including whether their text is readable;
- pages whose type, slug pattern, or nesting depth conflicts with a matching folder rule.

It always reports and never writes. Lists are capped for readability, while counts show the full total.
Because it runs last, the report reflects anything `adopt` or `repair` changed earlier in the cycle.

### Reviewing and undoing a dream

The terminal report includes phase timings, skipped reasons, proposed or applied changes, rejected model
suggestions, conflict verdicts, remaining housekeeping counts, and change ids.

Writes are journalled by purpose rather than collapsed into one opaque nightly change. Observations,
curation, adoption, and repair can therefore have separate change ids. Use the id printed beside a section:

```bash
akno undo <change-id>
```

To retain a machine-readable audit record:

```jsonc
{
  "maintenance": { "log_changes": true },
}
```

Each run then appends one JSON object to `<state_dir>/logs/dream.jsonl`, including explicit dry runs.
This is off by default because the log duplicates sensitive inferences outside the knowledge base.

### A safe way to introduce the cycle

1. Run `akno dream --phase housekeeping` and fix obvious rule or ownership problems.
2. Run a full `akno dream --dry-run`; inspect every phase, not only the totals.
3. Keep the default `adopt` phase if minimal owner pages are useful; disable it in media folders with
   `ingest: "file"`.
4. Enable curate with `write: false` and opt in one test page. The current preview confirms whether it would
   change, but does not expose the proposed body.
5. Test curate writes only on a copied or version-controlled knowledge base, inspect the file diff, and use
   the printed change id to undo. Do not treat the summary preview as approval of unseen wording.
6. Enable observe only with a model whose dry-run patterns are worth recalling later.
7. Treat reflect as a later-stage feature, after the observation layer has real volume.
8. Enable repair last, with a low `max_changes`, after reviewing the same full-run dry output.

---

## Models and graceful degradation

Akno has five model roles. All are optional.

| Role        | Used by                                                      | Without it                                                      |
| ----------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| `embedding` | Indexing and semantic recall                                 | Lexical search still works                                      |
| `reranker`  | Final ordering of recall candidates                          | Rank-fused ordering remains                                     |
| `expansion` | Query expansion before recall                                | Search uses the query as written                                |
| `derive`    | Summaries, facts, remember, naming, and maintenance fallback | Core search/read/write still works; derived features are absent |
| `vision`    | Description of images with no readable text                  | OCR still covers scans and screenshots                          |

Two roles are on the interactive path:

- `expansion` should be fast because a person is waiting for it.
- `reranker` should be sized for the configured candidate count.

`derive` runs during indexing, ingestion, remembering, and maintenance, where output quality matters more
than interactive latency. `maintenance.model` can override it for `remember` and dream without changing the
rest of the system.

Read-only operations such as `read`, `list`, and `timeline` require no model. `write`, `move`, `forget`, and
`undo` are deterministic file and database operations, although re-indexing after a write may call `derive`.

With no models at all, Akno remains a line-citing lexical search and exact read/write layer over Markdown.
`akno doctor` reports which roles resolved and describes the specific capability lost for each missing one.

---

## Running Akno as a service

The long-lived service holds the index, watcher, model clients, and single write handle.

```bash
akno serve
akno serve --mcp
akno serve --http 127.0.0.1:7777
```

The default Unix socket is for local CLI and client calls. MCP is for compatible agent hosts. Loopback HTTP
is useful when an agent runs in a container and cannot reach the host's Unix socket.

All doors are generated from one operation registry. Transport does not grant trust: `server.mcp_allow`
controls the operations exposed over MCP and defaults to the five read operations.

Only one process may write to a state directory. If the service holds the write handle, operator commands such
as `index`, `inbox`, and `dream` are sent through it. Without a running service, they execute in-process.

Install the macOS background agents with:

```bash
akno service install --no-dream  # cautious first install: watcher only
akno service install             # watcher plus the nightly dream schedule
akno service status
akno service uninstall
```

The installation includes the watcher service and, unless disabled, a nightly dream schedule at 03:00. Use
`--dream-hour` to choose another hour or `--no-dream` to omit the scheduled cycle.

For an agent host, choose one integration:

```ts
import { open } from '@tenphi/akno-core';

const memory = await open({ aknoPath: '~/Notes' });
const result = await memory.call('recall', { query: 'car insurance renewal' });
```

```ts
import { connect } from '@tenphi/akno-client';

const memory = await connect();
const result = await memory.call('recall', { query: 'car insurance renewal' });
```

```json
{
  "mcpServers": {
    "memory": { "command": "akno", "args": ["serve", "--mcp"] }
  }
}
```

---

## Diagnostics and recovery

### `doctor`: what works and what each gap costs

Run `akno doctor` after the first index and whenever behavior changes unexpectedly. It reports the
knowledge-base path and writability, index counts, broken links, document ownership, model availability and
latency, and degraded capabilities in plain language.

### `rules`: why a page is treated this way

```bash
akno rules
akno rules household/boiler.md
```

The result lists matching rules from most to least specific and names the config file that supplied each one.

### `config`: what settings won

```bash
akno config
```

Configuration precedence is:

```text
config/default.jsonc → <state_dir>/config.json → config/local.jsonc → AKNO_* environment
```

An installed package has no checkout-level `config/local.jsonc`; its machine config normally lives at
`~/.akno/config.json`. `akno config` prints the merged result with credentials redacted and lists the
source files in precedence order.

### `bench`: whether important paths remain fast

```bash
akno bench --write
```

Deterministic storage budgets are asserted. Model-dependent latency is reported rather than failed simply
because an endpoint or GPU was temporarily busy.

### Recovery guarantees

```text
<state_dir>/
  akno.db       disposable derived index
  akno.sock     local service socket
  akno.lock     current write-holder metadata
  trash/          recoverable forgotten files
  logs/           service and optional dream logs
```

Inside the knowledge base, Akno touches only files authorized by an explicit operation or setting. By
default an index pass leaves both the set of files and every file's bytes unchanged.

If search state is suspect, rebuild the index. If a write is wrong, undo its change id. If a page or document
was forgotten, recover it from Akno's trash within the configured retention period.

---

## What Akno does not solve yet

The current product has several meaningful UX gaps. They are worth understanding before enabling unattended
maintenance.

### There is no durable human review inbox

Dream prints conflicts, previews, refused repairs, and housekeeping findings, but it does not yet offer one
persistent queue where a person can approve, dismiss, snooze, or apply them. Scheduled output therefore lives
in service logs, or in the optional JSONL audit log that intentionally duplicates sensitive material.

The strongest improvement would be a first-class `akno review` workflow with stable finding ids, last-seen
state, provenance, proposed diffs, and actions such as `approve`, `dismiss`, `apply`, and `undo`. This is
especially important for curate: its current “preview” says that a page would change but does not show the
proposed body or diff. Every reporting or preview phase should feed the same review surface.

### Searchability should not depend on an overnight write

An extracted document with no owning page is currently absent from recall because recall returns page cards.
The default `adopt` phase repairs that by creating a Markdown page later. This is internally coherent but
surprising from a user's perspective: indexing can report success while a document remains unanswerable, then
a scheduled maintenance run creates a file to make retrieval work.

Recall should be able to return an orphan document card directly, with document-page citations and a
`needs_home` state. Adoption could then become an optional filing action instead of a default write required
for search correctness.

### Dream should be a plan, apply, verify loop

The seven phases currently mix analysis, proposals, writes, and final reporting in one command. A clearer and
safer cycle would have four user-visible stages:

1. **Inspect:** find ownership gaps, conflicts, structural drift, and inference candidates without writing.
2. **Plan:** produce stable finding ids and complete proposed diffs against recorded input hashes.
3. **Apply:** execute an approved or policy-authorized bounded plan only if those inputs are unchanged.
4. **Verify:** re-index touched files, rerun relevant checks, and produce one durable receipt.

The named phases can remain as internal methods, but the operator would reason about one consistent lifecycle.
Conflict analysis should also precede `observe` and `reflect`, or unresolved claim groups should be excluded,
so higher-level inference is not built from facts the same run later identifies as contradictory.

### Maintenance permission is powerful but hard to reason about

Dream currently combines global phase switches, a separate curate write switch, page-level policy, folder
rules, dry-run behavior, and per-run caps. The safeguards are valuable; the interaction is difficult to hold
in one mental model.

A better operator UX would expose named trust profiles such as `audit`, `assist`, and `autopilot`, then show the
resolved permission for each phase and page with `akno dream status`. Expert config could remain underneath.
The scheduled profile should begin at `audit`; today, `service install` creates the dream job and `adopt` is
enabled by default, so installing background operation can eventually add Markdown pages unless the user knows
to pass `--no-dream` or disable adoption.

### The scheduled cycle has weak visibility

`service status` tells whether launchd jobs exist, while the useful maintenance state is spread across terminal
output, logs, config, and the index. A single status view should show the last run, next scheduled run, enabled
phases, model in use, applied change ids, failures, and review backlog.

### Setup assumes too much infrastructure knowledge

The first useful result currently requires editing JSON, knowing an OpenAI-compatible endpoint, choosing model
roles, indexing, diagnosing, and then connecting an agent host. The graceful no-model path helps, but the user
still has to discover it from prose.

A guided `akno init` should select the knowledge-base folder, perform a read-only scan, detect reachable
models, explain degraded choices, run one recall, and optionally install the service. That would shorten the
distance between “I have notes” and “my agent can cite them” without weakening any safety rule.

### Inference should remain visibly separate from authored memory

`observe` and `reflect` mark their pages as derived and recall ranks them lower, but once inference is written
as fluent Markdown it can still feel authored. Until a durable review layer exists, keeping these phases off by
default is the right product posture. A future design could stage inference outside canonical notes and promote
only explicitly accepted items.

---

## Command reference

| Command               | Purpose                                                | Writes to the knowledge base?    | Model roles                              |
| --------------------- | ------------------------------------------------------ | -------------------------------- | ---------------------------------------- |
| `index`               | Reconcile the index with files                         | no by default                    | embedding, derive                        |
| `recall <query>`      | Search and return cited page cards                     | no                               | expansion, embedding, reranker           |
| `read <slug>`         | Read one page or document directly                     | no                               | none                                     |
| `list`                | Browse folders, pages, or a tree                       | no                               | none                                     |
| `timeline`            | Retrieve events by range, subject, or text             | no                               | none                                     |
| `context <query>`     | Assemble one bounded pre-turn bundle                   | no                               | same as recall                           |
| `write`               | Create, append, patch, or replace a page               | yes                              | vision only for textless attachments     |
| `remember <text>`     | Retain durable knowledge and route it                  | yes                              | maintenance or derive, plus recall roles |
| `folder`              | Declare a folder and its default policy                | yes, `akno.json`               | none                                     |
| `approve` / `decline` | Resolve a held routing proposal                        | approve may write                | depends on held action                   |
| `forget`              | Retract a fact or trash a page/document                | yes                              | none                                     |
| `undo <id>`           | Restore exact bytes from a journalled change           | yes                              | none                                     |
| `move <from> <to>`    | Move a page and its owned documents                    | yes                              | none                                     |
| `ingest <path\|url>`  | Extract, name, route, store, and index                 | yes                              | derive; vision when needed               |
| `inbox`               | Process arrivals in routed folders                     | yes                              | same as ingest                           |
| `dream`               | Run the seven maintenance phases                       | depends on enabled phases        | maintenance or derive                    |
| `serve`               | Run the watcher and operation doors                    | no by itself                     | none by itself                           |
| `service`             | Install, inspect, or remove background jobs            | outside the knowledge base       | none                                     |
| `doctor`              | Diagnose paths, index, models, and structural warnings | no                               | probes configured roles                  |
| `rules [path]`        | Explain effective folder policy                        | no                               | none                                     |
| `config`              | Print resolved, redacted configuration                 | no                               | none                                     |
| `bench`               | Measure important latency budgets                      | only with explicit write testing | configured search roles                  |
| `redeploy`            | Build, restart, and wait for the local service         | no knowledge-base write          | none                                     |

Add `--help` to a command for its flags. Commands that support structured output accept `--json`.
