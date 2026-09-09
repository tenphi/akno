# Knowledge language and discourse

Akno separates source language, generated knowledge language, and answer language. Set
`knowledge_language: "en"` in machine configuration to generate English knowledge from English, Russian,
or mixed sources. The default `null` preserves previous generation behavior. The setting is never inferred
from the latest source, query, operating-system locale, or provider response.

```jsonc
{ "knowledge_language": "en" }
```

English is the initial supported knowledge target. `answer({ answer_language: "ru", ... })`, or
`akno answer ... --language ru`, independently requests a Russian answer. Without an override, the knowledge
language applies; if both are unset, generation retains its legacy prompt behavior. Hosts discover the effective
policy in `context.knowledge_language` and remain responsible for their own final conversation responses.

For an automatically extracted record with one intact source support, answering also receives its bounded
original quotation as internal context. The visible retained record determines what can be answered; the
quotation constrains its meaning and qualifications. The same verifier call must separately confirm that
every answer proposition was selected by the retained text; missing, inconsistent or negative selection
verdicts withhold the block. This is a model judgment, not a proof that adjacent source content cannot leak. This
context is bound to the current item and exact support fingerprints, hash checked, and excluded from public
context and citations. The configured answer provider receives this bounded original quotation, and may be
different from the provider used for retention. Complete frames are selected in retrieval order with a 4,800-character total cap.
Missing archives, multiple supports, manually provided records and inactive or mismatched supports keep the
existing retained-text-only behavior. Deleting durable state therefore loses this additional context;
rebuilding the index in place preserves it. No additional model call or semantic retry is introduced.

## Generated prose and exact content

The shared model client applies the policy to retained prose, semantic labels, summaries, observation patterns,
reflection principles, curation bodies, rewritten history lines, corrected managed-memory sentences, and new titles. Exact original support/discourse-frame quotations,
names, identifiers, code, paths, existing title references, and destination headings keep their original form.
Generic role labels such as “assistant” are translated when used as descriptive attribution; actual named
speakers keep their exact spelling. A bounded answer guard checks known generic assistant reporting labels
against the effective answer language, while preserving exact source quotations and code. The shared model
language check still covers the rest of the prose.
Answer generation presents a generic assistant as a localized role label; verification and public evidence
retain the original source metadata. A named speaker is never replaced by that display label. Generation
uses direct localized outer attribution for reports and retains any nested speaker and verification limits.
It also receives localized kind, commitment, disposition and temporal-status labels as presentation aids; original enums remain the qualification authority
and verification/public evidence retain those original fields. Tentative timing stays separate from a stated
proposal and its proposed disposition. Active record status does not independently
assert that a described mental activity is still ongoing. Explicit dates, endings and resolutions remain
constrained by the source. A bounded answer check also prevents observed personal cause-nonselection
wording from becoming an agentless state. An explicit agent still needs full source verification;
provenance metadata alone does not establish who performed an action.
Curator revisions check newly generated complete Markdown through a schema-specific selector. Exact original
lines are exempt, including transfers between authorized paths; each original occurrence can exempt only
one final occurrence. Changed bytes and extra copies are checked. Existing proposed after-states are never
source-language authority. Invalid revision shapes or failed selection return a typed language-check failure
before a revision can be sealed or applied. Operational decision reasons are prompt-governed explanations,
not durable knowledge fields checked by this boundary.
Source image extraction/transcription explicitly preserves the source language.
Changing the setting does not translate existing pages, rename identities or folders, or enqueue bulk translation.

Generation receives an explicit language instruction. A separate bounded call checks generated prose fields
without translating them. A mismatch returns `language_mismatch`; an invalid/unavailable check or oversized
output returns `language_check_failed`. Neither exposes fallback generated prose for a write. The check permits
at most 24,000 generated and reference-hint characters, shares an explicit caller latency deadline, and adds one model request
when prose is generated. Classifier-only JSON needs no language call. Receipts aggregate both calls' usage.
This verdict is fallible and verifies neither truth nor translation entailment; retention and answers retain
their separate semantic verifier.
Answers supply a bounded list of exact source-backed name and title hints to the language check. Hints must
occur in the generated excerpts to be sent; the surrounding prose is still checked, and no hint overrides a
negative verdict. Minor grammar errors are distinguished from a change of language. These hints are data,
not instructions or evidence of truth.

Provided retention remains exact and model-free. With English configured, callers must attest supplied prose
with `retention.knowledge_language: "en"`. Missing attestation returns `language_policy_required`; a different
declared language returns `language_mismatch`, without a write or replay receipt. The caller owns that attestation
and the supplied semantics. Akno does not guess language from names or short strings, translate the candidate,
or imply semantic verification. Exact `write` operations and authored text remain under caller control.

New retain receipts record `knowledge_language`. An existing source revision replays its recorded policy and
outcome before checking current configuration, with no additional translation or write.

Extraction and verification share definitions for proposition polarity, unresolved questions, unaccepted
proposals, fictional participants and source-relative time. A positive property inside a hypothetical scenario
has affirmed polarity while its commitment remains hypothetical. Nested reports retain `source_report`
basis even when the outer recorder is a user. A narrator's later corrective clarification stays outside
the inner speaker's reported clause, with both clauses and verification limits in one retrievable record. Unanchored calendar references such as “tomorrow” stay in an
explicit unknown, tentative time envelope; readable prose names both the source clock and its unknown date.
`mentioned_at` must come from a supplied source timestamp. Durations and hypothetical coverage intervals
remain prose; an established schedule retains its cadence and time envelope, with structured recurrence
only when its start is supported.
One recorded structural repair can address field-specific validation failures before semantic verification.
It cannot retry a semantic rejection or remove the unresolved time envelope to admit the same claim.
The extraction schema places prose after exact support, discourse frame, attribution and time so the model
can formulate each independently retrievable sentence with its qualifications already specified. Output
ordering is a generation aid; incomplete or unsupported sentences still fail the same verification.

