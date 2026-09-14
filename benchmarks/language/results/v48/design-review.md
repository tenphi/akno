# V48 source-frame constraint design review

Scope: frozen `1143fa5` (`feat/knowledge-language-discourse`), read-only review of retention,
managed-memory persistence/projection, and answer generation/verification. I made no source or test edits and
made no provider calls. All examples below use the repository's invented vocabulary.

## Disposition

The smallest coherent V48 mechanism is a bounded, internal **source-frame constraint bridge** for generated
managed memory. It should reuse the exact discourse frame that retention already validated and persists for an
active support. It should not introduce a new model-generated obligation array.

For an answer over one generated managed record, the existing answer generation call and existing per-block
verification call may receive one matched source frame. The visible retained payload remains the only cited
answer evidence. The source frame may restrict or disambiguate the payload's meaning; it must never license a
fact that is absent from the cited payload. This distinction is necessary because otherwise a public citation
to one Markdown line could appear to support detail available only in private SQLite state.

This mechanism directly addresses the exposed alternatives failure. The retained English payload still says
`improperly seated` and `unsupported`, while its exact Russian frame contains the narrower loose-insertion
mechanism and the shared statement that there is no evidence for either hypothesis. Supplying that frame as an
interpretive constraint gives generation and verification the missing lexical authority to reject generic
installation and mere nonconfirmation. It does not repair a retained sentence that already omitted the
corresponding proposition; retention verification remains responsible for that boundary.

The false declined-offer retention hold is a separate first-pass comparison problem. Retention verification
already receives the complete original source and the candidate. The shared semantic comparison should tell it
to resolve whether two clauses describe the same event before declaring an actor mismatch: an actor's explicit
declining of an offer and a passive restatement that the same offered shipment was rejected can be one
coreferent lifecycle event. This rule must not transfer an actor to a separate unspecified action. No storage
mechanism is needed for that correction.

## What authoritative context exists now

Automatic extraction in `packages/core/src/write/retain.ts` produces exact `support` spans and an exact
`discourse_frame`. The cleaner checks that every support span is covered by the frame, that every quote is an
exact source span, and that generated candidates pass independent semantic verification. The host-facing
provided-candidate schema also carries these spans, including structured-source `item_id` values.

At apply time, `packages/core/src/ops/retain.ts` stores
`candidate.discourse_frame.map(quote).join('\n…\n')` in `retain_supports.evidence`. Candidate validation caps this
flattened frame at 1,200 characters. The row also stores its evidence hash, full-input hash, receipt fingerprint,
candidate fingerprint, proof group, memory ID, selection, and active/retracted/forgotten state. A normal
automatic retain or remember receipt has mode `extract_automatic`.

The exact quote has a deliberate lifetime. `packages/core/src/write/retain-supports.ts` never age-prunes live
support. After exact retraction or forget, it may prune the quote only after the configured grace and after
nonterminal maintenance dependencies are gone. Page/document bindings and explicitly preserved source pages
can be reextractable, but answer should not perform reextraction or add a call.

`managed_item_sources` mirrors the earliest active support for the older dream verifier. It is not strong enough
to be answer authority by itself. It is keyed only by memory ID and retains source reference, origin, evidence,
and hashes. It drops the live marker's receipt/candidate/proof tuple and has no original payload snapshot.

The v2 Markdown marker in `packages/core/src/write/managed-memory.ts` carries up to eight support tuples:
receipt fingerprint, candidate fingerprint, proof group, and selection. It carries typed subject, attribution,
commitment, disposition, polarity, epistemic basis, relations, and time, but no source quote.

The rebuildable `managed_memory_entries` projection stores the current page/slug, marker and payload line
numbers, exact marker and payload hashes, and current payload text. `qualifyManagedMemoryLines` returns a
qualified memory only when the marker parses, the current marker and payload match those projected hashes, and
the memory ID is unique. This is the current-record snapshot needed to bind an answer-time lookup.

Answer currently discards the private frame. `buildEvidence` exposes only the generated payload line and public
typed qualification. Generation receives that excerpt. Verification receives the same excerpt plus selected
typed record fields. The verifier therefore compares one model's answer paraphrase with another model's
retained paraphrase, rather than with the exact source meaning that originally bounded it.

One limitation matters: the stored evidence is a flattened candidate-level frame. It does not retain the
original array positions, `item_id`, source-item role, or speaker boundary for each span. Typed attribution in
the marker preserves the accepted top-level semantics, but the quote is not a complete reconstruction of a
structured conversation. This is adequate for the current one-item exposed failure. It is not enough to claim
a general source-span obligation graph.

## Exact answer-time binding

Add a core-internal helper, naturally near `retain-supports.ts`, that accepts the current result slug, payload
line, qualified memory ID, and exact recalled payload text. It should return either one bounded frame or no
constraint. It must not throw an answer availability failure for absent legacy/private state.

The helper should:

