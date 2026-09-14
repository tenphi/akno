# V66 selected-probe source-first forensic review

## Scope and accounting

I reviewed the finalized [selected report](selected-diagnostic.json), [raw trace](../../../../bench-results/language-selected-v66-trace.jsonl), and [source/output packet](language-selected-output-packet-v66.json) without reading the independent grade. The frozen runtime is `13a7569f54634627c0eae91eb8f55d159c064176`. This was one development run over eight writable cases and 64 query coordinates. No fresh V21 held-out source was executed.

The report produced 38/64 non-null answers. That is production, not an independent usefulness score. There were 16 `no_eligible_evidence`, seven `draft_rejected`, one `verification_rejected`, and two reported `generation_failed` outcomes. The two generation failures are observed language-policy rejections, not provider availability failures. No case-level availability failure or routing failure occurred, and all source files were byte-stable.

By original-source comparison, six of eight retained sets are complete. The nested report loses its main report but retains the independent delivery denial; the undated proposal retains nothing. The other six cases retain every material source proposition needed by their stated retention expectation. Retrieval finds qualified evidence whenever a relevant retained record exists.

I find two accepted answer errors, both the same assistant technical-mechanism translation loss. The remaining 36 non-null answers are source-faithful. Several withheld drafts are source-faithful false holds, while other withheld drafts contain real language, actor, or coverage-role errors. Runtime booleans are described only as trace evidence, not treated as truth.

## Case-by-case findings

### `v20-held-report` — incomplete retention; 0/8 answers

The source establishes two independent retained propositions:

1. Ada relays Bo's report that the agreement permits sending Zephyr QX-100 to a workshop to measure latch gap, explicitly not replace the latch; Ada has not read the agreement or independently checked the account.
2. Ada has not arranged delivery of her device.

Trace row 2 extracts both. Candidate 0 is the faithful delivery denial and survives verification and placement (rows 5–6). Candidate 1 contains the complete report and is held during validation. The one repair (row 4) remains faithful and improves readable outer attribution: `Bo Winters says ...; Ada Marlow is only passing on this meaning, has not read the agreement, and has not independently checked Bo Winters’s account.` It is held by the same validation guard before semantic verification.

The frozen replay in `tmp/v66-report-cleaning-reproduction.json` confirms both main-report candidates fail `hasReportUncertainty`, with the exact generated texts preserved. This is a deterministic false hold, not a semantic judgment. The source and candidates use **checking** the account: the initial form says `has not read ... or independently checked this account`; the repair says `has not read ..., and has not independently checked ...`. Neither is a claim of universal nonverification, and neither should be rewritten as having failed to receive confirmation. The current closed recognizer handles `confirmed/verified` in its two-part branch and the newly added three-part checked list, but not these ordinary two-part checked forms.

Because only the delivery denial is retained, all eight report-view queries have `no_eligible_evidence`; the denial is correctly irrelevant to the focused latch-service question. The retained-set loss is material even though the surviving denial is faithful.

### `v20-held-hypothesis` — complete retention; 8/8 faithful answers

Rows 7–10 retain one complete hypothetical record. It preserves Ada's introducing act, the three-month mesh-screen premise, the consequence only under that premise, Ada's personal lack of knowledge of actual requirements, and absence of an actual missed inspection.

All eight answers (generation/verifier rows 12–42) preserve those meanings. English copy paths and Russian translations retain the group/personal experiencer as Ada (`ей неизвестны`), rather than converting it to global absence. No calendar event is invented. The report marks four results partial because of the query/view accounting, but their public prose is source-faithful.

### `v20-held-counterfactual` — complete retention; 5/8 answers, two false holds and one correct hold

Rows 43–47 retain both required records: Ada's actual refusal/nonpurchase and the counterfactual fifth-year wheel-hub coverage if she had bought the extension. The source's nonpurchase and no-current-coverage qualifications remain explicit. Ownership places both records without a routing hold.

The five published answers (`q0,q1,q2,q4,q5`) are faithful. They preserve the false purchase antecedent, fifth-year repair benefit, nonpurchase, and unrealized/not-current status. Citing both records in `q1` is supported and does not promote the rejected extension.

