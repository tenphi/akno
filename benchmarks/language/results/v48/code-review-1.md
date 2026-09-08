# V48 code review 1: bounded retention source-frame bridge

Reviewed the current V48 worktree on `feat/knowledge-language-discourse` against frozen V47 commit
`1143fa5`. Scope was the internal retention-frame lookup, answer generation and verification wiring, shared
semantic prompt, unresolved-question grammar, tests, documentation, and trial plan. I made no source or test
edits and made no provider calls. All review examples are invented.

## Disposition

No blocking code finding remains after the fixes made during this review. The implementation is a coherent,
bounded version of the source-frame bridge proposed in the design review. It can proceed to the unchanged
local and frozen-provider gates. Local correctness does not establish that GPT-5.6 Luna will obey the added
meaning and excerpt-selection contracts; the exposed probe and independent source-only grading remain
required before V48 can be considered successful.

## Findings raised and resolved in this round

1. **The first support lookup admitted non-extraction receipts.** Checking only the marker/support selection
   allowed a row associated with a provided or migrated receipt to cross the automatic-extraction boundary.
   The helper now requires `retain_receipts.mode = 'extract_automatic'` and requires the support input hash to
   equal the receipt source hash. The mutation table now executes both provided-mode and source-hash negative
   cases.

2. **The first live-line check normalized away the byte distinction it was meant to establish.** Splitting on
   `/\r?\n/` and trimming both sides could accept a current file whose recalled payload bytes had changed.
   The helper now uses the same raw `split('\n')` representation as recall and requires the current payload to
   equal `line.text` exactly. It separately uses the projection's established normalization for the stored
   payload hash. Tests cover a valid CRLF file reindexed before recall and reject line-ending or trailing-space
   changes after recall.

3. **Two support-integrity mutations were initially defined but absent from the parameterized test list.**
   `provided-mode` and `source-hash` are now included, so those assertions execute rather than giving the
   appearance of coverage.

4. **The new English interrogative recognizer had an incomplete left word boundary.** Its `and` escape could
   match the suffix of words such as `stand` or `command`, causing a faithful unresolved-question clause to
   remain in deterministic predicate-denial analysis and be falsely rejected. The escape alternatives now
   have both leading and trailing word boundaries. A source-matched `stand` regression covers the old failure.

5. **A comma-spliced independent denial could be swallowed as part of the unresolved question.** That bypassed
   the deterministic predicate-denial floor, although the mandatory semantic verifier still received the full
   answer. A comma is now a hard English interrogative boundary, and a separate asserted exclusion after a
   comma is covered as a negative case.

## Binding and authority assessment

`retentionSourceFrames` does not trust a memory ID alone. It starts from a singleton qualified page line,
selects one current `managed_memory_entries` projection by memory ID, current slug, and payload line, and
requires that memory ID to be globally unique. It resolves the current indexed page path inside the real
knowledge-base root, reads the live file, checks exact recalled/current payload equality, verifies the current
marker and payload hashes, parses the immediately preceding marker, and requires one extracted support tuple.

That tuple is joined to exactly one active `retain_supports` row using memory ID, receipt fingerprint,
candidate fingerprint, proof group, and extracted selection. The joined receipt must be automatic extraction;
the support and receipt source hashes must agree; retracted, forgotten, or pruned evidence is excluded; and the
archived quote must be nonempty, at most 1,200 characters, and match its evidence hash. Any filesystem,
projection, marker, tuple, lifecycle, row-count, or hash failure returns no frame. It does not create an answer
degradation or availability result.

Ignoring the historical `retain_supports.slug` is correct. That value describes the placement at retain time
and is not rewritten when a managed item moves. The current projection, current page path, current slug and
line, and live bytes establish present placement. Both a changed historical support slug and an actual renamed
and reindexed page are positive cases.

There is no immutable rendered-payload snapshot in the support row itself. The current marker and payload
snapshot in `managed_memory_entries`, combined with live recalled/file equality, fills that role. The candidate
fingerprint cannot be reconstructed from rendered prose and is appropriately used only as part of the exact
live marker-to-support join.

The visible retained excerpt remains the answerable record. The frame is sent only as untrusted interpretive
context and may resolve a broad translated term to its narrower intended sense or preserve a shared epistemic
qualification. It cannot license a separate actor, action, value, or adjacent proposition found only in the
original frame. Generation receives that rule, and verification receives the same excerpt/frame pairing.