1. Select exactly one `managed_memory_entries` row for current slug, memory ID, and payload line, joined to the
   current page path. Require the row's current payload to equal the recalled text after the same normalization
   used by the projection.
2. Read the current Markdown page and require byte-for-byte equality between the recalled line and the current
   file payload. Recheck the projected marker and payload hashes. This closes the race between recall assembly
   and answer model input.
3. Parse the immediately preceding marker, require its ID to equal the qualified memory ID, and require a
   singleton support tuple for V48. Multiple supports fall back to payload-only behavior rather than silently
   choosing or merging independent proof contexts.
4. Join that exact tuple to one active `retain_supports` row using memory ID, receipt fingerprint, candidate
   fingerprint, proof group, and selection. Require the receipt mode to be `extract_automatic`, and require
   `retracted_by`, `forgotten_by`, and `evidence_pruned_at` to be null.
5. Require a nonempty evidence value of at most 1,200 characters whose SHA-256 equals `evidence_hash`. Ambiguous
   joins, empty migrated evidence, malformed state, or any mismatch return no constraint.

Do not require `retain_supports.slug` to equal the current slug. That slug is receipt history. Managed-item
maintenance can move a block across pages, and no current code updates support rows on such a move. Current
location authority comes from `managed_memory_entries.source_slug`, the current page path, line numbers, and
the live file bytes.

The candidate fingerprint cannot be rederived from the rendered payload, and it does not need to be. Its role
is to join the exact tuple still present in the current managed marker to the accepted support row. The current
payload snapshot and file equality independently establish which record is now being answered. If somebody
edits a managed payload while leaving its support tuple, the old frame remains only a restriction: it can make
verification refuse divergent wording, but cannot add old source facts to the edited line.

## Internal answer wiring

Keep `AnswerContextItem`, `Line`, citations, socket/HTTP/MCP responses, and protocol schemas unchanged. Use an
internal wrapper or a map keyed by the opaque `E#` evidence ID. Never attach the frame as an enumerable extra
property to the public context object; relying on Zod stripping would make an accidental disclosure too easy.

In `buildEvidence`, after a qualified managed payload becomes its own evidence item, attempt the exact binding
above. Ordinary prose, documents, observations, provided/manual markers, migrated markers without valid exact
evidence, multiple-support memories, and unmatched state keep the current behavior.

In `answerMessages`, supply the matched frame in a separate model-input field such as
`source_frame_constraint`, adjacent to its evidence ID and visible retained excerpt. The answer prompt should
define it as follows:

- The cited retained payload selects the record and is the positive evidence boundary.
- The frame is exact context used only to preserve or disambiguate meaning already expressed in that payload.
- The answer may omit question-irrelevant detail, but may not broaden a material action, actor, event identity,
  degree, manner, mechanism, or shared epistemic qualifier expressed by the payload as resolved by the frame.
- The frame cannot support a new answer clause, cannot be cited, and cannot establish an omitted source fact.

In `verifyDraftBatch`, put the same constraint beside the corresponding cited excerpt. A frame also needs a
separate retained-excerpt selection judgment: before consulting the frame, the verifier must decide whether
every material answer proposition was selected by the visible retained excerpts. Require a boolean plus one
bounded nullable detail, with `true` valid only when the detail is null and `false` valid only when the detail
names unselected content. Require a positive, structurally consistent selection in addition to the current
three semantic booleans whenever a block cites a frame. Missing, negative, or inconsistent selection withholds
the block. This is an internal conditional verifier schema change inside the existing call; it is not a public
protocol change, another call, or a retry.

The selection judgment prevents an adjacent fact found only in a flattened source frame from becoming
answerable merely because the other semantic comparisons assess it against that frame. It remains a fallible
model judgment rather than proof of source isolation. A lost loose-insertion mechanism should make
`action_arguments_preserved=false` while an otherwise entailed general defect may keep
`proposition_supported=true`. Weakening explicit no-evidence-for-either into mere nonconfirmation should make
`qualification_scope_preserved=false`. The existing mismatch consistency check and no-retry behavior remain.

The retention verifier needs no source bridge because it already receives the complete source. A bounded
addition to `SEMANTIC_COMPARISON_CONTRACT` should cover coreferent event identity before actor comparison, as
described above. Prompt versions must advance wherever prompt text changes.

## Budgets and privacy

One frame is at most 1,200 characters, but answer recall can return several cards and several managed lines per
card. Source frames therefore need their own deterministic total input cap; the per-frame limit alone is not a
batch limit. An initial ceiling of 4,800 characters keeps the worst case to four maximum-sized frames and
keeps selection independent of model output. Select complete frames in existing evidence order and never clip
one to fill the remainder. Evidence beyond the cap uses the current payload-only path.

