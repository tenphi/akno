# V77 conditional full-trial harness review, final corrected round

Status: **CLEAN for harness design and preparation.** This is not the separately required final preflight or launch approval; the launch manifest and preflight approval do not yet exist.

Scope: static re-review of the corrected full-only capture and mocked controls, launch integrity, start/split runners, trace and postrun validation, source-review preparation, gate arithmetic, terminal-measurement decision, failed-diagnostic provenance and amended full plan. I did not call a provider or benchmark, change runtime or harness files, grade V77 outputs, or read/display V22 held-out prose. I inspected V22 only through its fingerprint, IDs, split/admission/query shape and reviewer attestations.

The original review is preserved in `tmp/language-v77-full-harness-review-initial.md`. My intermediate review incorrectly inferred that every null operation was expansion and is preserved in `tmp/language-v77-full-harness-review-before-placement-correction.md`. The actual frozen call graph also uses a Luna heading-placement call; the final correction gives placement its own operation instead of applying that invalid inference.

## Final correction recheck

`tmp/capture-language-full-v77.mjs` now recognizes six Luna operations: placement, ownership, retention, answer, answer verifier and retention verifier. It separately recognizes the exact lookup/question/explore prompts used by `expandQuery`. It appends `model-call-start` before policy enforcement, then requires either a known operation or expansion, requires Luna for every named operation and Llama for expansion, and records a balanced throw lifecycle on policy or transport failure.

`tmp/v77-full-trace-integrity.mjs` applies the matching closed policy: `operation:null` requires `llama-3.2-3b-instruct`; each of the six named operations requires `gpt-5.6-luna`. A successful named operation requires its operation-specific result record before its terminal record. Every call and transport requires exactly one bounded terminal.

The zero-egress control now calls the real `expandQuery` entry in all three modes and the real `placeManagedItems` entry with an invented, structurally valid managed marker, in addition to the other five semantic operations. It proves:

- nine valid calls and nine transports form a balanced accepted trace;
- placement is classified separately on Luna;
- the three expansion modes are null operations on Llama;
- wrong semantic and expansion models, an undeclared model, and an unknown Luna operation fail before the stub transport;
- a null-operation/Luna mutation is rejected by trace validation;
- an expansion transport exception preserves identity and yields start/transport-start/transport-throw/model-call-throw; and
- language transport accepts exactly the 1,024-token caller ceiling and rejects 1,023.

`tmp/v77-full-capture-controls.json` records `providerCalls:0`, the corrected capture/validator hashes, the nine-call accepted lifecycle and all controls above. Its `stubCalls:10` is consistent with nine successful calls plus the deliberately thrown expansion transport. No unclassified provider path remains in the declared frozen call graph.

## Original findings resolved

- **Global Luna assertion:** resolved by role-specific enforcement inside the recorded lifecycle. The failed exposed diagnostics remain preserved as infrastructure failures rather than replacement semantic runs.
- **Incomplete role binding:** resolved. Launch integrity compares derive, answer, embedding and expansion IDs with the hash-bound selected report; fixes derive/answer to enabled Luna at 2,400 tokens, expansion to Llama and embedding to Qwen; and checks the report's `{answer:2400, retention:2400}` ceilings.
- **Unenforced language ceiling:** resolved by the exact 1,024 check on every language transport start and a positive/negative validator control.
- **Partial input-review checks:** resolved. Launch integrity verifies `language-input-review-v1`, exact reviewer kind/ID and all independence, authorship, tuning and no-output attestations, plus the exact 22 approved IDs and corpus fingerprint.
- **Partial postrun provenance:** resolved. The postvalidator rehashes every manifest file and the separately bound input review, deep-compares split receipts with the manifest, checks parseable timestamps ordered after the global start, and validates exact split/run/case/coordinate matrices and trace lifecycles.

## Completion-gate arithmetic

The new review and gate path is coherent and keeps one source-only judgment authoritative:

1. `tmp/prepare-v77-full-review.mjs` calls production `languageReviewPacket` over the two final reports and writes one exclusive packet.
2. The independent grading contract requires all 44 case/run entries and all eight coordinates, source entailment, language, qualification, promotion, retention and retrieval judgments. Null writable answers cannot count as useful; read-only holds remain separate.
3. `tmp/adjudicate-v77-full.mjs` calls production `adjudicateLanguageGate` once with that review. It saves the unmodified original result, then passes that same result to `completionGate`; there is no second grade or alternate observation set.
4. `tmp/v77-completion-gate.mjs` asserts the official v2 independently reviewed gate, the historical 0.9 answer threshold, the predeclared 0.8 completion threshold, exact equality of all other thresholds and exact four development/held-out run groups. It requires denominators 10 retention, 40 retrieval and 80 answers per group.
5. It removes only the official per-group `:usefulQualifiedAnswerCoverage` failures and recomputes those at 64/80. All other official failures, including stale/unknown failures, pass through unchanged. A group at 63 fails; 64 passes; high results in other cells cannot pool away a failing cell.

The 16 synthetic controls exercise the 63/64 boundary, every non-answer failure class, a pooled-rescue attempt, altered non-answer threshold and wrong denominator. The completion artifact deliberately uses `releaseEligible` for the revised completion result while preserving `originalGatePassed` and a separate original-gate artifact. That distinction is explicit rather than overwriting the historical 90% decision.

The original and revised gates therefore use the same four independently graded cells. Both retain 80% complete useful retention, 80% useful retrieval, zero accepted source/qualification/language/promotion/source-byte errors and at most 5% availability failures. With eleven cases in a split/run, the last condition permits zero failed cases.

## Harness and provenance properties

- `tmp/start-v77-full.mjs` invokes the no-write integrity check before the one global marker and refuses any existing marker, split receipt, report or trace. Each split runner repeats integrity before its receipt and benchmark invocation.
- The runners select complete V22 development and held-out splits, two runs each, with no case filter: 320 writable and 32 read-only coordinates. V21 held-out is not a fallback.
- Frozen revision, clean tracked tree, source/dist digests, build/restart/socket receipt, 3,910 tests/152 files, 23 compiled groups, exact CI/docs conclusions and ten protocol controls/16 endpoints are checked before launch. These are readiness and compatibility evidence, not semantic evidence.
- The final postvalidator requires both reports, exact selected case IDs/admissions, unique case/run keys, all eight coordinate combinations, both trace lifecycles, unchanged source/runtime/report metadata and the full manifest/input-review hashes.
- The failed diagnostic provenance accurately states 96 planned but zero observed answer coordinates, twelve case failures, unknown retention/source-byte outcomes and no positive semantic-readiness evidence. The decision forbids replacement diagnostic runs.
- The terminal decision authorizes one newly named full V22 measurement only after two independent harness reviews and a separately hash-bound preflight. It preserves the original 90% result, reports the 80% completion result separately, forbids post-measurement tuning or further target reduction, and leaves PR70 open/unmerged with no issue edits.

## Practical limits

- The finite prompt classifier is intentionally tied to the frozen call graph. A future prompt change must regenerate the no-egress controls, hashes and review rather than silently pass.
- Runtime/private verifier fields cannot establish source faithfulness or usefulness. The structural validator correctly limits itself to provenance and matrix completeness; the source-only grade supplies those judgments afterward.
- Protocol and mocked-call controls establish schema, role, lifecycle and transport compatibility only. The terminal full result remains the first semantic evidence for V22 and must be published whether it passes or fails.
- This review does not authorize provider calls. A fresh manifest must bind the final corrected hashes, and the required separate preflight must verify it before launch.

## Disposition

No remaining code or policy blocker was found in the corrected conditional full harness. The placement correction closes the last unclassified-call ambiguity without rejecting a legitimate runtime call, and the completion arithmetic changes only the predeclared answer-usefulness threshold while preserving every other official judgment and failure.

Proceed only to manifest generation and the separately required hash-bound preflight. The selected64 plus built32 diagnostics must remain preserved infrastructure failures; the later full V22 development/held-out measurement is a new terminal measurement, never their replacement.
