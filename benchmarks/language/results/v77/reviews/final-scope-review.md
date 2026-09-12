# V77 final product-scope review

Scope: read-only review of GitHub issues #61 and #62, PR #70, the current frozen implementation and documentation, and `tmp/language-v77-top-level-review.md`. The terminal V22 run was active during this review. I did not read V22 source prose, reports, outputs or traces, call a provider, change runtime or any manifest-bound artifact, edit GitHub, or infer its result.

## Main conclusion

PR #70 contains two substantial implemented product changes independent of the terminal benchmark result:

1. an explicit English generated-knowledge policy separated from source language and requested answer language; and
2. a deterministic, byte-bound first-scope discourse projection for ordinary Markdown that prevents recognized nonfactual passages from entering factual derivation and answers without their qualification.

Those are valid implementation claims. What remains unproven until the terminal result is independently graded is the **reliability of automatic model-generated retention, translation, retrieval and answers** across the declared English/Russian corpus. The PR should keep this distinction explicit. Passing the predeclared 80% completion target supports a bounded experimental usefulness claim; it does not turn finite guards or model verdicts into a universal semantic guarantee. Failing it leaves reliability acceptance unmet while the underlying policy and Markdown-boundary implementation remain reviewable work.

## Issue #61: delivered language-policy behavior

The core requested separation exists:

- `ConfigDoc` accepts only `knowledge_language: "en" | null`; resolved configuration carries `knowledgeLanguage`, and `null` preserves the legacy default. The implementation does not infer it from source text, query language, locale or provider output.
- The resolved policy is injected into generative model roles. `ModelClient.chat` prepends the language instruction, selects all generated prose fields plus schema-specific prose, and performs the separate bounded language audit. A mismatch becomes `language_mismatch`; an invalid, unavailable or oversized audit becomes `language_check_failed` rather than exposing fallback prose.
- `answer.answer_language` independently supports English or Russian. When absent, answer generation uses the configured knowledge language; `context.knowledge_language` exposes the effective policy to hosts.
- Generated retention prose, semantic labels, summaries, observations/reflections, maintenance revisions and generated titles use the shared language boundary or a schema-specific prose selector. Exact source extraction/transcription remains in its original language.
- Original support and discourse-frame quotations remain exact source bytes. Names, identifiers, code, paths, existing page identities, headings and folder taxonomy are treated as protected content rather than material to translate mechanically.
- Caller-provided exact retention remains model-free and byte-exact. Under the English policy the caller must attest `retention.knowledge_language: "en"`; missing or conflicting attestation fails without a write. The attestation is language responsibility, not semantic verification.
- Retain receipts bind the knowledge language. Replay of an existing source revision returns its recorded policy/outcome before current configuration can reinterpret it. Changing the setting does not translate existing pages or trigger bulk work.
- Generated candidate and answer paths retain source ownership, qualification, polarity, actor/action/property/time comparison, requested-language checking and typed failure handling. One bounded structural repair is allowed where declared; semantic rejection is not retried.

This supports the product claim that Akno **implements an owner-controlled English knowledge-language boundary and an independent English/Russian answer-language request**. It also supports the claim that the system fails closed on detected language or semantic-verification failure.

It does not support these broader claims without empirical qualification:

- that every Russian or mixed source will be translated completely and correctly;
- that all supported non-English queries will retrieve the right evidence;
- that the model language audit is proof of language or meaning;
- that every name, action role, technical property, source clock or discourse relation will survive free generation; or
- that any knowledge language other than English is supported for stored generated prose.

The implementation includes many guards and a mandatory semantic verifier, but both generation and verification remain fallible. Exact-copy/complete-record rendering covers only a bounded eligible one-record path; longer, multi-record, reference-bearing and unresolved-language cases use ordinary composition. The trial's 2,400-token answer/retention ceiling also does not establish behavior for the existing service answer overlay at 1,024 tokens.

## Issue #62: delivered ordinary-Markdown boundary

The first-scope Markdown qualification described by the issue is implemented as a deterministic projection rather than a model-authored rewrite:

- `proseQualifications` reads the complete current file and binds each projection to the complete source hash. It recognizes bounded English/Russian conditional, hypothetical, tentative, report, rejection, plan and question forms; ATX and setext heading scope; nested/sibling headings; block quotations; role and named-speaker turns; fenced examples; source fences; and one explicit following qualification across a paragraph break.
- Each ordinary line carries a typed `ProseQualification`: view, status, reason, `answer_eligible`, exact file hash and bounded original-language frame. It creates neither a managed marker nor retained authorship.
- Frames over twelve lines or 2,400 characters become `unresolved` and remain inspectable. They do not regain factual eligibility through truncation, including in the `all` answer view. Reads/recall expose typed `prose_discourse_unresolved` or partial-index degradation where applicable.
- `derivePage` sends only fact-eligible lines to fact extraction and suppresses page summaries when the page contains nonfactual ordinary prose. Graph projection consumes current eligible facts, so disqualified ordinary statements cannot become current factual graph edges.
- Recall, context and answer selection consult the projection and memory view. Recognized reports, scenarios, tentative passages, plans, questions and rejected text remain available through qualified inspection views while being excluded from ordinary factual answers.
- Curation, split, merge and synthesis paths conservatively hold whole pages containing nonfactual prose where they cannot preserve passage qualification; observe and reflection consume the eligible graph rather than bypassing it.
- Index rebuild and reads recompute qualification from current bytes. Editing a heading or neighboring qualifier changes the source hash/projection; stale qualification is not authoritative. Default indexing and rebuild do not alter Markdown bytes or the file set.
- Ordinary asserted notes remain fact eligible, so the feature does not globally distrust unmarked prose.