Count the actual constraint text in `budget_used.evidence_tokens`. Do not increase output-token ceilings: the
generation and semantic-verdict schemas are unchanged. Verification is already per block and a block cites at
most eight evidence IDs, so the same ceiling bounds one first-pass verifier request. Measure latency,
availability, and token deltas in the exposed probe and full gate rather than assuming the added input is free.

Sending the frame to the answer model is a real privacy-boundary change. Today the derive model and dream
source verifier can receive that exact private quote; the answer model normally receives only the retained
payload. Configurations may use different endpoints for those roles. The change must be documented as bounded
private source context sent to the configured answer provider. The 1,200-character per-frame and deterministic
batch limits reduce disclosure, and public results must still omit it, but they do not make the provider
exposure disappear.

Portable Markdown cannot carry this private frame. A copied brain or rebuilt state that lacks matching receipt
rows must continue to answer from the readable payload and typed marker exactly as it does now. The bridge is
an optional strengthening, never a new eligibility requirement, degradation reason, deterministic rejection
floor, or source of public answer facts. Normal live generated support retains its quote indefinitely, so the
fallback is primarily for manual, legacy, migrated, copied, or lost state. This explicitly resolves rather
than hides the rebuild variance.

## Why not a new obligation array

A free-form obligation array produced by extraction is another model paraphrase. Source span membership can
prove that quoted bytes exist, but it cannot prove that the model found every material obligation, assigned the
right actor or event, or tagged degree and epistemic scope correctly. The current exposed failure occurred even
though the verifier already had four required comparison fields and explicit prompt rules for those concepts.
Adding an array without a completeness authority can create a more convincing audit trail while preserving the
same omission.

A genuine position-bound obligation protocol would require:

- preserving each exact span object, including `item_id` and source-item speaker/role boundaries;
- a bounded typed vocabulary for event identity, actor/argument role, degree/manner/mechanism, and epistemic
  subject/scope;
- hard one-to-one verifier coverage and rejection of omitted or duplicated obligation IDs;
- persistence per active support, lifecycle/pruning rules, migration and copy/rebuild behavior;
- answer-side checks that distinguish a question-relevant material obligation from incidental frame context.

That is a new durable semantic layer, not a small schema field. Current evidence does not establish that its
additional model output would outperform the exact-frame constraint, and the 320-character comparison fields
already show that structured output alone is not a guarantee. Defer it unless a fresh source-frame run shows a
repeatable failure that the exact frame contains but the existing verifier still ignores.

## Meaningful tests

Local tests can prove binding and non-disclosure, but cannot prove cross-language semantic judgment with stubbed
verdicts.

Binding tests should cover a singleton active `extract_automatic` support; exact tuple, evidence hash, current
marker hash, current payload hash, current slug/line, and recalled/current byte equality; and successful lookup
after a managed cross-page move despite the historical support slug. Negative cases should cover multiple
supports, provided and migration modes, retracted/forgotten/pruned support, hash corruption, absent receipt,
copied tuple under a different memory ID, duplicate IDs, stale projection, changed current bytes, and a race
between recall and lookup. Every negative case falls back without a model availability error.

Answer request tests should assert that generation and verification receive the same internal constraint for a
matched generated record; that no constraint appears in `AnswerOutput.context`, citations, rendered answer,
logs, notes, or protocol serialization; that ordinary prose/document/observation requests are byte-for-byte
unchanged; that constraint selection is rank ordered and capped; and that `evidence_tokens` counts the added
input. Verifier tests should require the conditional excerpt-selection object and reject missing, false, and
boolean/detail-inconsistent selections even when all three original semantic dimensions are true. Existing
model request count assertions must remain unchanged.

Lifecycle integration should retain an invented generated record, reindex and reopen it, verify the constraint
is still available, move the managed block and verify it remains bound, then retract/forget and verify it is no
longer usable. A database rebuilt from portable Markdown without receipts should exercise the payload-only
fallback. Read-only answer should be able to consume a valid frame without writes.

The focused semantic regression should use invented text with a loosely inserted Zephyr QX-100 connector, a
second faulty component hypothesis, explicit no evidence for either, and Ada Marlow selecting neither cause.
Model-request assertions should prove that all of those source bytes reach both existing calls as constraints.
A stub can prove rejection plumbing for an all-true/all-false verdict; only a fresh frozen-provider probe plus
independent source-only grading can establish that the model actually preserves the mechanism and shared
qualification. The unchanged per-split/run usefulness, zero-error, and availability gates remain the decision
boundary.

## Residual limits

The source-frame bridge is stronger evidence input, not a proof system. The model may still ignore a material
phrase, overconstrain on adjacent context, or falsely reject a faithful translation. It does not solve source
materiality that extraction omitted from the retained payload, arbitrary languages, multiple independent
support contexts, or structured multi-item span boundaries erased by the current flattened archive. These are
reasons to preserve V47 as failed evidence and rerun the unchanged gates after V48, not reasons to weaken a
rejected verdict, retry semantics, or lower thresholds.
