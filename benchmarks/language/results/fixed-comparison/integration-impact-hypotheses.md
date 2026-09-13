# Frozen integration impact hypotheses

## Scope

This is a source-first mapping of Candidate A/V77's completed **run 1** failures to the four changes frozen in
`tmp/akno-integration` at `963bf68e3cd07c687007dceaadb4ebb0434613e6`. It uses the final run-1 source grades,
their public packets, and the relevant V77 trace paths. It does not use partial run-2 outcomes and does not select
a comparison winner.

The distinction throughout is deliberate:

- **reachable** means the frozen change executes on, or changes the model contract for, the observed failure path;
- **control-demonstrated** means deterministic or stubbed tests establish the intended routing/rejection behavior;
- **behaviorally fixed** would require the frozen integration to improve the source-graded case in its declared
  run. No model-behavior recovery below is classified as behaviorally fixed before that run.

The frozen runtime source matches the named commit. The four changes preserve the existing 400-unit retained-text
bound, source/frame ownership, language checks, mandatory semantic verdicts, one structural repair, and fail-closed
publication.

## What the four changes can establish before a run

| Change | Observed failure family it targets | What is already demonstrated | What remains unproved |
| --- | --- | --- | --- |
| **Report concern direct verifier** | A source-faithful generated report fails the finite local report-limit recognizer and is either held or needlessly rewritten. | An otherwise-clean generated `source_report` with empty relations bypasses report-text repair, retains its exact current text, and must receive a candidate-owned exact source/current report-limit audit in the existing verifier. Malformed, absent, foreign, inconsistent, or semantically negative audits remain atomic holds; model-free/provided candidates remain strict. | That the live verifier will correctly accept each faithful report and reject each real omission. This change removes the premature local authority; it does not guarantee retention. |
| **Retrieval-unit and neutral-activity instruction** | Extraction splits a proposition from governing knowledge-state limits, assigns the record's one qualification from an outer act, or invents a performed activity from an invitation/provenance phrase. | The replacement contract is present once in extraction and retention verification. Stubbed controls exercise a complete question unit, coupled hypotheses, independent neighbors, and semantic negatives without changing schema, filters, calls, or caps. | Model compliance. This is prompt-level behavior: it has not yet shown that Luna will form the desired record or metadata on these sources. |
| **Exact selected source name** | Complete-record translation changes an exact visible named source. | The post-materialization local guard rejects omission, transliteration, joined/expanded spellings, and combining-mark changes for an exact non-generic name already visible in the selected qualified line. It does not import a metadata-only or sibling name. | A useful replacement answer. The demonstrated safety effect may convert the two former errors into nulls if generation repeats them. |
| **Prose category heading** | Ordinary prose projection treats explicit report or preliminary-hypothesis sections as factual because their headings are not classified. | A bounded heading grammar maps report/retelling categories to `reports` and preliminary/tentative alternatives to `discussion`; the projection version is bumped so derived state is rebuilt. Controls distinguish category headings from factual titles such as report numbers or versioned dimensions. | This is separate from managed-retention and answer usefulness. It fixes the observed ordinary projection category, not a retained record or answer-stage loss. |

## Legacy run-1 mapping

Candidate A has 17 non-useful writable answer coordinates in this block: 16 from two wholly held retentions and one
downstream local answer hold. The required read-only case is excluded.

| Case | V77 run-1 failure and trace stage | Frozen change reach | Pre-run status |
| --- | --- | --- | --- |
| `v3-dev-alternatives` | Extraction says Ada **is discussing** the two hypotheses where the source invites their consideration. The verifier rejects proposition, actor/action, and qualification at trace 345–355; all 8 coordinates are null. This is a correct hold of unsafe generated framing, followed by complete source loss. | **Retrieval-unit / neutral activity:** direct prompt target. The new contract says an invitation or instruction does not establish a performed activity and requires both tentative alternatives and their common limits in one independently readable unit. | Reachable, prompt-only, **not demonstrated fixed**. A safe linked representation exists in another frozen arm, but V77 did not generate it; that precedent is not a result for this integration. |
| `v3-dev-undated` | Retention is complete. One Russian complete-record draft preserves the proposal, source-entry clock, unknown date, nonacceptance, and no scheduled review, but the local answer discourse/clock floor rejects it before semantic verification at trace 711–717. Seven of 8 coordinates publish. | None. | **Untouched.** It remains a source-faithful local false hold outside the four changes. |
| `v9-held-report` | The initial candidate preserves Bo's reported warranty statement, Ada's recording act, and Ada's lack of personal verification. The local report floor rejects it and its repair at trace 795–809; verification is null and all 8 coordinates are lost. | **Report concern:** exact target. The initial otherwise-clean report now avoids report-text repair and reaches the mandatory verifier with owned report-limit witnesses. The retrieval-unit prose also restates report co-location, but it is not needed to explain this observed local floor. | The premature local hold/rewrite path is **control-demonstrated fixed**. Live semantic acceptance and the 8-coordinate recovery are **unproved**. |