## Ordinary Markdown

A versioned deterministic scanner qualifies ordinary Markdown without adding markers or changing its bytes.
It reads the complete current file before selecting an excerpt. Returned lines carry `prose`: a view,
qualification status, reason, exact file hash, and bounded original-language context frame. This describes how
a statement is expressed, not whether it is true, and grants no managed-item authorship or retain receipt.

The first scope recognizes English/Russian hypothetical and tentative wording, ATX/setext headings, nested
headings, block quotations, speaker turns and role headings, plans, questions, rejection, fenced examples,
source fences, and an explicit following qualification referring back across a paragraph break. Conditional
and speaker scope continues across blank lines until the next heading. Sibling headings end their enclosing
scope; nested headings retain it.

| Reading                                                        | Factual use                                  | Inspection                                                    |
| -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Ordinary assertion                                             | Eligible evidence, without a truth guarantee | Original text                                                 |
| Report, scenario, tentative passage, plan, question, rejection | Embedded proposition excluded                | Explicit view or `all`, with deciding context                 |
| Frame over 12 lines or 2,400 characters                        | Ineligible, including answer view `all`      | Original text, `unresolved`, and `prose_discourse_unresolved` |

Fact extraction never receives disqualified lines. Structural indexing removes old derived facts and timeline
events on those lines before deferred model work. Factual graph edges require an eligible passage projection.
Recall, context and answers retain qualification and count frames against evidence budgets. Answers must
preserve nonfactual status and citation context. Retention and answer verification each return three separately assessed dimensions:
proposition support, action arguments, and qualification scope. Every dimension must pass. An action's
object, purpose, instrument, destination and modifier attachment must survive paraphrase or translation;
a component named only as the subject of an inspection cannot silently become the object being transported.
Each verdict now includes a bounded comparison of source meaning, candidate meaning, action arguments
and qualification scope, followed by one concrete mismatch for each failed dimension. Missing comparisons,
contradictory mismatch/boolean pairs and accepted retention verdicts carrying hold reasons fail closed.
Comparison notes are audit material, never evidence or an acceptance override. Preserved source ambiguity
is legitimate; selecting an unsupported reading or losing material ambiguity is not. Retention compares at most two disjoint candidates per call; answers compare one block per call. The requested output allowance includes audit prose; the configured provider-role ceiling remains authoritative, and truncation fails closed. Usage and latency receipts sum the calls and preserve unavailable usage as unknown.

Multi-span retention candidates also require one short interpretation for every validated discourse-frame
span, keyed by private server-assigned IDs. Missing, duplicate or foreign IDs fail the verifier call closed. Retention verdicts must be complete JSON; missing closing delimiters are never repaired into an accepted decision.
Each interpretation accounts for the positive content and its limits before the aggregate semantic
comparison. The audit includes original-source clarification across languages without treating adjacency
as equivalence. A repaired position keeps its original proposition obligation separately from source
evidence. Single-span candidates retain their existing comparison. Interpretations and relationship labels
remain fallible model judgments; their presence does not prove entailment or override a negative dimension.
This accounting uses the same verification call with a bounded allowance per required span. Private candidate verdict schemas use an ordinary nested union with distinct single-value ID enums, compatible with the strict endpoint subset. Unexpected verdict fields fail local parsing as they do the wire schema.

Missing dimensions fail closed. Each candidate or block is submitted once during the semantic verification pass, with no retry after rejection. Disjoint batches retain the full original source or their own cited evidence; related candidates supply relation context only. Final retention applies dependency closure: a relation whose internal target was withheld also withholds its source record and all transitive dependents. A malformed or unavailable verification batch withholds the operation; a semantic rejection does not prevent checking other batches. Retention verifies against the complete original source, including process identity and word sense; a fluent English paraphrase cannot certify its own meaning. Generated attribution normalization keeps the structured outer recorder and explicitly supported inner reporters, holds contradictory roles or chain overflow, and never truncates a chain. Unknown source clocks require both a readable source anchor and unknown date. Answers cannot infer what the whole original source omitted from a retrieved subset.
CLI excerpts show qualification labels and scope line references;
`--json` exposes the exact frame.

Whole-page summaries are suppressed when ordinary prose includes a nonfactual passage. Whole-page curation,
splitting, extraction and merging are held for those inputs; curation reports `prose_discourse_held`. Such pages
are also excluded as neighboring synthesis evidence. Observe and reflection consume the eligible fact graph.
These conservative choices keep summaries and rewrites from removing deciding context while a richer
passage-aware synthesis contract is absent. Exact user edits and source inspection remain available.

Reads recompute scope from current bytes, including editor changes that precede watcher indexing. Projection
upgrades and rebuilds leave source bytes unchanged. Missing/stale index qualification reports
`partial_memory_index`; oversized frames stay inspectable with typed degradation. No semantic classifier model
is required. The scanner does not understand arbitrary implicit discourse, every speaker convention, or every
language. Unsupported implicit qualifications may be missed; conservative false holds and bounded supported
cases must be assessed separately from model quality.

## Evaluation

The frozen language/discourse corpora separate development and held-out cases with invented English,
Russian and mixed sources; exposed corpora remain available unchanged. V10 doubles the earlier writable
scenario count. V11 moves the ten exposed v10 held-out scenarios into development and adds ten fresh
held-out scenarios of the same kinds, including multi-turn context.
Each split also has a read-only admission case. A separate model approves source/expectation pairs before execution. Earlier corpora remain
diagnostic evidence of their recorded runtime versions. Deterministic CI covers policy, exact quotes, qualification, source-byte preservation,
rebuild/replay, graph eligibility, and failures. It does not establish live-model quality.

