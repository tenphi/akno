# V71 selected-probe source-first forensic review

## Scope and independent result

I reviewed all eight selected V21-development cases and all 64 coordinates from the finalized packet, report, and 241-row trace, using the frozen `tmp/core-v71` helpers only for deterministic stage reproduction. I read original sources before runtime verdicts and did not inspect independent grades or fresh held-out inputs.

The run retained 9 records. Seven of eight case-level retained sets are complete; `v20-held-report` lost its main reported-service record and retained only the separate delivery denial. All retained records have source-supported kind, commitment, disposition, polarity, attribution, and temporal metadata. The new polarity comparison correctly records the surviving personal delivery denial as negated and the other governing propositions as intended.

The report contains 50 non-null public answers and 14 nulls. I find one clear accepted material error: assistant query 5 translates connector **continuity** as generic connector **integrity**. The remaining 49 produced answers are source-entailed. Under the stricter focused-answer reading described below, four fictional-promise answers are incomplete because they omit Ada's proposal-to-discuss act; that is an explicitly preserved interpretive dispute rather than an unsupported proposition. There are no accepted language or promotion errors, operation/transport/schema availability failures, cap failures, or source-byte changes.

## Retention

### Report: incomplete, 1/2 records

Trace row 2 initially generates a correctly negated delivery-denial record and a main report candidate. The main candidate preserves Bo's report, Ada's relay, workshop permission, latch-gap measurement, the nonreplacement contrast, unread agreement, no independent checking, and personal nonverification. Its wording `not to change the latch` is broader than the source's `not replace`, so the initial wording also has a semantic precision concern. The structural repair at row 4 corrects that to `not to replace the latch` and otherwise remains source-faithful.

Neither main candidate reaches semantic verification. Frozen helper replay returns `hasReportUncertainty(...) === false` for both exact texts while the full original source returns true. The initial ends its recognized negative pair with the separate continuation `and she did not verify this herself`; the repair uses `... independently checked Bo Winters’s account, or personally verified this meaning`, a faithful shared-negative list that falls outside the helper's closed final-check forms. Row 5 verifies only the delivery denial and independently returns `source_selected_polarity: negated`; row 6 routes that survivor. This is a local false hold and a material retention omission, not semantic rejection or provider unavailability.

Because the only survivor is answer-eligible/current rather than a report-view record, all eight report queries return `no_eligible_evidence`. They are justified runtime abstentions given the retained set, but source-level coverage losses because the original provided adequate report evidence.

### Other seven cases: complete and correctly typed

- Hypothesis extraction/verifier rows 8–10 preserve the quarterly mesh-screen assumption, its coupled hypothetical violation, Ada's actual-requirements knowledge limit, and denial of an actual missed check. Polarity is affirmed for the existence/content of the hypothetical analysis.
- Counterfactual rows 44–49 retain both Ada's affirmed rejected decision and the affirmed counterfactual record. The repair adds the named antecedent and actual nonpurchase without changing the unrealized scope. Both verifier polarities are affirmed; `rejected` remains a disposition rather than negated polarity.
- Exclusion rows 73–75 retain the cracked-support-plate denial, record-limited nonresolution of drive-shaft repair, and no whole-contract-silence claim with negated polarity.
- Assistant rows 108–110 preserve connector **continuity**, monthly frequency, tentative possible-contract-term scope, non-obligation, assistant attribution, and both personal epistemic limits with affirmed polarity.
- Fiction rows 144–147 retain Ada's affirmed proposal separately from the affirmed hypothetical promise, including Vulpine Mutual, fictional Bo Winters, free hinge-pin replacements, eleven-day ownership period, fiction-only existence, and absence of a real contract.
- Undated rows 172–174 preserve Ada as proposer; next month relative to the original recording rather than processing; unknown recording/calendar date; tentative timing; no accepted plan; no meeting; and proposal-only status. Polarity is affirmed.
- Alternatives rows 207–209 preserve actual consideration, both preliminary hypotheses, Ada's personal nonselection, and the evidence absence for both with affirmed polarity.

Source bytes are stable in all eight report cases, and no ordinary hypothetical neighboring prose is promoted.

## Published-answer audit

### Hypothesis: 8/8 faithful

Generation rows 13, 17, 21, 25, 29, 33, 37, and 41 produce complete-record copy/translation blocks, followed by positive semantic verification. Every public answer preserves the actual hypothetical-analysis actor, quarterly mesh-screen assumption, consequence only under that assumption, Ada's personal lack of knowledge, and no-actual-missed-check qualification. `complete`/`partial` report labels do not reflect a material omission here.

### Counterfactual: 6 published faithful; two holds

- Query 0, generation row 51, selects both counterfactual and rejected-decision records. It preserves nonpurchase but omits Ada's explicit `declined` act. Its counterfactual wording is sound, but selecting the complete decision record makes the rejection omission material. The local `discourse` hold is justified.
- Query 1, row 53, selects only the counterfactual record and faithfully describes an unrealized purchase/coverage condition, nonpurchase, and no current coverage. Frozen `hasNominalCounterfactual` replay returns false for the exact Russian draft. This is a false local `discourse` hold.
- Queries 2–7 publish faithful focused answers from the counterfactual record (generation/verifier rows 55–71). They retain conditional fifth-year wheel-hub coverage, actual nonpurchase, unrealized status, and no current coverage. In query 5, `приобретённое` remains inside `нереализованный вариант ... покрывало бы`, and the following clause explicitly denies acquisition; it does not assert actual purchase.

### Exclusion: 7 faithful; one justified hold