All other writable legacy Candidate A cases have complete retention and useful answers. `v9-held-admission` remains a
required read-only abstention and is intentionally untouched.

## Recent run-1 mapping

Candidate A has 44 non-useful writable answer coordinates in this block. Ten are nonnull published errors: two
exact-name violations and eight answers that omit coupled question qualifications. The other 34 are nulls.

| Case | V77 run-1 failure and trace stage | Frozen change reach | Pre-run status |
| --- | --- | --- | --- |
| `v22-held-nested-report` | Initial extraction preserves the outer/inner reporters, grounding-contact resistance check rather than replacement, and Ada's unseen/unchecked limits. The finite report floor rejects both initial and repaired forms; no semantic verifier runs (1653/1658, repair 1659/1664, hold 1665). Extraction separately omits the independently true fact that Ada had not packed her device. All 8 answers are null, and ordinary projection also admits the report section as factual. | **Report concern:** direct path for the faithful report candidate. **Retrieval unit:** reinforces the complete reporter chain and limits but does not supply the omitted independent fact. **Prose heading:** directly covers the ordinary report heading. | Direct-to-verifier routing and ordinary classification are **control-demonstrated**; report acceptance is unproved. Even successful report retention would leave the **complete retained set incomplete** unless the model also emits the independent packing fact. |
| `v22-held-counterfactual` | Extraction emits the asserted non-enrollment and a faithful counterfactual benefit. The verifier rejects the counterfactual because `action_arguments_preserved=false`: its passive plan-nonenrollment clause omits Ada as actor, although the admitted sibling preserves that actor (1908/1913, verdict 1914/1917, partial retention 1926). All 8 focused coordinates are lost. | None. | **Untouched semantic false hold.** It already reaches the existing verifier; neither report escalation nor representation/name/heading changes alter that per-candidate actor judgment. |
| `v22-held-coverage-exclusion` | Retention and selection are complete. Two of 8 complete-record Russian coordinates publish `Ада Марлоу` instead of the exact visible `Ada Marlow` (case begins near 2013; affected public paths are within 2065–2132). Their propositions and qualifications otherwise remain faithful. | **Exact selected source name:** exact deterministic target. | The former outputs are now **locally rejected before semantic verification**, so the accepted spelling error is control-demonstrated fixed as a safety defect. Useful replacements are unproved; the previous 2 errors may become 2 nulls. |
| `v22-held-assistant-speculation` | The initial report is complete and faithful, including the tentative optical-shutter check and assistant's unread/unchecked limits. The report recognizer misses `checked this guess`; repair corrupts the proposition to end `rather than an13.`, then the local floor holds it (2210/2215, repair 2216/2221, hold 2222). All 8 answers are null. Ordinary projection also admits the assistant-report section as factual. | **Report concern:** preserves the faithful initial candidate and sends it directly to semantics instead of generating the malformed repair. **Prose heading:** covers the ordinary assistant-report category. | Avoiding the destructive rewrite and fixing ordinary category scope are **control-demonstrated**. Whether the verifier accepts the initial report and recovers answers is unproved. |
| `v22-held-fictional-example` | The complete hypothetical loan record is retained. The four explicit-discussion coordinates answer correctly; four inferred-view coordinates return `no_eligible_evidence`. | None. | **Untouched view/eligibility loss**: 4 null coordinates. The observed nonnull answers preserve the exact source name, so the new name guard is not a recovery mechanism here. |
| `v22-held-competing-hypotheses` | One readable record contains both causes, nonselection, lack of evidence, and unconfirmed rattle, but it is typed asserted/active. Six discussion-view coordinates exclude it before generation; the two factual-view coordinates copy/translate it successfully (retention 2614/2616; nulls 2628, 2633, 2644, 2649, 2696, 2701; accepted 2665–2670 and 2680–2685). Ordinary projection also treats its preliminary-versions heading as factual. | **Retrieval unit / neutral activity:** exact prompt target for typing commitment from embedded hypotheses while keeping any source-established outer consideration act readable. **Prose heading:** exact ordinary projection target. | Ordinary classification is control-demonstrated. Retention metadata/view recovery is **prompt-only and unproved**; no selection-filter code changed. |
| `v22-held-open-question` | V77 retains a question record and a separate record saying Ada lacks the answer and the note establishes neither polarity. Question-view selection exposes only the first (retention 2739/2741; selection 2747), so complete-record copy/translation and verification operate on an incomplete selected unit through 2886. All 8 answers are source-entailed but omit both governing limits. | **Retrieval unit:** exact prompt target requiring the question, personal lack of answer, and record-level neither-polarity boundary in one independently retrievable record. | Reachable but **prompt-only and unproved**. The current two-record retained set is source-complete, so this aims to fix selection consistency and public qualification completeness rather than source coverage. |
| `v22-held-rejected-plan` | The focused rejected plan is retained and all 8 answers are useful. Full retention omits the independent no-reserved-appointment/no-transport fact after a placement ownership/routing hold. | The retrieval-unit contract says an independently true neighbor remains separate and must not be dropped, but it does **not** change the observed placement ownership path. | **Not counted as fixed or expected answer recovery.** Complete-retention omission remains an unresolved independent-neighbor defect. |

