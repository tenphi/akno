# Autonomous page curation

- **Status:** proposed
- **Depends on:** [Maintenance plans and decisions](001-maintenance-plans-and-decisions.md)

## Problem

The present curation phase can rewrite an explicitly opted-in page, but an autonomous memory needs to maintain
the shape of the knowledge base as well as the prose inside one page. Over time, pages become mixed-purpose,
duplicated, fragmented, stale, inconsistently linked, or contradicted by newer evidence. Fixing those problems
manually turns a memory system into another inbox.

This specification expands curation from page rewriting into explicit, reviewable transformations. It keeps
strong invariants around provenance, scope, reversibility, and ambiguity without requiring a human to approve
every safe operation.

## Outcome

The maintenance planner can propose seven transformation classes:

| Class           | Purpose                                                    | Typical risk  |
| --------------- | ---------------------------------------------------------- | ------------- |
| `hygiene`       | Normalize structure without changing meaning               | low           |
| `broken_link`   | Repair a link when the target is unambiguous               | low to medium |
| `split`         | Divide a mixed-purpose page into coherent pages            | medium        |
| `extract`       | Move one reusable subject out of a larger page             | medium        |
| `merge`         | Consolidate duplicate or near-purpose pages                | high          |
| `contradiction` | Reconcile or clearly represent incompatible claims         | high          |
| `synthesis`     | Integrate eligible outside evidence into a maintained page | high          |

Each transformation produces a maintenance plan item containing exact file operations. The existing
`akno.management.dream` frontmatter remains the page-level boundary, but its meaning becomes clearer:

- `none`: never rewrite or structurally transform the page automatically;
- `hygiene`: allow low-risk hygiene and unambiguous link fixes;
- `synthesize`: allow all enabled transformation classes, subject to policy and guards.

Folder rules may narrow these permissions. They may not broaden an explicit page-level `none`.

## Candidate discovery

Candidate discovery is deterministic wherever possible. Models judge semantic coherence and propose content;
they do not scan an unbounded knowledge base or choose arbitrary paths.

Signals include:

- headings that divide unrelated subjects;
- one page with several independently linked sections;
- title, aliases, key entities, and embedding or lexical similarity between pages;
- duplicated claim fingerprints or overlapping evidence references;
- links whose target no longer exists and has one high-confidence replacement;
- page references that resolve only through a moved-page history entry;
- explicit conflict records;
- outside document evidence linked to a maintained page but not represented in its facts;
- excessive size, repeated empty sections, malformed managed blocks, or inconsistent generated headings.

Candidate generation has configured limits for pages scanned, pairs compared, source bytes, model tokens,
items per class, and total planned writes. Exceeding a limit produces a typed skipped reason, not a truncated
proposal that appears complete.

## Shared transformation contract

Every proposed transformation must:

1. name the user-visible problem it solves;
2. cite the exact pages, documents, claims, and lines used as evidence;
3. preserve authored wording unless changing it is necessary for the stated operation;
4. preserve unknown frontmatter keys and content outside managed regions;
5. state what moved, what was rewritten, and what was intentionally left unchanged;
6. contain complete before/after bytes and input hashes;
7. pass transformation-specific guards before any decision stage;
8. be reversible through one grouped change-journal entry;
9. define post-apply checks that can distinguish success from a merely valid write.

The planner must not treat a document summary, OCR rendition, model description, observation, or inferred
principle as equivalent to authored fact. Provenance survives every move and synthesis.

## Hygiene

Hygiene fixes presentation and generated structure while preserving semantics. Eligible operations include:

- normalize managed heading order and spacing;
- remove duplicate generated facts with identical normalized value and provenance;
- remove empty Akno-managed sections;
- repair malformed Akno-owned markers;
- update generated indexes or summaries from the page's current accepted facts;
- normalize links to the canonical slug without changing link text.

Hygiene does not paraphrase authored prose, remove unique claims, change dates or numbers, or turn an inference
into a fact. A hygiene item is low risk only when semantic tokens in authored regions remain byte-identical.

## Broken links

A broken link may be repaired automatically only when one target is established by a stable signal such as:

- the target page's persistent id;
- an Akno-recorded move from the old slug;
- an exact alias that resolves to one page;
- a document id whose owning page moved.

Title similarity alone may generate candidates but cannot authorize a link rewrite. When several targets are
plausible, the item shows the choices and is blocked for a human or curator. Links to intentionally absent,
external, or not-yet-created pages remain untouched and are distinguished in housekeeping output.

Postconditions require the new target to resolve and the link's surrounding text to remain unchanged.

## Split and extract

A `split` turns one mixed-purpose page into two or more coherent pages. An `extract` moves one reusable subject
from a page while leaving the original page's main purpose intact. Both are one atomic item.

The planner proposes:

- a destination slug and title for every new page;
- the exact source ranges assigned to each destination;
- any short bridging text required to keep the original page readable;
- redirects or link updates for headings that were directly referenced;
- document ownership and embeds after the operation;
- the handling of frontmatter, aliases, roles, management policy, and page ids.

Guards require:

- every non-whitespace source byte to be accounted for as retained, moved, or deliberately rewritten;
- unique destination slugs and new page ids;
- authored sentences to move verbatim by default;
- provenance-bearing claims and document references to move with their content;
- no document to acquire a new owner merely because it was mentioned in the extracted section;
- incoming links to remain valid or be included in the same item;
- the original page to retain a coherent primary purpose after extraction.

A model may propose connective prose, titles, or summaries, but these are marked as generated. It may not
silently condense away unique details to make a split fit a size budget.

## Merge

