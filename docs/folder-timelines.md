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

The declaration also opts the ledger into event writes and timeline-history maintenance, even inside a
folder whose ordinary documents have `role: source` or `remember: deny`. No folder-specific exception
is needed. Those inherited policies continue to protect the documents; the ledger's index role is not
changed. Rules naming the ledger itself (such as `work/timeline` or `**/timeline`) and its own frontmatter
can still restrict it. For example, `akno.management.remember: deny` makes the declaration read-only.
Ignored folders, ignored pages, symlinks, invalid declarations, and conflicts remain fenced off.
An absent virtual default has no declaration grant and continues to use the ordinary folder policy.

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
remain on those pages, appear in the timeline query, and gain a readable reference in the nearest
declared `timeline.md`. Standalone events from `write` or legacy `remember` and source-backed retained
references share one newest-first list under year headings. References link to their canonical subject
page and preserve actual, scheduled, planned, and deadline qualifications. Their trailing hidden marker
identifies Akno-owned rows so a later correction can update them without touching standalone events.
They are not independent events, so the timeline query does not count them twice. A mixed conversation can
therefore produce items in several timelines without labels from the caller. Evergreen facts do not gain
an invented event date. Duplicate detection and catch-all destinations cannot silently cross boundaries.
Managed references use the same bold-date-and-separator style as authored event lines. Exact times display
as a clock and explicit UTC offset instead of a raw ISO timestamp; a compact annotation keeps scheduling,
reporting, and other qualifications visible. The trailing Akno marker is needed for safe reconciliation,
but the linked subject page remains the canonical memory.
The ledger shows a report source once. It omits the canonical page's repeated status heading and, when the
same named source opens the sentence with a routine reporting phrase, keeps that source in the ledger
annotation instead. Inner speakers and uncertainty remain in the sentence. A planned due date displays
as a planned deadline, and a proposed plan as a proposal; neither becomes a completed event.
Exact retention replay does not append a second reference. Corrections, retractions, explicit forgetting,
page moves, and undo update the same dated list while preserving standalone event text and prose.

Existing retained temporal memories can be materialized explicitly. Preview first; applying writes the
affected ledgers in one journalled change that can be undone. Ordinary indexing never performs this write.
Reconciliation accepts indexed managed memories with bullet or paragraph payloads.
It also moves older generated reference blocks into the same year-by-year list as standalone events.
For a ledger made only of dated rows and year headings, this explicit, undoable migration sorts those
rows newest first without changing their text or links. A ledger with interspersed prose keeps its
existing event order. Ordinary writes never reorder existing standalone events.
Run the same preview after creating or removing a timeline boundary to align the visible files with
the query's updated folder membership.
After a presentation change, preview and apply reconciliation to refresh older Akno-owned references.
This leaves canonical pages and authored event rows alone, and the journal supports undo.

```sh
akno migrate --retained-timelines
akno migrate --retained-timelines --apply
akno migrate --retained-timelines --timeline timeline --apply  # only the root ledger
```

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
Explicit ledger `remember: deny`, ledger source roles, and Markdown quarantine still prevent automatic writes.
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

The planner handles three cases:

- **Dated notes:** the shared retention extractor and an independent verifier identify actual events
  with an explicit day-level date. An admitted event is added to the note's nearest declared timeline,
  with a link to the unchanged source note. No event date is inferred from file timestamps or today's date.
- **Source evidence:** correspondence and readable indexed documents may supply explicitly supported
  temporal assertions. The shared retention verifier preserves issuer/speaker, attribution, schedules,
  uncertainty, partial precision, and source dates. Qualified canonical blocks live in the ledger-owned
  `timeline-memories.md` companion; the timeline contains ordinary maintained references to those blocks.
  The companion is created only by an admitted plan and has its own explicit memory policy. A pre-existing
  unrelated file, per-file denial, ignore, quarantine, or symlink holds the operation. The declaration grants
  no authority to change other source pages or their policies.
- **Parent-ledger entries:** semantic ownership assessment can propose transferring a standalone event
  line to a descendant timeline. The transfer preserves the complete line and all its citations. A shared
  person, keyword, or cross-link is insufficient; uncertain entries stay where they are.

Give timelines a short purpose description when folder names alone would be ambiguous. Automatic
relocation only goes from an ancestor to a descendant; sibling or upward corrections remain explicit.
Multi-line entries, relative or reference-style Markdown citations, HTML citations, relative wikilinks,
and ambiguous Markdown structures are held for inspection. Absolute inline Markdown citations can
transfer unchanged. Unrelated generated reference rows do not block standalone entries in the same
ledger; managed rows themselves remain owned by retained-timeline reconciliation.

Knowledge-note extraction remains limited to independently verified actual day-dated events. Source
curation instead keeps reports as reports and plans as plans; it cannot promote a reported statement
into an unqualified historical fact. File or processing timestamps never establish an event date.
Existing Akno-managed pages and rendered timeline references are not new source evidence.

A complete duplicate assertion adds source support/citations to one existing canonical item and ledger
reference. Paraphrases need an explicit equivalence decision; an uncertain match is held. Repeated
support for the same issuer's assertion does not create independent proof. Different speakers, materially
different qualifiers, or conflicting event dates remain separate attributed assertions. A new date alone
never establishes correction, rescheduling, or occurrence. Explicit same-source relations remain qualified
and preserve prior history. This pass does not adjudicate which disputed date is true.

Private per-source progress records the processed fingerprint, extracted candidates while unfinished,
accepted/rejected decisions, plan/item links, and eventual change id. Successfully processed unchanged
sources skip further extraction, including after restart or index rebuild. Changed sources, relevant
policy/ownership/context changes, or extraction-contract changes invalidate the cached decision. Pending
or budget-deferred work remains available; partial batches reuse verified candidates and their admitted
relation targets. Failed/incomplete extraction retries with a bounded delay, and oldest unfinished sources
receive priority. An owner undo stays undone until the source evidence changes. Processing marks are
never written into source documents. Missing or newly ineligible recorded sources produce held coverage;
extraction omission alone does not retract a previous assertion. Source revision receipts and exact evidence
remain available through existing retention/provenance machinery.

This is transfer into qualified memory. Observation/generalization behavior is unchanged.

Each extraction pass examines at most `maintenance.curate.max_pages` uncached inputs per cycle. Source curation follows a cycle with no legacy history actions and seals one bounded source batch per plan; later cycles continue other sources. The separate
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
