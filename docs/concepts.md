# Core concepts

Akno is easier to use once five boundaries are clear: files versus index, pages versus documents, knowledge
versus evidence, discovery versus answering, and permission versus execution.

## Files and derived state

Markdown and attached documents are the source of truth. The state directory contains a derived reading:

```text
knowledge base                         state directory
──────────────                         ───────────────
Markdown pages          ──index──>     chunks and full-text search
PDFs, images, files     ──index──>     extracted document text
links and frontmatter   ──index──>     facts, events, identities, graph edges
                                        journal, trash, plans, run receipts
```

Deleting and rebuilding the search index must not change knowledge-base bytes. Do not delete the database when
journal undo history or pending maintenance plans still matter; those durable workflow records also live there.

## Pages and documents

A Markdown page explains what something means in the knowledge base. A document preserves its own source text.

Akno indexes both without copying a complete PDF extraction into the page body. This avoids duplicate results
and prevents a stale copy from surviving when the original changes.

An attached document is “owned” when a page embeds or conventionally names it. Ownership means organization,
not a user account or access-control boundary. An unowned readable document is still searchable immediately as
an orphan document card. `adopt` can later create its minimal organizing page.

If an original disappears, retained indexed text may still support a degraded result. Akno distinguishes:

- `available`: the original is readable;
- `degraded`: a retained extraction or rendition remains, but the original cannot be checked;
- `unavailable`: only identity metadata remains.

## Knowledge, evidence, inference, and ignored material

Page role controls how indexed material participates in retrieval:

| Role        | Searchable? | Normal recall behavior                            | Fact-derived? |
| ----------- | ----------- | ------------------------------------------------- | ------------- |
| `knowledge` | yes         | Summary plus matching lines; full body on request | yes           |
| `source`    | yes         | Summary plus a bounded quotation window           | no            |
| `inference` | yes         | Returned below authored knowledge                 | no            |
| `ignored`   | no          | Not indexed as memory                             | no            |

A contract, email, transcript, or article is usually `source`: useful evidence, but not automatically a
canonical claim. Role is retrieval policy, not access control; an exact `read` may still return the complete
source page.

A knowledge page can switch to evidence partway through its body:

```markdown
The canonical explanation is above this line.

<!-- source -->

Quoted correspondence and raw evidence are below it.
```

The fenced section remains searchable but is not fact-mined or returned in full by ordinary recall.

## Folder rules and page policy

Folder rules describe taxonomy once so an agent does not invent a new filing decision on every write. Rules can
live in machine configuration or `<akno_path>/akno.jsonc`; the most specific matching glob wins.

```bash
akno folder warranties \
  --description "Appliance and electronics warranties, with expiry dates."

akno folder conversations \
  --description "Chat transcripts: what was said." \
  --role source --remember deny
```

An agent writing into an undeclared gated folder receives `requires_folder` and nearby alternatives. A folder
declaration needs a useful description, not a separate approval ceremony. `akno folder` persists both the role
and the resolved remember decision: a declared knowledge-memory folder integrates by default, while a declared
non-knowledge folder denies. Handwritten rules that omit `remember` do not inherit that convenience; they stay
read-only until the decision is explicit.

Page frontmatter can be stricter or more specific than the folder:

```yaml
---
akno:
  role: knowledge
  management:
    remember: integrate
    observe: integrate
    dream: synthesize
  about:
    - people/ada-marlow
---
```

- `remember: integrate|deny` controls whether retained claims may be placed there.
- `observe: integrate|deny` controls whether Akno may add or update its own level-two observation blocks there.
- `dream: none|hygiene|synthesize` controls which curation proposals may target that page.
- `about` states which canonical entities receive evidence from the page.

An opt-in permits planning; it does not order a rewrite. The maintenance profile, transformation policy,
deterministic guards, budgets, decisions, stale-input checks, and verification still apply.

Role and write authority are independent. A plain page defaults to searchable `knowledge` and
`remember: deny` and `observe: deny`, which is useful for material that should participate in answers without
accepting auto-injected facts or observations. Akno-created memory pages explicitly declare `remember: integrate`. That same explicit
admission lets maintenance inspect only Akno's marker-bound fragments: it does not make authored page content
rewritable and does not require broad `dream` authority.

`observe: integrate` is separate from both of those grants. It authorizes only a versioned
`akno:observation` marker plus its readable payload in an existing compatible section. It cannot create a page,
inject retained facts, or edit adjacent authored prose.

## Citations, facts, and confidence

Page evidence is addressed as `slug:line`. Document evidence includes its stable document identity and original
page number where available.

Fact derivation adds structured search signals, not a competing source of truth. A confidence such as `~0.94`
means “the deriver believes this line expresses a well-formed durable claim.” It does not mean the claim is 94%
likely to be true. The cited file remains authoritative.

Superseded facts keep history and validity bounds instead of competing with the current value. Conflict
analysis can prevent unresolved claims from becoming evidence-graph edges or foundations for inferred
observations.

## Memory levels

Akno keeps consolidation explicit instead of letting fluent prose erase how it was learned:

| Level | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| L0    | Source or document evidence                                            |
| L1    | Authored or retained claims, decisions, preferences, plans, and events |
| L2    | Observations consolidated from independent eligible L1 facts           |
| L3    | Reusable principles reflected from eligible L2 observations            |

An L2 marker records a stable id, exact subject entity, lifecycle disposition, every fact and source-line hash,
and the recomputable independent proof groups. Its payload visibly starts with `Observation` and links its
evidence. Indexing excludes malformed, stale, ambiguous, unauthorized, or under-supported blocks from factual
recall and graph traversal without deleting the readable Markdown. The ordinary deriver cannot import an L2
payload back as an L1 fact.

## The evidence graph

Indexing projects exact page links, `akno.about`, document ownership, events, eligible derived facts, typed
retained-memory relations, and eligible observation-to-leaf lineage into a disposable graph.

Each edge retains a current source hash and an exact line, frontmatter, fact, retained-memory, event, or
document locator. Exact
canonical slugs and declared aliases may resolve identity. Ambiguous names retain candidates but produce no
traversable edge. Similarity alone never establishes identity.

`graph` inspects bounded one-to-three-hop paths. `recall` can use shorter graph paths as one candidate arm, but
the final card still cites ordinary source evidence. Optional contextual resolution can choose only among
already known exact-name candidates and must abstain unless one is clearly supported.

The graph is an evidence index, not hidden memory. It can be rebuilt from current source files.

The same level-one marker also builds a semantic retrieval projection. `factual`, `history`, `planning`,
`reports`, `questions`, and `discussion` are views over retained discourse, not separate folders or copies.
Akno applies the selected view before candidate budgeting, while every returned line keeps its complete memory
qualification. Ordinary authored prose remains untyped and participates in every view.

## Result states

Absence has three materially different meanings:

| State         | Meaning                                                                                | May an agent say “not recorded”?          |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| `empty`       | The complete available operation found no eligible result                              | Usually, within the reported search scope |
| `degraded`    | A useful partial result exists, but a capability failed or a safety bound truncated it | No; qualify the limitation                |
| `unavailable` | The operation could not inspect the required state                                     | No                                        |

This distinction is part of the public protocol, not wording inferred from errors.

## Single/shared ownership

Akno currently assumes one owner or one jointly trusted knowledge base. It has a single writer and no per-page
accounts, ACLs, or multi-tenant isolation. Page roles and folder rules control relevance and mutation policy;
they are not security permissions.

See [Limitations](limitations.md) for the rest of the current boundary.