```bash
pnpm build
pnpm bench:language --live --split development --corpus v17 --runs 2 --output bench-results/language-development.json
pnpm bench:language --live --split held-out --corpus v17 --runs 2 --output bench-results/language-held-out.json
```

These explicitly opted-in runs use configured model roles and temporary isolated knowledge bases. They retain,
restart/rebuild, replay, query in English and Russian, assemble context, and request English and Russian answers.
Each case runs the full eight combinations of query language (English/Russian), answer language
(English/Russian), and explicit/inferred memory view. `--runs` accepts one through five repetitions, each in
fresh directories; `--case ID` selects diagnostic cases and records the selection in the report.
Ordinary passages are read and inspected through production operations. Reports include corpus/policy/prompt
versions, model ids, stage receipts, per-language/scenario counts, and denominators for holds, coverage, typed
semantic mismatches, noncanonical eligibility flags, language rejection and availability. Index summaries/facts are disabled
in this language benchmark; integration tests cover ordinary fact and graph derivation separately.

V2 introduces authored review expectations and separates writable language fidelity from a deliberately
read-only admission case. The ordinary source passage is indexed after retention, so it cannot win routing
against the writable destination. V1 indexed that passage first as a read-only knowledge page: some apparent
false holds were legitimate refusals to substitute a weaker writable page. The old setup is recorded as
`legacy-read-only-source-before-retain`; its coverage is not directly comparable to v2. Routing authority,
folder admission and configured fallback behavior are preserved.

Answer diagnostics expose `reason_code` and `validation`: generated blocks, blocks passing deterministic
guards, independently verified blocks, and rejection counts for language, citations, protected values, attribution,
discourse and semantic support. `verified_blocks: null` means verification did not complete; it is not a failed
semantic verdict. No eligible evidence is an abstention, without a fabricated `answer_failed` degradation.
For a record with an exact bound original frame, answer generation first emits a private interpretation
of that record. It is discarded before independent verification and never becomes answer evidence.
The existing verifier separately compares action actors, objects/mechanisms and qualifications using
exact source/answer substring anchors. Missing, malformed or negative comparisons withhold the block
alongside the existing semantic and retained-excerpt selection checks. These fallible comparisons focus
attention; they do not establish exhaustive semantic correctness.

The answer role's default output ceiling is 2,400 tokens to accommodate these audits. Ordinary generation
still requests 1,024; framed generation reserves additional space, and verification can emit a longer
comparison. This can increase latency and output cost. Explicit caller/provider limits remain authoritative;
large or verbose audits may still exceed the ceiling and withhold an answer. Akno never truncates the
required audit into an accepted verdict, retries its semantic decision or adds a fallback pass.
An isolated language benchmark can explicitly select `--answer-output-tokens 2400`; this overrides only
that trial's answer-role ceiling and leaves service configuration untouched. Reports and their review
fingerprints include resolved answer/retention output ceilings so different trial budgets cannot be mixed.

Retain candidates expose `hold_stage` and `routing_reason` for validation, verifier and placement decisions.
Unavailable or invalid routing models report typed degradation; receipts preserve those diagnostics on replay.
Old receipts may lack the new optional fields. These fields contain no source text.

Answer guards accept bounded English/Russian qualification forms while checking combined semantics: a
reported tentative claim must retain both attribution and uncertainty, and fictional examples must remain
fictional. The complete answer still passes a separate semantic verifier, which receives the original question
and effective memory view to interpret short answers without treating the question's premises as evidence.
Exact source frames may contain a
narrower support quotation; they must remain byte-exact, uniquely located, and in the same source item.
Several adjacent frame quotations may cover one support quotation; only whitespace may bridge them.
Exact provided retention holds when the frame omits words, including negations. Automatic extraction can
complete a partial frame by appending its already validated exact support quotation. It preserves every original
frame span and the candidate prose, adds no guessed source context, and still requires full semantic verification.
Support arrays have an eight-span cap and frames a 16-span cap; invalid explicit spans cannot fall back to legacy fields, and
completion never truncates context to fit. A proposal with explicitly unknown temporal precision,
tentative time status and no date boundaries or recurrence may retain an unresolved source-relative time.
Its readable sentence must identify the unknown source clock; bare “tomorrow” is insufficient even with unknown
structured precision. It is never actionable or eligible for a bounded date query. Invented resolved dates still fail validation.

Rejected plans keep their rejected disposition through the public schema, saved markers and history views;
they are excluded from planning and factual views. Explicit invalid commitment/disposition values are held
instead of being silently normalized. Reports that explicitly lack confirmation must retain that qualification
in readable prose: source attribution alone cannot substitute for it. A corrective contrast that defines the
same action or value, such as “adjustment, not replacement,” stays in one readable record; unrelated adjacent
details are optional. Extraction and verification use the principal proposition's polarity, keeping a
positive action distinct from its rejected disposition or a contrasted exclusion.

For blocks citing only qualified managed records, the answer guard screens concrete predicate denial rather
than the mere presence of a grammatical negator. English/Russian translations can introduce negation while
preserving uncertainty, open-question status, fiction, report attribution or rejected selection. Exact token
and citation checks remain deterministic. Predicate matching is a heuristic: complete and mixed-clause polarity
still requires the full citation-scoped semantic verifier, which receives a checklist of the cited records'
typed constraints. Mixed or untyped evidence retains the conservative lexical comparison. Named report sources use a bounded grammatical reporting relation. Tentative modifiers and report ownership
can express that relation; recording an unrelated object cannot. Spaced Russian passive uncertainty must
qualify an epistemic noun rather than deny an unrelated action. Direct user
provenance (`self_attested`) does not require adding a claim of self-attestation to the answer. The generator
receives the source identity and qualifications without this internal basis label; the verifier and public
evidence retain the complete metadata. This avoids introducing verification disclaimers absent from the source. Closed plans
must preserve their rejected/cancelled/completed/superseded status, without redundant planning wording.
Competing unconfirmed hypotheses retain tentative or hypothetical commitment even when their discussion
is established; they do not gain ordinary factual eligibility from the certainty of that outer discussion.

