# Folder-owned timelines

An existing `timeline.md` declares a timeline for its folder. Subfolders inherit the nearest enclosing
timeline unless they contain their own. A work or project timeline is excluded from the root chronology
and its parent's chronology by default. No separate registry is needed.

For example:

```text
timeline.md
home/repairs.md
work/timeline.md
work/notes.md
work/project-example/timeline.md
work/project-example/notes.md
```

An event owned by `home/repairs` belongs to the root timeline. An event owned by `work/notes` belongs to
`work/timeline`. The project's events belong to `work/project-example/timeline`.

## Declare and discover

Create a file named exactly `timeline.md` in the folder that needs its own chronology. An empty file is
enough, including a file containing only whitespace. Akno recognizes it immediately and initializes its
Markdown structure on the first admitted event write. Discovery, queries, indexing, rebuilds, and dry
runs leave the file unchanged. Undo restores its exact original bytes.

You can also give it a short introduction explaining what belongs there:

```markdown
---
type: timeline
---

# Example project history

Prototype development, testing, and delivery for the example project.
```

The existing `# Timeline` heading and authored event-line formats are also recognized. An unrelated file
with that name is reported as an invalid boundary and is never adopted or overwritten. Creating a
boundary does not create or modify any other file. Akno does not automatically create inner timelines.

Already indexed temporal items on pages in the folder appear in its chronological view even while the
ledger is empty. Extracting additional history from ordinary notes and relocating old parent-ledger
entries happens through maintenance, separately from discovery and indexing.

```sh
akno list --kind timelines
akno list --kind timelines --json
```

Discovery includes each ledger's slug, folder, description, status, and whether event writes are allowed.
The configured `paths.timeline` remains the default ledger, including when it has a custom name or lives
inside another folder. Its logical scope is the whole knowledge base outside declared inner boundaries;
it does not also create an inner boundary for its physical folder. An absent default ledger remains a
virtual default and can be created on the first admitted event write, preserving existing behavior.

## Query and remember

```sh
akno timeline --since 2031-04
akno timeline --timeline work/timeline --since 2031-04
akno timeline --timeline '*' --since 2031-04
akno context --timeline work/timeline --days 30
```

The API accepts the same `timeline` selector on `timeline` and on the recent-history section of `context`.
Use `list({kind: "timelines"})` for discovery. Omit the selector for the default; use `"*"` only when a
combined chronology is wanted. Unknown selectors are rejected. Results identify their timeline and
whether membership came from an owning page, an authored ledger, or a document path.

Ordinary `remember` and `retain` callers still send the source text. Akno selects each item's canonical
page using the existing ownership checks, folder purposes, and timeline descriptions. Temporal items
remain on those pages and appear in the appropriate timeline projection. A mixed conversation can
therefore produce items in several timelines without labels from the caller. Evergreen facts do not gain
an invented event date. Duplicate detection and catch-all destinations cannot silently cross boundaries.

An explicit page-plus-event write uses that page's nearest ledger. A standalone event needs an explicit
timeline when more than one timeline exists:

```sh
akno write --timeline work/timeline --event '2031-04-02=Prototype inspection completed.'
```

For a standalone event with no selected owner, the receipt has `outcome: requires_approval` and
`hold.reason: timeline_required`; choose an advertised timeline and repeat the request. This is a
placement question, not a saved event. Legacy conversational event extraction can select a declared
timeline semantically, and reports `held_events` when that decision cannot be made safely.
When a remember call writes both retained page memories and legacy ledger events, its `change_ids`
lists every journalled change in apply order. Undo those changes in reverse order to revert the whole call.

Ledger formatting remains Akno's responsibility. Generic content/append writes to inner ledgers are
refused, just as they are for the default ledger. Exact patch/replace corrections remain available.
Explicit `remember: deny`, source roles, and Markdown quarantine still prevent automatic ledger writes.
Creating a ledger does not authorize remembered facts on otherwise read-only subject pages.