- `q3`, EN query → RU answer, explicit view (draft row 58): correctly held by the attribution guard. It changes the protected source name `Ada Marlow` to `Ада Марлоу`. The substantive counterfactual is faithful, but the generated draft violates exact named-reference preservation, so this is a correct bad-draft rejection and an answerable-case coverage loss.
- `q6`, RU → EN, explicit (draft row 66): false discourse hold. `Ada Marlow described an unrealized option in which purchasing ... would have covered ...` is a grammatical counterfactual and preserves nonpurchase/no-current-coverage. Frozen `hasNominalCounterfactual` returns false, and the older discussion-view vocabulary lacks `unrealized/would`, even though the separate noncanonical status check understands `would have`.
- `q7`, RU → RU, explicit (draft row 68): false discourse hold. `нереализованный вариант, при котором после покупки ... ремонт ступицы ... в пятом году был бы покрыт` preserves the same counterfactual. The new nominal helper returns false because its bounded noun phrase permits only ten tokens before `был бы`; this faithful wording has eleven.

The new nominal mechanism was therefore present but did not cover these two ordinary generated realizations.

### `v20-held-exclusion` — complete retention; 4/8 faithful answers and four correct role holds

Rows 69–72 retain the complete asserted exclusion: the warranty does not cover the cracked support plate; this record does not settle drive-shaft-repair coverage; it does not assert silence of the whole contract. The English copy answers `q0,q2,q4,q6` reproduce that faithful proposition. `support plate` is the retained translation of source `опорная пластина`; the question's `base plate` does not override the original.

All four RU drafts are correctly held before the semantic verifier by `coverageRolesSupported`. Their construction says the drive shaft is `покрывается ли ремонтом приводного вала`, making repair the covering instrument instead of making drive-shaft repair the covered service. For example, the language-check input at row 78 includes `эта запись об исключении не отвечает на вопрос о том, покрывается ли ремонтом приводного вала`. The language is Russian, but its semantic roles are wrong. The tightened V66 unanswered-question floor therefore exercised as intended and protected four unsupported outputs. These are correct bad-draft holds, but the original case remains answerable in Russian with `о покрытии ремонта приводного вала` or another faithful construction.

### `v20-held-assistant` — complete retention; 7/8 answers, two accepted mechanism losses

Rows 101–104 retain the complete assistant report: tentative monthly connector **continuity** testing, neither reading the service agreement nor verifying the interpretation, and a possible contractual term rather than an obligation. Attribution and personal epistemic scope are intact.

Four English answers and Russian `q7` are faithful (five faithful published answers total). Russian `q1` and `q5` are accepted errors: both render `connector continuity test` as `проверка целостности разъёма`, an integrity check of the connector rather than electrical continuity testing. This loses/generalizes the tested mechanism. The row-120 verifier independently notices exactly this loss for the identical phrase in `q3` (`object_and_mechanism.relation="generalized"`) and correctly rejects that draft; rows 112 and 128 inconsistently mark the same phrase preserved, allowing `q1` and `q5` to publish. Positive semantic booleans on those rows do not make the translations source-faithful.

Russian `q7` says `проверка целостности цепи разъёма`, which retains the circuit-continuity sense sufficiently. All published answers preserve the assistant as the tentative experiencer and preserve both personal limits and contractual-term status.

### `v20-held-fiction` — complete retention; 6/8 faithful answers and two correct language holds

Rows 137–141 retain both Ada's actual proposal to discuss and the complete fictional promise. The six published answers preserve Ada as proposer, Vulpine Mutual as fictional promisor, fictional Bo as recipient, free hinge-pin replacements, the first eleven days of ownership, fictional-only scope, and absence of a real contract. They do not claim a performed discussion or real promise.

`q1` and `q3` (EN query → RU answer) fail in the language checker at rows 145/150. Their raw Russian prose leaves ordinary `hinge-pin` untranslated; `review_tokens` explicitly contains that term and `compliant=false`. These are correct language holds, reported at the operation layer as `generation_failed`, and source-true answer coverage losses. Other Russian answers translate the component as `штифт петли`, demonstrating the requested target-language form without changing protected names.

### `v20-held-undated` — empty retention; 0/8 answers