When extracted candidates fail structural validation, retention permits one repair transaction using the
complete original source and validation issues. Repairs target only failed original candidate positions;
relations continue to use original indices. Every repaired candidate passes the same validation and semantic
verification. The complete records, relations and order of already admitted candidates must remain identical. Each returned repair position must survive as a candidate or an explicit hold; silent duplicate collapse invalidates the transaction. Verification receives the original position’s candidate as a repair obligation, checks its source-supported core proposition, and cannot accept a sibling substitution merely because that different proposition is also true. The original candidate is not evidence.
An invalid or unavailable repair preserves those admitted candidates for verification and reports typed
degradation, including through remember previews and replay. Semantic verifier rejections are not retried.
Structural repair guidance identifies the exact allowed commitment and disposition for the candidate kind.
Questions require commitment none; invalid explicit values are held rather than silently coerced.
Generated nonfactual prose must keep its named outer source speaker; source metadata alone cannot satisfy
this readable attribution check. Named inner reporters require a bounded explicit reporting relation in the
original frame; a name merely appearing as a fictional participant is insufficient. Semantic verification still
checks the full quotation scope. Explicit exclusion wording with affirmative polarity is held before verification.
Repair cannot replace legacy event extraction. The optional
`model_usage.repair` receipt reports the extra call and replays with the original result.

Reports under `bench-results/` contain diagnostics and generated text from the invented corpus for review.
Inspect `reviewKnowledge`, per-query `reviewRetrieval` and `reviewAnswer` against frozen sources when adjudicating translation, attribution,
polarity and useful answers. Produced answers are reported both over all requests and over retained cases;
independently judged useful answers and justified abstentions remain separate, unassessed metrics. Accepted language-error, translation-error and unsafe-promotion rates stay **unassessed** until that
review: another model's agreement is not ground truth. Reports declare thresholds and remain ineligible as
release evidence without independent adjudication. Preserve prior reports for comparisons.

`scripts/review-language.mjs` exports a blind output-review packet after the corpus expectations have been
independently approved. It includes exact per-query retrieved passages for relevance and qualification review,
and excludes runtime verifier verdicts and aggregate scores. Pass the completed output
review back to compute the gate:

```bash
node scripts/review-language.mjs \
  --report bench-results/language-development.json \
  --report bench-results/language-held-out.json \
  --input-review bench-results/language-input-review.json \
  --output bench-results/language-review-packet.json

node scripts/review-language.mjs \
  --report bench-results/language-development.json \
  --report bench-results/language-held-out.json \
  --input-review bench-results/language-input-review.json \
  --output-review bench-results/language-output-review.json \
  --output bench-results/language-gate.json
```

The computed gate requires both complete splits, at least two runs, all eight query/answer/view combinations,
current matching runtime contracts, and exact corpus/report/review fingerprints. Every split/run must achieve
at least 80% independently judged useful retention and independently relevant qualified retrieval. The broader
v10 through v17 corpora require at least 90% useful qualified answers in every split/run; historical corpora retain their
original 80% answer threshold. The policy comes from the frozen corpus version, not a report-supplied number.
V10 through V17 gates also break down useful retention and answers by source language and scenario, and answers by query
and requested output language. These groups describe coverage within a finite corpus, not independent samples.
At most 5% of cases may have availability failures. Accepted language errors, qualification errors, unsafe factual promotions and
source-byte changes must all be zero; read-only holds must all be correct. Missing reviews, stale receipts,
duplicate judgments and abstention-only output cannot pass. Abstentions remain separately adjudicated.
Retrieval is judged once per query-language/view pair; duplicated evidence in the two answer-language rows
must receive the same judgment and cannot increase its weight. Model adjudication is labeled as such and must use a model different from the runtime retention/answer model;
it is fallible review of a finite invented corpus, not human validation or a longitudinal reliability guarantee.

V13 through V17 use `language-output-review-v2` and `language-quality-gate-v2`. Every retained set receives
`retainedSourceEntailed`: all saved propositions must follow from the frozen original source; an empty set
is vacuously true. Each answer receives `sourceEntailed`, null if and only if the answer is null. A nonnull
answer must follow from the original source even if it repeats flawed retained knowledge. Unsupported
retained sets and nonnull answers must both be zero. A mixed retained set can contain useful knowledge and
an unsupported addition; it still fails this precision gate. Focused answers may select a supported subset,
but cannot remove a restriction that changes meaning. These judgments are scored separately from the qualification and language dimensions; altered attribution
or commitment can also change whether the content follows from its source. Earlier corpora retain the original review schema and policy.

Older frozen answer corpora are unchanged. Some expect factual answers from a record that “says” a claim;
the stricter report boundary abstains on those cases. Their benchmark gates expose the coverage loss instead
of silently replacing expected answers. General longitudinal reliability and bounded observation/reflection
inference remain separate roadmap work.

A split used to diagnose or tune a fix is exposed diagnostic evidence afterward, even if its frozen name is
`held-out`. Fresh independently reviewed cases are required for an unbiased release-quality claim.

## Independently reviewed v26 and v27 diagnostics