This supports the product claim that Akno **preserves a bounded set of discourse boundaries for ordinary Markdown through indexing, retrieval, answers and maintenance without rewriting the file**.

The boundary is deliberately finite. It does not understand arbitrary implicit discourse, every language, every speaker convention, unrestricted anaphora or all long-distance qualification. Unsupported implicit forms can still be misclassified as factual, while conservative syntax and whole-page maintenance holds can reduce usefulness. The scanner's qualification says how text is expressed; it is not a truth certificate. These limitations should remain prominent because issue #62 asks for preservation of meaning, while the delivered mechanism can promise that only for its documented grammar.

## Evaluation and evidence claims

The implementation has strong deterministic and provenance evidence independent of the terminal semantic result:

- 3,910 tests in 152 files and the repository's build, typecheck, lint, formatting, dependency, docs, smoke, package and safety gates passed on the frozen revision.
- Exact-revision main and docs CI passed; source and built runtime trees were hash-bound and deployed.
- Twenty-three compiled controls exercise built-package boundaries.
- Ten provider controls over sixteen endpoints establish current strict-schema and transport compatibility.
- Versioned invented corpora, input review, source-only output review, per-cell metrics, exact run provenance and source-byte checks implement the evaluation framework requested by #61 and #62.

These facts establish implementation integrity and measurement readiness. They do not establish live semantic competence. Stubbed semantic verdicts prove gating behavior, and provider echoes prove schema transport; neither proves that Luna will choose a faithful candidate or correctly judge one.

Historical exposed evidence shows why the distinction matters. The system has often failed safely by withholding writable answers, but earlier revisions also published mechanism, role, polarity or language errors. Later exposed runs improved safety while usefulness remained volatile. The selected64 and built32 V77 diagnostics add no semantic evidence because their external capture rejected the configured expansion role before all 96 planned answer coordinates; their retention and source-byte outcomes are unknown. They remain infrastructure failures, not safe abstentions or failed semantic cases.

The active terminal V22 measurement is therefore the only authorized evidence for the final completion decision. The same independent source-only judgments must feed:

- the historical 90% useful-answer gate; and
- the separately predeclared 80% useful-answer completion target.

Both apply independently to each development/held-out run and keep 80% useful retention/retrieval, zero accepted source, qualification, requested-language, unsafe-promotion, unsupported-output and source-byte errors, and at most 5% case availability failure. Cells cannot be pooled, writable nulls are not useful, and the read-only case remains a separate justified-hold control. The 80% target changes the bounded PR completion decision only; it must not be described as passing the historical 90% gate.

## Honest final PR disposition

The PR title and leading product description are supportable if they continue to say **bounded** discourse qualification and an explicit English knowledge-language policy. Avoid wording such as “guarantees faithful multilingual retention,” “solves cross-language reliability,” or “preserves all Markdown discourse.”

After the terminal result:

- **If every 80% completion cell and every unchanged safety/availability gate passes:** describe the PR as meeting the predeclared bounded completion target on the finite V22 English/Russian matrix. Report the 90% result independently. State the finite-grammar, fallible-verifier, model/corpus and 2,400-versus-1,024 limitations.
- **If any safety, qualification, language, source-byte or availability gate fails:** state that reliability acceptance is unmet. Do not let high usefulness offset it.
- **If safety is clean but any usefulness/retention/retrieval cell misses 80%:** state that the conservative implementation remains incomplete for automatic reliability at the declared completion target. Safe abstention is still a coverage loss for writable source-answerable cases.
- **If the original 90% passes but the separate 80% result somehow reports failure:** treat that as an arithmetic/provenance inconsistency, not a semantic outcome.

In all cases, preserve the terminal artifacts and disagreements, make no post-held-out tuning or threshold change, and finish the requested PR work by publishing the measured disposition and remaining limits. PR #70 must remain open and unmerged, and issues #61/#62 must remain unedited and open. “Addresses #61 and #62” is appropriate; closing either issue would require a separate project decision after reviewing whether its acceptance criteria are satisfied.

## Remaining bounded product limitations

1. **Automatic usefulness:** one lost central retained record can remove all eight query/answer coordinates for a case. This multiplicative behavior is architectural and is not cured by another local phrase rule.
2. **Finite local grammars:** report, counterfactual, clock, actor, denial and property floors can reject faithful new wording or miss unsupported wording. Mandatory full-source verification reduces risk but does not prove correctness.
3. **Model-dependent language and entailment:** the same model family can generate and misjudge a paraphrase. Independent source-only review remains evaluation authority.
4. **Bounded complete-record rendering:** it improves preservation only for short, eligible, single-record evidence and can trade focused brevity for full-record disclosure. Other evidence shapes use legacy composition.
5. **Ordinary Markdown scope:** deterministic English/Russian surface grammar cannot cover implicit pragmatics or all discourse. Oversized/ambiguous passages and pages with mixed nonfactual prose are handled conservatively, reducing synthesis and maintenance coverage.
6. **Target-language scope:** generated knowledge is evaluated only for English. Russian is an answer language and source/query language, not a supported stored-knowledge target.
7. **Evaluation scope:** finite invented cases and repeated model judgments do not establish universal multilingual, longitudinal or real-vault reliability. V22 is terminal evidence for this PR, not a general benchmark certificate.

## Final assessment

The language-policy and ordinary-Markdown boundary work are concrete and internally coherent. Their deterministic contracts, typed failures, source-byte preservation and documentation are legitimate product deliverables even if the terminal model-quality target fails. Automatic cross-language retention and answer reliability must be reported strictly from the final independent grade. The correct finish is a candid, scoped PR disposition with the original 90% gate and separate 80% completion target side by side, no issue closure, no merge and no further tuning against the terminal held-out output.
