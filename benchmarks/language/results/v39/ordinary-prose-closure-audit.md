# PR #70 ordinary-prose closure audit for issue #62

Reviewer: GPT-5.6 Sol in a read-only code-review role. I traced the current implementation and existing tests against issue #62. I did not inspect fresh V39 outputs, rerun the full suite, edit runtime code, or update the issue.

## Disposition

No actionable acceptance gap found within issue #62's stated bounded first scope.

This is a finite English/Russian deterministic discourse projection, not arbitrary discourse understanding. The implementation and documentation state that limit explicitly; unsupported implicit qualifications and unfamiliar speaker conventions can still be missed. That limitation is compatible with the issue's “bounded passage qualification” requirement and should remain visible in release evidence.

## Authority and invalidation

`packages/core/src/kb/prose.ts` computes qualification from the complete current Markdown file, attaches the hash of those complete bytes, and includes the deciding heading/turn/paragraph frame. It handles ATX and setext headings, nested heading scope, block quotations, named and role speaker turns, source fences, code fences, plans, questions, rejection, conditional/tentative language, and a bounded backward qualification across a paragraph break. Oversized frames become `unresolved` with no truncated frame and no factual eligibility.

The source remains authoritative. `qualifyProseLines` adds projection metadata to returned line objects and removes attached fact/confidence fields from nonfactual lines; it never rewrites Markdown. Existing tests cover exact bytes and file set across structural indexing, restart, and rebuild. The projection hash changes when only an enclosing heading changes.

`packages/core/src/memory/prose-projection.ts` replaces per-page projection rows and removes disqualified timeline events and derived facts before deferred model work. It also suppresses a page summary as soon as any material nonfactual prose is present. Projection-version mismatch contributes typed `partial_memory_index` rather than silently treating old rows as current.

There is a second live-byte authority check at use time. Reads recompute qualification from the current file. Fact-derived graph edges carry the prose source hash, and `packages/core/src/ops/graph.ts` compares it with the current file hash before traversal; stale edges are omitted and produce `partial_graph_index`. Observation evidence reopens the source and requires the current line to remain fact-eligible before using an ordinary fact. These checks cover the watcher/indexing interval instead of trusting stale database projection.

## Fact and graph derivation

`packages/core/src/index/derive.ts` excludes an ordinary line from fact mining whenever its projection is nonfactual or unresolved. Managed items use their separate typed eligibility. `packages/core/src/memory/prose-projection.ts` removes previously derived facts/events when a later structural pass changes the line's qualification.

The graph builder accepts ordinary fact nodes only when the page derivation is current and the matching prose entry is factual and eligible. Graph traversal additionally checks current source bytes as described above. Existing integration coverage changes only a factual heading to hypothetical, then verifies that the line loses its fact, its summary is cleared, its fact graph edge disappears, and the graph reports partial state during reconciliation.

## Recall, context, and answers

Search partitioning uses `prose_entries` to place chunks into eligible or contextual sets by requested memory view. Live result assembly recomputes qualification from the complete current file and filters individual lines, so a mixed chunk cannot make a nonfactual line factual. The bounded deciding frame travels with each returned line and counts against retrieval evidence budgets.

Factual recall/context exclude report, hypothetical, tentative, planning, rejected, question, and unresolved lines. Explicit matching views and `all` can inspect qualified nonfactual passages with their original text and frame. Unresolved passages remain inspectable as typed `status: unresolved`; recall reports `prose_discourse_unresolved`. Answer assembly has an additional explicit `status === qualified` requirement, so unresolved prose is ineligible even for answer view `all`. Answers over qualified nonfactual prose receive the frame and must pass language/qualification guards and the full proposition/action/qualification semantic verifier.

The distinction between inspection and factual use therefore survives chunk selection and summary paths. Whole-page summaries are suppressed for pages containing nonfactual passages, preventing a summary from laundering an embedded proposition.

## Observe, reflect, and curate

Observe/reflection consume eligible fact evidence rather than raw prose. Before observation evidence is admitted, the current file is read and the ordinary source line must still be fact-eligible; stale or nonfactual facts are skipped. This keeps hypothetical, tentative, reported, rejected, and unresolved passages out of inference even if an older fact row exists.

Curate uses a conservative whole-page boundary while passage-aware rewriting is absent. Pages containing material nonfactual prose are held before model rewriting with typed `prose_discourse_held`; split/merge paths apply the same restriction, and neighboring synthesis evidence excludes such pages after checking current bytes. This is intentionally broader than line-level retrieval but safe: it may defer useful maintenance rather than erase qualification. Exact editor changes and read-only inspection remain available.

## Existing acceptance evidence reviewed

The focused tests cover:

- hypothetical headings in English and Russian, nested and sibling heading boundaries;
- block quotations, nested speakers, role headings, source fences, and multi-paragraph speaker scope;
- mixed factual and hypothetical sections;
- fenced examples containing managed-looking text;
- oversized/truncated context as unresolved typed degradation;
- heading-only editor changes invalidating facts, summaries, and graph evidence;
- restart/rebuild byte and file-set preservation;
- ordinary factual negation, Unicode text, and recurring schedules remaining eligible;
- qualified inspection versus factual context/answer abstention;
- whole-page curation holds and observation evidence revalidation.

No semantic classifier is required, so classifier absence cannot fail open. Index/projection incompleteness and unresolved bounded frames are represented as typed degradation rather than as evidence that material is absent.