The v16 corpus ran twice per split at V26 runtime `23ab599`, using GPT-5.6 Luna and independent GPT-5.6 Sol
review. The gate failed with 240/320 useful writable answers: development 74/80 and 61/80, held-out 51/80
and 54/80. Useful retention was 34/40. All retained sets were source-entailing, but one nonnull answer added
unsupported terminology doubt and lost qualification. All 32 read-only abstentions were justified; 62
writable nulls were unjustified. No accepted language error, unsafe factual promotion, source-byte change
or case availability failure was found. The [complete V26 evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v26)
includes initial and corrected independent judgments after a consistency review under the unchanged contract.

V27 at `7909f71` repairs structurally rejected original positions even when another candidate survives,
while preserving every admitted record and relation. Its exposed report/exclusion diagnostic scored 8/16
useful answers; the separate built-package probe scored 16/16, with all nonnull answers source-entailing.
The [complete V27 evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v27)
failed the repeated gate with 239/320 useful answers, 32/40 useful retained sets, three case-runs with typed
qualification errors, one unsupported answer and one case availability failure. Both initial and corrected
independent judgments remain preserved. V27 was frozen before fresh full V26 outputs were opened.

The [V28 probes](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v28) yielded 23/32
useful selected answers and 16/16 built-package answers; all nonnull answers were source-entailing. Its
fresh full trial was never started. V29 separates outer nonverification from inner-speaker commitment and
real discussion plans from their fictional propositions, preserves absence of evidence in hypothesis answers,
and addresses bounded report-wording false rejections. It uses the unchanged independently approved fresh
v17 inputs under the same repeated 90% and zero-error gate.

## Independently reviewed v23–v25 diagnostics

The v15 corpus ran twice per split at frozen runtime `75c9b90` (v23) and `bd8e068` (v24), using GPT-5.6 Luna
and independent GPT-5.6 Sol review. Both gates failed. V23 produced 253/320 useful writable answers, four
unsupported retained sets and fourteen unsupported nonnull answers. V24 produced 275/320 useful answers:
development 69/80 and 70/80, held-out 66/80 and 70/80. It recorded four unsupported retained sets, nine
unsupported nonnull answers and 36 unjustified writable nulls. All 32 read-only abstentions were justified.
No accepted qualification/language/promotion error, source-byte change or case availability failure was found
in v24. Its separate built-package probe scored 8/16 useful answers.

V24 was frozen before v23's fresh outputs were opened; its changes used only an exposed earlier probe.
Both [v23 evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v23) and
[v24 evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v24) are preserved.
Errors included changing lack of arrangement into refusal, sanding into polishing, and a device-collection
report into data collection. Subsequent extraction and verification distinguish proposition, action arguments
and qualification, preserve supported reporter roles, and constrain whole-source absence statements.

The exposed v25 diagnostics at `3988ba1` scored 14/24 useful selected answers and 15/16 useful built-package
answers. Every nonnull answer was source-entailing. Verification correctly rejected an exclusion rewritten
as whole-contract silence. The [complete v25 evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v25)
remains preserved. V26's shared contract preserves the grammatical subject and scope of negative epistemic
statements; semantic rejection remains final. V16 introduces ten fresh, independently approved writable
held-out sources under the unchanged 90% coverage and zero-error gates.

## Independently reviewed v22 broader diagnostic

The v14 corpus ran twice per split at runtime commit `4f893b4`, using GPT-5.6 Luna with independent
GPT-5.6 Sol review. The unchanged gate failed:

| Split       | Run 1 useful answers | Run 2 useful answers |
| ----------- | -------------------: | -------------------: |
| Development |                77/80 |                72/80 |
| Held-out    |                69/80 |                61/80 |

The 279/320 useful answers leave 40 unjustified nulls and one unsupported translation from service
collection to data collection. Useful retention was 37/40; all 32 read-only abstentions were justified.
No accepted qualification, language or promotion error, source-byte change or availability failure was found.
The initial reviewer missed the translation error; a consistency recheck against the unchanged contract
corrected one judgment. Both receipts and the authoritative failed gate are preserved in the
[complete evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v22).
Selected diagnostics yielded 23/24 useful answers and the separate built-package probe 14/16.

Eighteen nulls followed missed implicit memory-view intent, sixteen followed incomplete/held retention,
and six were false draft/verifier rejections. V23 adds bounded query phrases with factual counterexamples,
recognizes explicit independent-verification uncertainty and typed rejected-plan wording, and clarifies
retaining actual outcomes alongside their counterfactual alternatives. Translation instructions preserve
the action's sense and object. All candidates and accepted answer drafts still require semantic verification.
V15 reuses exposed v14 sources only for development and adds ten independently approved fresh writable
held-out sources. No acceptance threshold changes.

## Independently reviewed v21 broader diagnostic

The v13 corpus ran twice per split at runtime commit `a7c3f65`, using GPT-5.6 Luna and separate
GPT-5.6 Sol input/output review. Every group reached the 90% useful-answer target, but the gate **failed**
for five omitted source-relative time qualifications:

| Split/run     | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------- | ---------------: | ------------------: | -----------------------: |
| Development 1 |            10/10 |               40/40 |                    79/80 |
| Development 2 |            10/10 |               40/40 |                    72/80 |
| Held-out 1    |            10/10 |               40/40 |                    78/80 |
| Held-out 2    |            10/10 |               40/40 |                    79/80 |

The 308/320 useful answers leave seven unjustified nulls and five answers that mention a relative month
and unknown calendar date without tying that month to the undated original source. All 40 writable
retentions are useful. There were no accepted source-unsupported records or answers, language violations,
unsafe factual promotions, source-byte changes or case availability failures. All 32 read-only abstentions
were justified. The initial independent review missed the five clock omissions; a consistency recheck
against the same contract corrected those judgments. Both receipts remain in the
[complete evidence](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v21), with the corrected
receipt governing the failed gate. No inputs or thresholds changed during that recheck.