## Existing history and boundary changes

Membership follows the physical owning page or ledger, never a wikilink to a person or another subject.
The `timeline_history` maintenance policy can populate declared timelines, including empty files, from
existing history. It inherits the maintenance profile: the default `audit` prepares exact plans;
`review` waits for a human decision; `autonomous` asks a separate curator before applying each plan.

```sh
akno dream --phase curate --mode audit
akno dream status --pending
akno plan diff <plan_id>
```

The planner handles two cases:

- **Dated notes:** the shared retention extractor and an independent verifier identify actual events
  with an explicit day-level date. An admitted event is added to the note's nearest declared timeline,
  with a link to the unchanged source note. No event date is inferred from file timestamps or today's date.
- **Parent-ledger entries:** semantic ownership assessment can propose transferring a standalone event
  line to a descendant timeline. The transfer preserves the complete line and all its citations. A shared
  person, keyword, or cross-link is insufficient; uncertain entries stay where they are.

Give timelines a short purpose description when folder names alone would be ambiguous. Automatic
relocation only goes from an ancestor to a descendant; sibling or upward corrections remain explicit.
Multi-line entries, Markdown or HTML citations, relative wikilinks, and ambiguous Markdown structures
are held for inspection. Copying their bytes alone could lose context or change link targets.

Extraction uses authored knowledge notes that allow remembering. Plans, tentative statements, reports,
partial dates, source-role pages, and source renditions cannot become unqualified historical facts.
Pages containing Akno-managed records are left to their existing temporal projection and maintenance;
this pass does not copy their qualified memories, alter receipt membership, or change replay semantics.

The planner examines at most `maintenance.curate.max_pages` uncached notes per cycle. The separate
`maintenance.curate.max_timeline_events` ceiling (default `20`) bounds additions/transfers and ownership
calls; zero disables history planning. Full evidence must fit the bounded curator context. The normal
shared maintenance budgets still apply. `maintenance.policies.timeline_history: "off"` disables this
transformation independently of other curation.

Changes to evidence, timeline declarations, purposes, or write policies invalidate a pending plan.
Transfers remove the parent entry and insert the descendant entry in one journalled item; failed writes
roll back, and undo restores every affected file, including the exact bytes of an empty declaration.
Pending plans survive restart without another extraction pass. Unchanged completed or rejected work is
suppressed; changed inputs can be assessed again. Run receipts expose counts and typed hold reasons;
private source text and exact diffs stay in the existing maintenance-plan payload.

The separate structural preview remains useful for inspection:

```sh
akno timeline --timeline '*' --migration-preview --json
```

The preview names source lines, cross-timeline link suggestions, missing targets, and unlinked events
whose intended home cannot be established structurally. A suggested target is a review aid, not proof
of ownership. The preview does not move entries. Use maintenance for assessed ancestor transfers, or
explicit journalled ledger corrections for other changes. Do not bulk-apply link suggestions or have
indexing rewrite the old ledger. Keep the original source attribution when correcting.

Creating a boundary immediately separates existing subject-page memories under it. Removing a boundary
makes those pages inherit the next enclosing timeline. Moving a subject page changes the membership of
its page-owned temporal items; authored entries left in an old ledger stay with that ledger and can be
reviewed separately. Indexing and rebuilds reconstruct projections without editing source bytes.

A malformed, unreadable, ignored, or quarantined ledger remains a boundary. Its events are never
silently reassigned to the parent. A query specifically selecting an unavailable boundary returns
`unavailable`; a combined query can return safe results with `timeline_boundary_unavailable` degradation.
Use discovery to inspect the affected declaration. Corrections, source replay/retraction, and undo keep
their existing durable receipts; replay reports the original write's placement.

Timeline boundaries organize chronology. Ordinary recall, graph traversal, permissions, and synthesis
continue to use their existing policies. The `timeline` context selector applies only to recent history;
it does not promise that all other context content comes from that timeline.
