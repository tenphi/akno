# V43 bounded scope audit for issues #61 and #62

Scope: read-only regression audit of the V40–V43 call-site changes against the prior clean ordinary-prose closure audit. I inspected language-policy selection/checking, retention, answers, ownership, and the public language/discourse documentation. I did not rerun the full suite, make live calls, inspect current probes, or re-audit the entire repository.

## Disposition

No concrete uncovered acceptance work found in the reviewed scope.

## Ordinary Markdown qualification boundary (#62)

The V40–V43 changes do not alter ordinary-Markdown projection, fact derivation, graph eligibility, live-byte validation, recall partitioning, observation evidence, or the conservative whole-page curation hold described in the V39 closure audit.

Recent answer and retention prompt/guard changes operate after evidence has already carried its managed or ordinary-prose qualification. Answer semantic verification still receives cited evidence and requires proposition, action-argument, and qualification-scope agreement. The V43 specificity contract uses the supplied source/cited evidence as authority and adds no eligibility path. Retention still verifies generated candidates against the complete original source. Dynamic ownership selection changes only the representability of supplied destinations; it neither qualifies prose nor supplies semantic evidence.

The new retention `languageReferences` are derived only from immutable structured-source speakers and identifier-shaped source tokens. They are filtered to references actually present in generated excerpts, are sent as untrusted spelling hints, and do not mask surrounding prose or override the language verdict. This does not turn ordinary nonfactual prose into factual evidence or bypass source/qualification verification.

No recent change reaches source bytes through indexing or reading. The prior byte-authority, stale-projection degradation, and conservative curation findings therefore remain intact.

## Generated language surfaces (#61)

The shared client still prepends the configured language instruction and checks all generic generated prose fields selected by `generatedProse`. Its covered fields include retained/answer text and subjects, summaries, observation/reflection prose, curation bodies/bridges/titles, history `line`, managed-memory `replacement`, descriptions, attributes, values, and keywords. Evidence/source/quotation structures remain excluded as exact authority rather than generated prose.

Curator revision selection remains additive: copied original lines are exempt through the byte-exact multiset, while changed/new lines are added to the generic language check. Invalid selectors and failed checks return typed failure before sealing or writing. V40–V43 did not change this boundary. Exact caller-provided retention remains model-free and still requires the configured English attestation; replay preserves the original recorded policy and outcome.

Recent localized presentation labels affect answer-generation input only. Original qualification enums remain in verifier and public evidence. The new answer/retention source references permit exact names, titles, and identifiers while keeping generic role labels translatable. None of these changes suppresses generic prose-field selection or introduces a new write surface outside `ModelClient.chat` language enforcement.

## Documentation contract

The documentation matches the implemented public policy:

- `knowledge_language` supports the explicit English target (`"en"`) or `null`; `null` preserves legacy generation behavior.
- Answers independently support explicit English or Russian output. Without an answer override they inherit configured English, and with both policies unset they retain legacy behavior.
- English/Russian refers to the bounded source/discourse recognition and answer matrix, not arbitrary-language support or a Russian durable-knowledge target.
- Exact authored pages, source quotations, names, identifiers, code, paths, and existing references remain unchanged; generated explanatory prose is checked separately.
- The docs accurately state that language checking is fallible and does not establish truth or translation entailment.

One protocol detail remains intentionally broader than configuration: caller retention input can declare `en` or `ru`, while the durable configured policy and receipt expose only `en|null`. Under configured English, a Russian declaration is rejected as a mismatch; with policy unset, legacy exact retention remains available. The docs describe the user-visible configured behavior accurately and do not promise Russian generated knowledge.

## Finite scope

This clean finding inherits the prior audit's finite limit: ordinary qualification is a bounded English/Russian deterministic projection, and model language/semantic checks remain fallible. It does not establish arbitrary-language coverage, implicit discourse understanding, or live-model quality. I found no V40–V43 regression that turns those documented limits into an acceptance gap.