A separate built-package probe passed independent review for two records and all 16 answers. A selected
four-case diagnostic retained all four records faithfully and produced 29/32 useful answers, including one
source-clock omission. Those probes provide deployment and diagnostic evidence, not replacement trials.
Forensic review found six of the seven full-trial nulls were correct rejections of flawed drafts; the remaining
false rejection involved a possessive inner-speaker attribution.

V22 requires both the source anchor and unknown calendar clock when the cited record explicitly carries
unresolved source-relative timing. Unknown precision alone does not activate this check. Abstract timing
may preserve the qualification without repeating its exact unit; every accepted block still undergoes
semantic verification. V22 also accepts a bounded possessive speaker report frame while preserving the
outer recorder and semantic checks. V14's fresh held-out inputs were independently approved before
execution under the unchanged 90% and zero-error thresholds.

## Independently reviewed v20 broader diagnostic

The v12 corpus ran twice per split at runtime commit `5e0b5d3`, using GPT-5.6 Luna with independent
GPT-5.6 Sol input/output review. The unchanged 90% answer gate **failed**:

| Split/run     | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------- | ---------------: | ------------------: | -----------------------: |
| Development 1 |             7/10 |               28/40 |                    60/80 |
| Development 2 |             8/10 |               32/40 |                    62/80 |
| Held-out 1    |             9/10 |               36/40 |                    66/80 |
| Held-out 2    |             9/10 |               36/40 |                    66/80 |

The 254/320 useful answers leave 51 unjustified nulls and 15 source-unfaithful answers. Both repetitions
changed a reported service provision into an instantiated pickup booking; most answers repeated that
unsupported change. The report attribution and lack of verification survived, so the final review records
no qualification or factual-promotion error. This distinction motivated V13's separate zero-tolerance
source-entailment gate. There were no accepted language errors, source-byte changes or case availability
failures, and all 32 read-only abstentions were justified. Four writable retentions were entirely empty;
three more lost necessary content or scope.

The [complete reports, review receipts and failed gate](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v20)
remain preserved. A separate built-package probe produced 21/24 answers, of which 14/24 were independently
useful; it reproduced the provision-to-booking error and does not replace the full trial. Final review
receipts distinguish source scope from qualification and accept focused, explicitly rejected-offer answers
without requiring a redundant no-plan sentence.

V21 adds generated-candidate checks for typed booking context and readable source-supported subject
identifiers, preserves unresolved alternatives in questions, and recognizes explicit unrecoverable source
dates. Shared prompts distinguish service provision from booking, assistant tentative reports from
hypothetical scenarios, and source-supplied conditional consequences from new deductions. Bounded answer
checks accept additional faithful attribution, rejection and uncertainty forms without bypassing source
verification. V13's ten fresh held-out sources were independently approved before execution; the answer
threshold remains 90% in every split/run.

## Independently reviewed v19 broader diagnostic

The v11 corpus ran twice per split at runtime commit `015f122`, using GPT-5.6 Luna with independent
GPT-5.6 Sol input/output review. The unchanged 90% answer gate **failed**:

| Split/run     | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------- | ---------------: | ------------------: | -----------------------: |
| Development 1 |            10/10 |               40/40 |                    72/80 |
| Development 2 |            10/10 |               40/40 |                    74/80 |
| Held-out 1    |            10/10 |               40/40 |                    71/80 |
| Held-out 2    |             9/10 |               36/40 |                    62/80 |

The 279/320 useful answers leave 34 unjustified nulls and seven incomplete answers caused by a lost
retention contrast. The review found no accepted language or factual-promotion errors or source changes;
all 32 read-only abstentions were justified. One answer call reported a typed language mismatch. Its original
generated prose was not retained in the diagnostic trace, so that failure cannot be adjudicated as a true
language violation or a false language-check rejection.

A separate code audit identified asserted metadata on a readable competing-hypothesis record. The blind
reviewer accepted it as a faithful assertion that a discussion happened; the implementation contract requires
commitment to describe the embedded proposition. The original receipt remains unchanged. V12 explicitly
states that semantic distinction before input and output review, allowing tentative or hypothetical status
when either preserves the supported meaning. It moves exposed v11 cases into development and introduces
ten fresh writable held-out sources under the unchanged 90% target.

The [complete reports, review receipts and failed gate](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v19)
remain available. The 16-answer built-package probe is separate deployment evidence and does not replace the
full trial.

## Independently reviewed v18 broader diagnostic

The broader v10 corpus ran twice per split at runtime commit `66f191d`, using GPT-5.6 Luna and separate
GPT-5.6 Sol input/output review. It contains twenty writable scenarios rather than ten, with new multi-turn
held-out sources. The predeclared 90% answer gate **failed**; its scores are not directly comparable to the
smaller corpus's 80% gate.

| Split / repetition | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------------ | ---------------- | ------------------- | ------------------------ |
| Development / 1    | 10/10            | 40/40               | 77/80                    |
| Development / 2    | 9/10             | 36/40               | 70/80                    |
| Held-out / 1       | 10/10            | 39/40               | 63/80                    |
| Held-out / 2       | 8/10             | 28/40               | 54/80                    |

There were 55 unjustified null answers and one non-null answer missing an explicit qualification.
One saved report lost its source's lack of confirmation, producing a separate knowledge qualification error.
A tentative representation of two unconfirmed competing hypotheses was accepted semantically: a typed
expectation mismatch alone does not mean the uncertainty or alternatives were lost. Three writable case/runs
saved no knowledge, including one with model availability degradation. All 32 read-only abstentions were
justified; no unsafe factual promotion, accepted language violation or source-byte change was found.

