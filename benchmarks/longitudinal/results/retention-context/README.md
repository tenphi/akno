# Standalone retention context

Akno #214 separates lasting source knowledge from interaction management and checks that readable
retained text preserves material participants and their roles without relying on a page title or
speaker metadata. Coherent page prose and removal of per-item lineage fences remain #79.

All inputs and returned text here are invented. The exact ten-case corpus is in [cases.json](cases.json).
These are exposed development controls reviewed by the source author, not independent evaluation or a
population accuracy estimate. Native extraction and scripted extraction with live verification are
reported separately. Scripted generation is not a real model call; a subsequent structural repair is.

The frozen baseline ran against 0.18.10. It already omitted simple task corrections in both languages
and both repetitions. The historical motivating complaint does not prove that the current extractor
still routinely admits such complaints. The baseline returned all eight native useful records, but
both addressed reports omitted the established booking holder while preserving the report recipient:
only six of eight native useful returns preserved material context. Unidentified-recipient controls
could undergo structural repair before verification, explicitly retaining that uncertainty. Their
acceptance is not admission of the original naked second-person proposal.

Review/fix rounds found missing admission reason codes in the verifier schema, legitimate admission
holds being confused with semantic inconsistency, booking-holder and warranty-owner omissions,
grammatical subject being confused with semantic experiencer, and redundant name labels rejecting
faithful short-name references. The final check binds names to the same readable record and exact
owned source frames, preserves semantic roles across paraphrase, and distinguishes substantive reports
with explicit unknown participants from conversational fragments. Positive generic support cannot
override the independent purpose/context decision. Exact witness validation still fails closed.

[baseline.json](baseline.json) and [results.json](results.json) each contain one complete frozen cohort:
ten cases with two repetitions, no replaced coordinates or pooled debugging results. Every actual
returned record was checked against the original source, separately from model verdict agreement.
The final prepublication cohort omitted all four native task-only coordinates, returned seven of eight
native useful records with their material context preserved, and withheld the remaining preference
because an existing temporal audit put a timing phrase outside its own exact excerpt. That unavailable
verdict is a utility limit, not successful retention or a context rejection. Both task-quote and
invented-preference negative controls were held in both repetitions; both contextless-report controls
were held. The unidentified-recipient control was held once and returned a qualified, explicitly
unidentified report once after structural repair. No returned final record lost material participant
context. These observations do not establish universal rejection or full lifecycle coverage.

Only `gpt-6-luna` made live language-model calls, with the installed derivation ceiling of 16,384 output
tokens and 300 seconds. Reasoning effort was unspecified; no alternate model was substituted. The
verifier allowance increased to cover the added structured reference audit while remaining clamped to
that installed ceiling, with no new verification call or semantic retry. Baseline usage is 30 actual
logical calls, 30 endpoint requests and 295,915 reported tokens; final prepublication usage is 30
logical calls, 31 endpoint requests and 342,730 reported tokens. Each cohort has eight separately counted
scripted extraction calls. All outcomes reported token usage and request counts; missing usage would
remain unknown rather than zero. Cached and reasoning token subsets are recorded per outcome and are
not added again to totals. These totals exclude prior review/fix cohorts and later released checks.

The final local gate passes build, lint, dead-code checks, 4,879 tests, model-free and installed-package
smokes, documentation checks/build, formatting and repository safety. Deterministic tests cover
independent admission, exact witness and frame ownership, participant roles, positive verdict bypass,
malformed/foreign replies, strict endpoint schemas and preservation of eligible siblings. Existing
source, provided-exact, receipt, replay, support and undo behavior remains covered by the complete
suite. Publication, adoption and a fresh released repeated cohort are verified separately before #214
closes; those receipts must not be pooled with prepublication results.