A merge consolidates pages that represent the same subject or have purposes so close that separate pages hurt
retrieval and maintenance. High text similarity is not sufficient: recurring templates, daily notes, and two
different people with similar fields must remain separate.

The planner must first state a merge identity claim: why the pages represent one durable subject. Supported
signals include a shared persistent id, explicit aliases, exact unique identifiers in invented or user data,
consistent inbound links, overlapping owned documents, and semantic agreement across several independent
fields. Conflicting identity signals block the merge.

The proposal selects a canonical page using, in order:

1. an explicit canonical or protected designation;
2. a stable page id referenced elsewhere;
3. a folder rule or role preference;
4. the page with greater authored content and valid inbound links;
5. a curator or human decision when the above do not resolve it.

The merge item includes:

- the complete canonical result;
- a field-by-field disposition of unique, duplicate, and conflicting content;
- updates for every resolvable inbound link and embed;
- document ownership changes, if any;
- aliases preserving old titles and slugs;
- removal or archival of non-canonical pages through the journal.

Unique authored information must survive. Equal claims with distinct provenance are deduplicated in display but
retain both evidence references. Incompatible claims are represented as a conflict or time-scoped history; they
are never resolved by whichever page happened to be chosen as canonical.

Automatic merge is disabled unless its policy explicitly names the eligible folders or page roles. Even then,
the item must pass identity, information-preservation, link, ownership, and conflict checks.

## Contradictions

Conflict detection happens before synthesis, as defined in [Dream lifecycle](003-dream-lifecycle.md). A
contradiction transformation acts on a typed conflict record, not an unconstrained model impression.

The allowed outcomes are:

- `not_a_conflict`: the claims concern different subjects, fields, scopes, or times;
- `time_scoped`: both values are retained with explicit effective dates;
- `superseded`: newer eligible evidence replaces an older claim while retaining history and provenance;
- `qualified`: a broad claim is narrowed so both sources can be represented accurately;
- `unresolved`: the conflict stays visible and neither claim is used for new inference.

Automatic resolution requires structural proof of identity and temporal ordering. Source prestige or model
confidence alone cannot silently delete an authored claim. An unresolved item may still propose a visible
conflict block or metadata marker, provided it preserves both claims.

## Synthesis from outside facts

Synthesis updates a maintained page from evidence outside that page. Eligible evidence includes:

- an owned or explicitly linked document;
- an orphan document selected by a user or unambiguous stable identifier;
- another authored knowledge page;
- accepted observations or principles whose provenance chain is intact;
- a source connector only when a future connector contract records its origin and capture time.

The phrase “outside facts” does not authorize open-ended web research in the dream cycle. Fetching new external
sources is a separate, explicit capability. This phase synthesizes evidence already admitted to Akno unless a
future source policy says otherwise.

Each synthesized claim records source, source kind, location, capture time when relevant, and whether it is a
quote, extraction, authored statement, or inference. The planner distinguishes:

- adding a missing fact;
- updating a time-varying fact;
- summarizing several compatible facts;
- presenting an unresolved disagreement.

No synthesized result may cite evidence that the model was not shown. A fact derived only from a model's prior
summary must retain the original source reference or be labeled as an inference.

## Policy and risk

Transformation policies use the modes from [Trust modes and status](005-trust-modes-and-status.md). A suggested
initial risk map is:

| Transformation                        | Suggested autonomous-profile policy |
| ------------------------------------- | ----------------------------------- |
| hygiene inside managed blocks         | auto                                |
| stable-id or move-history link repair | auto                                |
| split or extract                      | review                              |
| merge                                 | review                              |
| contradiction representation          | review                              |
| contradiction resolution              | review                              |
| synthesis                             | review                              |

This table is an onboarding recommendation, not a permanent ceiling. An explicit autonomous profile may send
all classes through a curator and automatically apply accepted items within scope. Deterministic guards remain
mandatory in every profile.

## Verification

After reindexing, transformation-specific verification checks include:

- all intended links and embeds resolve;
- no unexpected new broken link or orphaned owned document exists;
- source and destination page ids are correct and unique;
- the union of unique authored facts before a split or merge remains discoverable afterward;
- conflict records are closed, replaced, or deliberately unresolved as planned;
- recalled results for affected subjects still contain their prior unique evidence;
- no page outside the plan item changed;
- a second planning pass does not immediately propose the inverse operation.

The last check detects unstable split/merge loops. Akno fingerprints an operation and suppresses its inverse
until a cooldown expires or relevant source content changes.

## Acceptance criteria

- Audit mode emits exact, independently decidable diffs for every transformation class.
- A merge cannot discard a unique authored claim or provenance reference without failing a guard.
- A split accounts for all source content and preserves inbound links or explicitly reports each unresolved one.
- A link repair requires a stable unambiguous signal for automatic approval.
- An unresolved conflict is excluded from observation and reflection inputs.
- Synthesis identifies the origin and evidence kind of every proposed fact.
- Protected pages and `dream: none` pages are never rewritten by curation.
- Repeating a successful run over unchanged inputs produces no equivalent new plan item.
- An applied transformation can be undone as one journal change group.
- Split/merge oscillation is detected and suppressed.

## Non-goals

- Reorganizing the entire knowledge base to match a model-invented taxonomy.
- Rewriting authored prose merely to make tone consistent.
- Open-ended browsing or automatic admission of unknown external sources.
- Treating similar templates as proof that two pages are duplicates.
- Hiding contradictions to make summaries read more cleanly.

## Open questions

- Should non-canonical merged pages become small redirect stubs or be removed after aliases and inbound links
  are updated?
- Which page roles are safe enough for automatic split and merge in the first autonomous profile?
- Should a generated bridge sentence live in an Akno-managed block so a later undo or refresh can identify it?