The conditional `excerpt_selection` verdict materially strengthens this boundary. When a block cites any
frame, the existing verifier call must first judge every answer proposition against the visible retained
excerpts alone. Its boolean and nullable detail have a cross-field refinement, and the block passes only when
selection is true as well as all three existing semantic dimensions. Missing, false, or inconsistent selection
withholds the block even if the original dimensions are all true. Blocks without frames retain their previous
wire schema. This remains a model judgment rather than a formal proof, which the documentation and trial plan
state accurately.

## Storage, portability, and lifecycle

The change adds no public protocol, Markdown marker, database table, or migration. It consumes the private
evidence archive already written for generated retention and returns an internal map keyed by opaque answer
evidence IDs. It does not attach the frame to public `AnswerContextItem` objects or citations.

Singleton support is a deliberate V48 boundary. Multiple supports may represent different proof contexts, so
the helper falls back to payload-only rather than selecting or merging one. Provided records, migration rows,
legacy rows without intact evidence, copied Markdown without receipt state, and state rebuilt without the
private archive also keep the old payload-only behavior. Active in-place state preserves the frame across
normal reindex and managed page moves. Retraction, forget, pruning, marker change, payload change, duplicate ID,
or missing state disables it. These differences affect optional model context, not memory eligibility or
public evidence status.

## Budgets, privacy, and call behavior

Each archived frame retains the existing 1,200-character limit. The helper admits at most 4,800 source-frame
characters across evidence in retrieval order and never clips a qualification to fill the remainder. Later
evidence can still use payload-only behavior after the budget is exhausted. The actual included frame text is
added to the existing approximate `evidence_tokens` metric.

No generation call, verification call, or semantic retry is added. The generation schema and public answer
schema are unchanged. The conditional verifier object adds one boolean and at most 240 characters inside an
existing per-block call; the existing verifier output ceiling remains ample for that bounded addition. Raw
character count and the approximate evidence-token estimate do not predict exact provider tokens after JSON
escaping and tokenization, so provider usage and availability must be measured by the frozen probe rather than
inferred from the local cap.

The configured answer provider now receives private original quotations that it did not previously receive.
That provider can differ from the retention provider. The documentation expressly states this privacy-boundary
change, the 1,200/4,800-character limits, the public exclusion, and the payload-only fallback. Request tests
confirm that frames reach generation and verification while remaining absent from answer JSON and citations.

## Grammar and semantic-prompt assessment

The declined-offer addition is narrowly scoped to one coreferent event: a named person's decline and a passive
restatement of the same offered action can describe the same rejection. It explicitly excludes an independent
unbooked collection, another person's offer, and another action. This belongs in the shared first-pass semantic
comparison because retention verification already has the complete source and candidate; it needs no storage
bridge.

The English `it remains unresolved whether ...` floor now stops at sentence, semicolon, comma, contrast, causal,
and conjunction boundaries. Tests cover valid bounded questions plus separate assertions after a period,
semicolon, comma, `but`, and `and`. The comma boundary is intentionally conservative and can reject a more
complex faithful interrogative containing internal commas; such a false hold affects usefulness rather than
admitting unsupported content, and semantic verification remains mandatory for every accepted block.

## Verification performed

- `pnpm exec vitest run packages/core/src/ops/answer.test.ts`: 340 tests passed.
- `git diff --check`: passed.
- The implementing agent separately reported the complete build and 2,193-test/133-file suite green after
  the reviewed fixes.

I did not duplicate the parent's full typecheck, lint, formatting, knip, build, package, smoke, repository-safety,
or full-suite runs. I made no live model or knowledge-base call. The trial plan correctly retains the original
thresholds: at least 90% useful answers per split/run, at least 80% useful retention/retrieval, zero accepted
source, qualification, language, promotion, or source-byte errors, and at most 5% availability failures. It
also preserves rejected semantics and forbids retries from converting them into accepted answers.

## Residual evaluation risks

The archive is a flattened candidate-level discourse frame. It has exact quote bytes but no retained span
array, `item_id` boundary, or per-span speaker/role boundary. The excerpt-selection verdict reduces adjacent
fact leakage but cannot prove it impossible. A source frame can also make the verifier stricter and increase
null answers. The added input and conditional structured field may affect latency, provider schema adherence,
and availability. Most importantly, local stubs prove wiring and rejection behavior, not whether the runtime
model preserves loose-insertion mechanism, shared absence-of-evidence scope, or same-event identity. Those are
the questions the exposed probe and independent source-only grader must answer without changing thresholds or
retrying rejected semantics.