The [original gate and complete reports/reviews](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v18)
remain unchanged. Its built-package report/counterfactual probe produced all sixteen answers and preserved
the actual declined decision plus unrealized alternative; that separate deployment evidence does not replace
the failed broader trial. The v10 held-out inputs are now exposed development evidence.

## Independently reviewed v17 result

The v9 corpus **passes the declared gate** for the frozen runtime at `bb78edf`. GPT-5.6 Luna remained the
retention/answer model; GPT-5.6 Sol independently approved the inputs before execution and graded the blind
output packet. Each split ran twice with all eight query/answer/view combinations per case. The runtime used
`answer-generation-v17` / `answer-verifier-v7`, `retain-extraction-language-v11` /
`retain-verifier-language-v5`, `memory-view-v3` and `prose-v1`.

| Split / repetition | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------------ | ---------------- | ------------------- | ------------------------ |
| Development / 1    | 5/5              | 20/20               | 38/40                    |
| Development / 2    | 5/5              | 20/20               | 38/40                    |
| Held-out / 1       | 5/5              | 20/20               | 34/40                    |
| Held-out / 2       | 4/5              | 20/20               | 33/40                    |

The reviewer found no accepted language errors, lost qualifications or unsafe factual promotions. All 16
read-only abstentions were justified; source bytes were unchanged, all ordinary-prose checks passed and
there were no model availability failures. The 17 writable-case null answers remain usefulness misses.
One retained counterfactual preserved the unrealized repair proposition but omitted the explicit decision
to decline the warranty, so that case counts as incomplete retention. Both losses remain in the denominators;
the minimum retention and answer coverage in a split/run were 80% and 82.5%, respectively.

The [computed gate](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/gate.json),
[development report](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/development.json),
[held-out report](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/held-out.json),
[input review](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/input-review.json) and
[output review](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/output-review.json)
preserve the complete result. A separate
[built-package time probe](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v17/built-undated.json)
retained an explicitly undated proposal, produced eight answers and replayed without changing source bytes
after rebuilding and restarting the service. It is deployment evidence, outside the gate totals.

This is fallible independent model review of a finite invented English/Russian corpus. It does not establish
universal language support, arbitrary implicit discourse understanding or longitudinal memory reliability.

## Independently reviewed v16 diagnostic

The v8 corpus ran twice per split with GPT-5.6 Luna and separate GPT-5.6 Sol input/output review.
Its original-contract gate at commit `ac562f8` **failed**. Development answered all 80 combinations, but one
retained proposal omitted the unknown source date in readable prose. Both held-out repetitions lost the
requested counterfactual proposition while retaining a decision from the same source.

| Split / repetition | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------------ | ---------------- | ------------------- | ------------------------ |
| Development / 1    | 5/5              | 16/20               | 40/40                    |
| Development / 2    | 5/5              | 20/20               | 40/40                    |
| Held-out / 1       | 4/5              | 16/20               | 22/40                    |
| Held-out / 2       | 4/5              | 16/20               | 26/40                    |

All 16 read-only abstentions were justified; 32 writable-case null answers were coverage failures. The review
found one qualification error and no accepted language errors or unsafe factual promotions. Source bytes
were unchanged and no model availability failure occurred. These inputs became exposed diagnostic evidence.