The recent read-only admission remains a required hold. `v22-held-conditional-hypothesis` and
`v22-held-relative-unknown-date` are already complete/useful in run 1 and are not impact targets.

## Cross-case accounting by frozen change

These counts are observed coordinates whose failure path the change can reach, not predicted gains.

| Change | Directly reachable run-1 cases | Observed answer coordinates on those failed paths | Deterministic pre-run effect |
| --- | --- | ---: | --- |
| Report concern direct verifier | `v9-held-report`, nested report, assistant speculation | 24 null coordinates | Removes the premature report-text rewrite/local-final-authority and requires the existing verifier. It does not guarantee any of the 24 become useful. |
| Retrieval-unit / neutral activity | legacy alternatives, competing hypotheses, open question | 8 + 6 + 8 = 22 non-useful coordinates | Changes extraction/verifier instructions only. No coordinate recovery is deterministic. |
| Exact selected source name | coverage exclusion | 2 erroneous coordinates | Prevents those two exact-name errors from publishing; usefulness may remain unchanged or decrease. |
| Prose category heading | nested report, assistant speculation, competing hypotheses | Three ordinary-inspection case failures in run 1 | Reclassifies the three observed ordinary heading shapes after projection rebuild. This has no direct answer-coordinate credit. |

There is overlap at the case level, especially for the report cases, but not a sound basis for adding the rows as an
expected score gain. The report change affects managed retention while the heading change affects the parallel
ordinary prose projection. The retrieval-unit change can alter generated record boundaries/labels but cannot repair
an answer or record that never reaches that model stage.

## Failures outside the frozen changes

### Independent-neighbor retention omissions

- `v22-held-nested-report`: extraction omits Ada's separate not-packed fact. The report concern can preserve the
  focused nested report, but candidate-scoped verification cannot prove or restore batch-wide source coverage.
- `v22-held-rejected-plan`: the independent no-reserved-appointment/no-transport statement is omitted after its
  placement ownership/routing hold. All focused answers remain useful, but the retained set is incomplete. The new
  semantic-unit prose does not change placement ownership.

These are complete-retention defects even when the focused query is fully answered. They must remain visible in the
integration grade rather than being inferred away from answer usefulness.

### False holds and downstream losses

- `v3-dev-undated`: one source-faithful Russian answer is rejected by the inherited local clock/discourse floor.
- `v22-held-counterfactual`: a source-faithful counterfactual is rejected by the existing semantic verifier's
  per-candidate actor reading. The separately retained direct non-enrollment does not satisfy that verifier object.
- `v22-held-fictional-example`: four coordinates are lost at view/qualification eligibility before generation.

None is changed by this integration. A successful integration may therefore still carry these nulls.

### Availability

There are **no Candidate A run-1 case availability failures**, no retention availability failures, no query degraded
reasons, and no failed transport/schema outcome behind these losses. The observed nulls are typed local holds,
semantic holds, `no_eligible_evidence`, `empty_draft`, or one `draft_rejected`. They must not be credited as correct
semantic rejections merely because they fail closed.

### Accepted output and projection errors

- Two coverage-exclusion coordinates change the exact source name. The name guard addresses publication safety but
  does not guarantee a useful answer.
- Eight open-question coordinates are source-entailed but qualification-incomplete. The retrieval-unit contract is
  the only frozen change that can prevent this at representation time; its effect remains unproved.
- Three recent run-1 ordinary inspections (`nested-report`, `assistant-speculation`, and
  `competing-hypotheses`) admit explicitly nonfactual heading scope as factual. The heading classifier addresses
  this deterministic projection defect independently of managed answer scores.
- The final grades identify no other Candidate A run-1 accepted source, qualification, language, or promotion error.

## Bounded selection rationale

The four-change integration is source-based rather than score-selected: each change corresponds to a distinct
completed run-1 failure family, and each keeps the existing fail-closed authority boundaries. It is also small enough
to falsify cleanly:

- report cases should at least reach the mandatory verifier without report-only rewriting;
- open questions and competing hypotheses should form retrievable units if the prompt correction works;
- altered selected source names must not publish; and
- the three category headings must no longer project as ordinary factual evidence.

Those are hypotheses for the declared integration run, not causal improvement claims. The run must still report the
untouched clock, counterfactual, fictional-view, placement-ownership, and independent-neighbor losses, as well as any
new nulls caused by stricter name enforcement. No partial run-2 result is needed to justify or revise this map, and
this review recommends no further runtime iteration.