Queries 0–6 (rows 78–103) faithfully preserve the cracked-support-plate exclusion, uncertainty specifically about drive-shaft repair, and the limit against whole-contract silence. Query 7's row-106 draft says `покрывается ли ремонтом приводного вала`, grammatically making drive-shaft repair the means that covers something rather than the service whose warranty coverage is unresolved. It fails the local semantic/coverage-role guard before verifier. This is a justified bad-draft hold.

### Assistant: 6 faithful, one justified verifier hold, one accepted property error

Queries 0, 1, 2, 4, 6, and 7 preserve monthly connector **continuity**, tentative possible contractual status, non-obligation, assistant attribution, and both personal limits.

Query 3's row-125 Russian draft changes `continuity` to `целостность` (integrity). Row 126 correctly marks `tested_property` generalized, sets `action_arguments_preserved: false`, and withholds it.

Query 5's row-133 public draft makes the same material change as `ежемесячный тест целостности разъёма`. Row 134 explicitly paraphrases the candidate as a `connector integrity test` but sets `tested_property` to `not_selected`, leaves all booleans true, and publishes it. Continuity is the electrical property under test; generic integrity can include physical or broader condition. This is one accepted tested-property/source-specificity error and an inconsistent application of the V70 property audit.

### Fiction: seven produced, one language hold; four-way focused completeness dispute

Query 3 fails during the ModelClient language check: trace row 157 exposes the Russian draft containing untranslated ordinary `hinge-pin`, the checker returns false, and row 158 records `language_mismatch`. This is a justified language hold, not a transport failure.

Queries 0, 1, and 6 cite both records and explicitly preserve Ada's proposal to discuss plus the complete fictional promise and fiction/no-contract limits. Queries 2, 4, 5, and 7 cite only the hypothetical promise record and accurately state the promise, parties, object, eleven-day period, and fictional-only scope. They say `According to Ada`/`По словам Ada` rather than that Ada **proposed discussing** it.

On a strict reading of the focused question (“what promise did Ada propose discussing?”), those four answers omit a material selected action and are incomplete: outer attribution does not establish proposal agency. On a narrower object-answer reading, they correctly supply the requested promise content and need not repeat the question's proposal predicate. I preserve the former as my stricter completeness judgment while marking the issue disputed; none of the four asserts a false proposition.

### Undated: seven faithful; one false local hold

English queries 0, 2, 4, and 6 copy the complete retained record faithfully. Russian queries 3, 5, and 7 exercise the new structured `translated_record` branch and publish the exact server-joined segments. They preserve tentative timing, Ada's proposal, no plan acceptance, no meeting, proposal-only scope, next-month direction, original-record clock, processing contrast, and unknown calendar date. They introduce no server-authored semantic prose.

Query 1's row-181 structured draft is also source-faithful, but its anchor segment says `Этот интервал отсчитывается от времени первоначальной записи без даты`. Frozen replay on the complete joined text returns `hasDeicticTime: true`, `hasSourceRelativeAnchor: false`, and `hasUnknownReferenceClock: true`. The contract asked for the selected interval as grammatical subject; `Этот интервал` is a clear anaphoric reference after the immediately preceding next-month sentence but falls outside the closed source-relative grammar. It is a false local `discourse` hold. No semantic verifier is called.

### Alternatives: 8/8 faithful

Rows 212–241 preserve both exact alternatives, their competing preliminary status, Ada's actual consideration and personal nonselection, and lack of evidence for both. No answer promotes either cause.

## Counts and stage classification

- Complete retained sets: **7/8**; correctly typed surviving records: **9/9**.
- Retrieval/public production: **50/64 non-null**. All eight report losses arise from missing report retention, not answer generation.
- Definite faithful false holds: counterfactual query 1 and undated query 1 (**2**).
- Justified bad-draft holds: counterfactual query 0, exclusion query 7, assistant query 3, and fiction query 3 (**4**).
- Source-level coverage losses caused upstream: all eight report queries (**8**).
- Accepted clear material errors: assistant query 5 (**1**, continuity → integrity).
- Other produced answers source-entailed: **49**; four of those have the disclosed fiction focused-completeness dispute.
- Operation/schema/provider availability failures: **0**. The fiction language rejection is typed and justified; the local/semantic holds all retain usable structured responses.
- Source-byte changes or factual promotion: **0**.

## Bounded next scope supported by this run

1. Repair the report-uncertainty presentation boundary structurally: accept faithful same-actor negative reading/checking lists with a separately explicit personal nonverification predicate, or direct generation/repair to emit those limits as short complete sentences. Keep report object, actor, negation, clause endings, full-source verification, one repair, and the existing cap intact.
2. Make an explicitly selected tested property mandatory whenever a cited source/answer anchor contains a property-bearing test phrase. Row 134 shows that free verifier classification can choose `not_selected` despite its own comparison recognizing continuity versus integrity. The fix belongs in the same verifier call/schema consistency, not a synonym dictionary or extra pass.
3. Preserve the structured clock approach but either require the exact interval noun in the anchor field at schema-contract level or recognize a tightly bound anaphor only when the preceding segment supplies the same deictic interval. The latter needs cross-segment adjacency and negative controls; no broad `this interval` clock admission is justified.
4. Keep counterfactual citation discipline: a block selecting the rejected-decision sibling must state rejection; a block selecting only the complete counterfactual record should not inherit that unrelated presentation obligation.

These findings defer a fresh held-out trial: the selected run has one accepted material property error and a complete-retention loss, independent of the disputed fiction completeness reading.