Initial extraction row 165 produces a faithful complete candidate: Ada actually proposes reviewing repair terms next month relative to her undated source entry; the calendar month cannot be determined; she has accepted no plan and arranged no meeting. It is held for `time_unresolved`. Repair row 167 changes `undated source entry` to `original source entry rather than after processing`, keeps unknown calendar date, and preserves all other content, but is held by the same guard. No semantic-verifier or placement call follows.

Frozen helper reproduction gives, for both exact candidates, `hasSourceRelativeAnchor=false` and `hasUnknownReferenceClock=true`. Thus the failing subguard is specifically source-relative anchoring, not unknown-clock recognition and not source semantics. The V66 `первоначальной записи` addition is not exercised because generation emits English `month after her undated/original source entry`. Both candidates express the source relation faithfully; this is a deterministic lexical false hold. With no retained record, all eight queries return `no_eligible_evidence`.

### `v20-held-alternatives` — complete retention; 8/8 faithful answers

Rows 168–171 retain a single complete coupled proposition. It preserves Ada's consideration of both tentative hypotheses, bent guide versus loosened belt fastening, lack of supporting evidence for either, and Ada's personal nonselection. All eight copy/translation answers preserve those elements and do not turn either cause into fact. The repair-context/metadata changes were not exercised because initial extraction was already complete and valid.

## Loss inventory by stage

- **Retention validation false holds:** main report initial and repair (`hasReportUncertainty`); undated proposal initial and repair (source-relative clock). These cause 16 downstream `no_eligible_evidence` results. The report retains its independent denial; the undated case retains nothing.
- **Correct deterministic answer holds:** counterfactual `q3` protected-name/attribution error; exclusion `q1,q3,q5,q7` coverage-role inversions.
- **False deterministic answer holds:** counterfactual `q6,q7` counterfactual wording floors.
- **Correct semantic rejection:** assistant `q3`, where `connector continuity test` became connector integrity checking.
- **Correct language-policy holds:** fiction `q1,q3`, untranslated ordinary `hinge-pin` in otherwise Russian prose.
- **Accepted source errors:** assistant `q1,q5`, the same continuity-to-integrity mechanism loss that was rejected in `q3`.
- **Availability/routing:** no provider/schema availability failure and no ownership failure. The two `generation_failed` report outcomes are typed language mismatches, not bad responses.

## Bounded next corrections supported by this run

1. Replace the duplicated two-part/three-part report-uncertainty regex alternatives with one bounded shared-negative predicate-list recognizer. It should preserve the distinction among reading an agreement, checking an account/report, and confirming/verifying an interpretation; accept `has not read X or independently checked Y` and `has not read X, and has not independently checked Y`; keep exact actor/object and terminal clause boundaries. Add positive controls from both exact V66 candidates and negatives with a positive second finite auxiliary, new actor, wrong object, quotation, or retraction. This remains a presence floor before mandatory full-source semantics.
2. Align the two counterfactual status floors around a shared bounded structural contract. Add English `unrealized ... would have` and raise/reshape the Russian `при котором` span so ordinary source-bound repair phrases are not rejected solely by an incidental ten-token count. Keep explicit unrealized/counterfactual antecedent, conditional morphology, same-clause boundaries, and semantic rejection of overbroad active coverage.
3. Make generated undated proposals use an already recognized canonical source-relative form, or add one bounded English form for `next month means/is the month after the undated/original source record/entry, not processing`. Require the record noun, unknown date, and same-clause relation; do not accept an arbitrary later event or processing timestamp. Mandatory semantic verification remains unchanged.
4. Strengthen the existing source-mechanism alignment instruction for translations so `continuity test` remains electrical/circuit continuity (`проверка целостности цепи` or faithful equivalent), not generic physical connector integrity. This is better addressed by the existing per-record object/mechanism comparison and generation contract than by a product-specific dictionary. Add a paired verifier regression showing the same phrase cannot be accepted in one coordinate and rejected in another.
5. Keep the coverage and language floors that correctly rejected the Russian repair-as-coverer and untranslated-component drafts. Improve generation toward the already documented source-bound nominal and ordinary-vocabulary translation; do not relax those gates or add a retry.

The 38/64 production rate, two accepted mechanism errors, and 6/8 complete retained sets justify deferring a full fresh V21 held-out trial. No replacement V66 run is warranted.