The [original gate](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v16/gate.json)
and its [reports and independent reviews](https://github.com/tenphi/akno/tree/main/benchmarks/language/results/v16)
are preserved alongside a separate built-package counterfactual answer probe. That probe checks deployment;
its two successful answers do not replace the failed complete evaluation.

## Independently reviewed v14 baseline

The v6 corpus was run twice per split with GPT-5.6 Luna for retention/answers and GPT-5.6 Sol for separate
input/output adjudication. Inputs were approved before execution; the output packet hid runtime verdicts
and aggregate scores. The gate used the original runtime contracts from commit `ebc5814`.

| Split / repetition | Useful retention | Qualified retrieval | Useful qualified answers |
| ------------------ | ---------------- | ------------------- | ------------------------ |
| Development / 1    | 5/5              | 20/20               | 39/40                    |
| Development / 2    | 5/5              | 20/20               | 33/40                    |
| Held-out / 1       | 5/5              | 20/20               | 29/40                    |
| Held-out / 2       | 5/5              | 20/20               | 33/40                    |

Both read-only holds and all 16 associated abstentions were justified. The reviewer found no accepted language,
qualification or factual-promotion errors; source bytes stayed unchanged and model availability had no failures.
Nevertheless, **this baseline failed**: the first held-out run missed the 80% useful-answer threshold. Its 26
unjustified null answers across both splits remain coverage failures. The v6 split became exposed diagnostic
evidence after this review and informed later guard fixes.

The [computed gate](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v14-baseline/gate.json),
[development report](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v14-baseline/development.json),
[held-out report](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v14-baseline/held-out.json),
[input review](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v14-baseline/input-review.json) and
[output review](https://github.com/tenphi/akno/blob/main/benchmarks/language/results/v14-baseline/output-review.json) are preserved unchanged.

## Initial live baseline

The initial diagnostic run used `language-discourse-v1` (fingerprint
`69752a7525357e462aea76b251f531a33862279b0a87900eeb182bed6d1db458`), English knowledge,
`retain-extraction-language-v1` / `retain-verifier-language-v1`, `answer-generation-v5` /
`answer-verifier-v3`, and `prose-v1`. Retention/answer used `gpt-5.6-luna`, embeddings used
`text-embedding-qwen3-embedding-0.6b`, and expansion used `llama-3.2-3b-instruct`.

| Diagnostic metric                                       | Development   | Exposed held-out |
| ------------------------------------------------------- | ------------- | ---------------- |
| Useful cases with retained knowledge                    | 6/8           | 4/6              |
| False holds among useful cases                          | 2/8           | 2/6              |
| Expected safe holds                                     | No such cases | 2/2              |
| Retained cases retrieved with qualification             | 6/6           | 4/4              |
| Retained cases matching typed expectations              | 6/6           | 4/4              |
| Ordinary prose qualification matches                    | 8/8           | 8/8              |
| Source-byte changes                                     | 0/8           | 0/8              |
| Noncanonical eligibility warning flags                  | 0/6           | 0/6              |
| Cases with language-policy rejection                    | 0/8           | 0/8              |
| Cases with model availability degradation               | 1/8           | 0/8              |
| Queries producing an answer, before independent grading | 13/32         | 12/32            |
| Queries reporting `answer_failed`                       | 8/32          | 16/32            |

In this initial baseline, useful retention was below the declared 80% threshold in both splits. Three useful cases were held because
routing found no writable destination in the legacy mixed-permission setup; the counterfactual case was held for uncertain discourse semantics.
The development availability degradation came from query expansion. The `answer_failed` counts arose after
retention left no exact answer evidence in the queried folder; they are distinct from model availability.
Some retained reports, tentative claims and fictional examples were retrieved but did not yield accepted answers.

These counts describe behavior, not independently graded answer correctness. Zero eligibility flags or language
rejections does not establish zero accepted semantic/language errors. Those error rates remain unassessed, and
this baseline **does not pass the live quality gate**. The implementation supplies conservative controls and
reviewable diagnostics; routing coverage, qualified answer usefulness and independent quality adjudication
needed further work. The original frozen answer benchmarks also retain their visible coverage failures described above.

## Repeated v2 diagnostics

The next run froze eight fresh cases before execution (`language-discourse-v2`, fingerprint
`9be572567928a10c4002d811a4f882424aa9d2a4bbea56067768f6383779f5a7`) and repeated each split twice.
It used the same model roles as the initial baseline, `answer-generation-v6` / `answer-verifier-v4`, and
all eight independent query/answer/view combinations per case. These are authored expectations with
implementation review, not independent adjudication. The diagnostic artifacts are
`language-development-v6.json` and `language-held-out-v6.json` under ignored `bench-results/`.

| Diagnostic metric                              | Development, two runs | Held-out, two runs |
| ---------------------------------------------- | --------------------- | ------------------ |
| Expected useful cases with retained knowledge  | 7/8                   | 2/6                |
| Expected-retention misses                      | 1/8                   | 4/6                |
| Expected read-only holds                       | No such cases         | 2/2                |
| Retained cases retrieved with qualification    | 7/7                   | 2/2                |
| Produced answers over retained cases' requests | 40/56                 | 10/16              |
| Produced answers over all requests             | 40/64                 | 10/64              |
| No eligible answer evidence                    | 8/64                  | 48/64              |
| Draft guard rejection                          | 6/64                  | 2/64               |
| Semantic verifier rejection                    | 10/64                 | 4/64               |
| Model availability degradation                 | 0/8                   | 0/8                |
| Ordinary qualification matches                 | 8/8                   | 8/8                |
| Source/index-rebuild byte changes              | 0/8                   | 0/8                |

One development hypothesis was held during deterministic validation (`discourse_uncertain`). In both held-out runs the model
selected no durable candidate from the fictional example; the proposal mentioning “next month” was held
as `time_unresolved` because no source clock/timezone was supplied. The read-only case reported
`read_only_match` at placement without calling the routing model. A separate final two-run admission
probe also checked the tree before and after retention and found no byte changes.

The two noncanonical-eligibility flags in held-out are the factual denials “the warranty was not extended”
retained alongside separately marked counterfactuals, which the authored expectation explicitly allows.
They illustrate why the flag is a review signal, not a measured unsafe-promotion rate. Likewise, the original
v6 artifacts label expected-retention misses `falseHolds`; the runner now calls those
`expectedRetentionMisses` and leaves v2 `falseHolds` unassessed pending independent judgment. An unanswered
request following a deliberate selection or unresolved-time hold is not automatically an incorrect abstention.

Auto-recall activated for 8/128 requests. The reports now preserve the full activation receipt, including
candidate count, qualification pass and reference resolution. This run disables the reranker: ambiguous
cases requiring calibrated qualification cannot activate through that path. That result does not establish
a language-specific auto-recall recall rate, and no injection/permission gate was relaxed to improve it.

The repeated run predates the final attribution fixes: preserving explicitly attributed beliefs and assumptions, accepting “приведённая” as an attribution
form and translating the assistant role when extraction stores `source_speaker: "assistant"`. Actual named
speakers still keep their spelling. Focused built-package probes cover those final fixes; the table is retained
as diagnostic evidence, not relabeled as a measurement of the final guard. Verifier disagreements and
qualified-answer coverage remain visible. This v2 diagnostic did not meet the live quality gate: retention
was below target and accepted semantic/language errors were unassessed. Its held-out split is now exposed
and cannot serve as an unseen release test after these fixes.

Inferred views also recognize bounded questions about tentative assistant readings, qualified retellings, fictional promises and described unrealized variants. These cues select a view; they do not make a report or imagined claim eligible as an ordinary fact. Explicit views remain available when phrasing is ambiguous.

Personal verification limits remain attached to the speaker: an assistant saying it has not examined an agreement does not establish that nobody has examined it. Generation and verification share this scope rule with coupled hypothetical consequences and fictional content. An explicit clarification in the supplied source can resolve a bilingual wording difference before conflict handling; a language switch alone cannot. These are fallible model judgments, evaluated alongside deterministic view and source-clock checks.
