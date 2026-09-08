# V48 independent code review

Reviewed the current V48 working tree, including `retention-source-frame.ts`, answer generation/verification wiring, question normalization, semantic-contract changes, retention verifier version, tests, documentation and trial plan. I did not edit runtime code, run live models, or reuse prior output judgments.

## Actionable finding

### High: “the retained excerpt selects answerable content” is prompt-only and is not represented in the verifier verdict

The new frame is sent to answer generation beside each evidence excerpt and then to verification inside each `cited_evidence` object. The only enforced semantic result remains the existing conjunction:

- `proposition_supported`
- `action_arguments_preserved`
- `qualification_scope_preserved`

There is no separately parsed/enforced judgment that every proposition in the answer was selected by the retained excerpt alone. In the verifier payload, `excerpt` and `retention_source_frame` are both nested under the cited evidence. A verifier can therefore treat a fact found only in the frame as support and return all three booleans true, despite the prompt saying the frame “cannot supply additional answerable facts.” Generation can likewise copy such a fact because it receives the full frame.

Concrete bounded counterexample: a retained excerpt says only that Ada declined an offer, while its archived frame also says that no handover was booked. A generated answer citing that one retained excerpt can add “no handover was booked.” All words are source-true, and the current verifier may reasonably call the proposition source-supported because the frame is presented as source context, but the visible retained record did not select the booking proposition. This changes recall/citation semantics and can expose an adjacent original-source detail that was never admitted as the cited memory item.

The tests at `packages/core/src/ops/answer.test.ts` prove transport, hash/lifecycle fallback, privacy of the returned payload and that a scripted negative verdict still withholds a block. They do not prove the claimed answerability boundary: the test verdict is supplied by the stub, and there is no schema/code invariant capable of rejecting an all-true verdict for frame-only content. The documentation and V48 plan therefore overstate “cannot supply additional answerable facts” as an implemented guarantee.

Minimal robust correction: keep one verifier call and no retry, but make excerpt selection an explicit required verdict field, for example `selected_by_retained_excerpt`, evaluated without treating the frame as proposition evidence. Accept a block only when that field and the existing three dimensions are true. The frame can then constrain referent, role, modifier and qualification interpretation for the already selected proposition. Missing/contradictory fields must fail structured parsing as the existing dimensions do. Add a regression where the frame contains a source-true adjacent fact absent from the excerpt and an all-true legacy-style verdict cannot admit it. Alternatively, derive and persist source-verified interpretation obligations at retention time and send only those obligations instead of the raw frame; that is broader.

If the additional enforced dimension is intentionally deferred, documentation and the trial plan should say this is a model-instructed boundary rather than claiming the frame cannot authorize content.

## Other reviewed boundaries

I found no separate actionable defect in the provenance lookup itself:

- It requires one current indexed projection for the memory id, exact current slug/line, live marker and payload bytes matching indexed hashes, matching marker id, exactly one extracted support binding, and an exact receipt/candidate/proof tuple.
- Retracted, forgotten and pruned support is excluded. Missing, empty, oversized, hash-mismatched, provided, multi-support, duplicate-id and stale marker/payload paths fall back to retained text.
- A support's historical slug is not used as current placement authority, so changing that archived slug does not break a valid moved live item. Current page containment is checked with `realpath`.
- Complete frames are bounded to 1,200 characters each and 4,800 total in retrieval order; frames are skipped rather than clipped. Later smaller frames may still fit. The cap is reflected in evidence-token accounting.
- Verification receives only the frames attached to that block's cited evidence ids. Public context, citations and `AnswerOutput` do not include frames. The generation call receives all retrieved evidence and frames, as it already receives all retrieved excerpts; final per-block acceptance remains citation-scoped, subject to the finding above.
- Retraction/forget/pruning and absent archive behavior fail back to the existing payload-only path rather than making answers unavailable.

The English `questionAssertionText` addition is clause/sentence bounded and retains explicit stops for contrasts and conjunctions. It removes only a typed unresolved-question construction before the existing predicate-denial floor; the unmodified draft still proceeds through mandatory semantic verification. I found no escape that creates an acceptance bypass in the reviewed forms.

Versioning is consistent with the shared semantic-contract change: answer versions advance in the current diff and retention verifier advances while extraction remains unchanged. No new model call, semantic retry, provider/model, public evidence schema, threshold or gate change is introduced by the implementation as written.
