# V48 held-out forensic review

## Scope and method

This is a read-only audit of the 22 held-out case-runs in:

- `tmp/language-v19-output-packet-v48.json`, restricted to records whose `source.split` is `held-out`
- `bench-results/language-held-out-v48.json`
- `bench-results/language-held-out-v48-trace.jsonl`

I compared the original source, retained records, generated answers, typed qualifications, and trace decisions. I did not read grading receipts, inspect other trial write-ups, call a provider, or modify runtime or test code. “Produced” below means a non-null production result; it does not by itself mean that the answer was useful or faithful.

The held-out set contains 11 cases in each of two runs, eight answer probes per case-run: 176 answer rows total. Ten cases per run are writable. The remaining read-only admission case correctly retains nothing.

## Counts by run

| Measure | Run 1 | Run 2 | Total |
| --- | ---: | ---: | ---: |
| Writable case-runs | 10 | 10 | 20 |
| Retained records with source-faithful meaning | 9 | 9 | 18 |
| Retained sets complete for material source claims | 9 | 9 | 18 |
| Retained case-runs both faithful and complete | 8 | 8 | 16 |
| Non-null answer rows | 63/88 | 64/88 | 127/176 |
| Fully faithful and materially complete answers under the strict audit below | 53 | 53 | 106 |
| Core answer useful but missing the coupled hypothetical consequence | 1 | 2 | 3 |
| Accepted rows with an unequivocal semantic or language defect | 7 | 8 | 15 |
| Accepted rows with disputed temporal-qualification attachment | 2 | 1 | 3 |
| Null rows | 25 | 24 | 49 |

The 106 “fully faithful” count applies a strict reading to three undated-proposal answers discussed below. If those three phrasings are accepted as attaching tentativeness only to timing or status, the fully faithful counts become 55 in run 1 and 54 in run 2. I preserve the stricter finding because the generated wording itself leaves the modifier attached to the asserted proposal or review action. This is a forensic disagreement about the text, not a change to any target or threshold.

## Retention findings

The retained content is strong for the hypothesis, counterfactual, open question, exclusion, fiction, rejected offer, undated proposal, alternatives, and the principal nested-report claim. It preserves such distinctions as unrealized versus active coverage, a question versus an answer, a fictional promise versus a real agreement, rejection versus an adopted shipment plan, and an unknown source-relative year versus a calendar year.

Two recurring defects remain:

1. In both `v19-held-report` runs, the independent source claim that no collection was booked is extracted but held rather than written. The placement trace gives `routing_uncertain` and `ownership_uncertain`. The retained principal report is faithful, but the retained set is incomplete. The structural trigger is unresolved ownership/coreference around “my device” despite the adjacent invented Zephyr identity.
2. In both `v19-held-assistant` runs, the source says that the assistant personally has not examined the contract or confirmed the assumption. The retained prose changes this to an agentless statement such as the contract “has not been examined” and a generally “unconfirmed” reading. That loses the epistemic actor and broadens a statement about the assistant’s access into a statement about the state of the evidence. The concepts remain present, so this is a source-entailment error rather than a simple omission.

The read-only admission case correctly produces `no_writable_destination` and no retained record in both runs.

## Accepted answer defects

### Russian exclusion-role reversal: six rows

Six accepted Russian answers invert or garble the grammatical roles in the warranty-coverage question:

- Run 1: English-to-Russian inferred, Russian-to-Russian inferred, and Russian-to-Russian explicit.
- Run 2: English-to-Russian explicit, Russian-to-Russian inferred, and Russian-to-Russian explicit.

Examples include `покрывается ли ремонтом двигатель вентилятора` and `покрывается ли ремонтом двигателя вентилятора гарантия`. The source says that the support-bracket exclusion does not determine whether **repair of the fan motor is covered by the warranty**. These outputs instead make the fan motor covered by a repair or the warranty covered by a fan-motor repair. The relevant nouns all survive, but their semantic roles do not. The verifier accepted these rows as preserving proposition and actor/action despite having the matching source frame.

Run 2 English-to-Russian inferred says `покрывается ли ремон двигатель вентилятора`. I do not count this seventh row as a role reversal because the intended subject remains recoverable. I do count it as an accepted language defect: `ремон` is malformed Russian and the coverage relation is not expressed grammatically. A more permissive reader may recover the intended meaning, but recovery does not make the generated language correct.

### Assistant epistemic-subject loss: six rows

All six accepted assistant answers omit that the assistant personally had not examined the contract. Run 1 accepts all four explicit-view language pairs; run 2 accepts the two explicit answers whose output is English. They preserve the preliminary reading, quarterly status-display check, and lack of establishment, but turn personal non-examination/non-confirmation into passive or general uncertainty.

This is material because “I have not checked this source” and “this source has not been checked” have different entailments. The trace confirms that the issue is fallible semantic judgment rather than missing context: the exact source-frame text containing the first-person qualification was supplied. A run 2 sibling answer was correctly rejected for the same omission, so enforcement is inconsistent.

### Fiction retrieval produces a false absence: one row

Run 2 Russian-to-Russian inferred answers that the content of the promise is not specified in the supplied record. The original source does specify the fictional parties, free axle-cap replacements, and the first ten weeks. The inferred planning view selected only the real proposal-to-discuss record and omitted the fictional promise record. The verifier then judged the answer against that selected excerpt and accepted a local absence statement that is false of the original source.

This is both a usefulness failure and a source error. A retained excerpt may constrain an answer, but it cannot authorize a claim that the omitted source content is absent.

### Untranslated content word: one row

Run 2 English-to-Russian explicit retains the English word `fiction` in an otherwise Russian answer: `Это лишь гипотетическое содержание fiction`. The semantics remain recoverable, but the accepted answer violates the requested output language.

### Temporal-qualification attachment: three disputed rows

Three accepted undated-proposal answers say, in effect, “proposed, tentatively, reviewing,” “remains a tentative proposal,” or `предложила предварительно пересмотреть`:

- Run 1 English-to-English explicit.
- Run 1 Russian-to-English explicit.
- Run 2 English-to-Russian inferred.

The source asserts that Ada did make the proposal. What is tentative or unrecoverable is the source-relative time “next year,” because the record itself has no calendar date; no plan or meeting was adopted. On a strict grammatical reading, these answers attach the qualifier to the proposal or review act and therefore weaken an asserted event. A more charitable reading treats “tentative proposal” as a proposal whose proposed timing/status is tentative. I flag these as material qualification ambiguity rather than include them among the 15 unequivocal defects.

### Useful but incomplete hypothetical answers: three rows

Run 1 Russian-to-Russian explicit and both run 2 Russian-to-Russian answers preserve the hypothetical two-month foam-filter rule, unknown actual requirements, and lack of any real missed inspection. They omit the coupled source consequence that, under the thought exercise, a missed check would violate the assumed rule. These remain useful answers to the core question, but they are not complete reproductions of the selected retained proposition.

## Null causes

| Null class | Run 1 | Run 2 | Total | Assessment |
| --- | ---: | ---: | ---: | --- |
| Expected read-only admission | 8 | 8 | 16 | Correct `no_eligible_evidence` behavior |
| Wrong inferred intent/view | 12 | 11 | 23 | Principal avoidable availability loss |
| Deterministic draft/language guard | 4 | 2 | 6 | Mostly safe; includes false positives |
| Semantic verifier rejection | 0 | 3 | 3 | Safe/conservative |
| Generation language failure | 1 | 0 | 1 | Safe null |
| **Total** | **25** | **24** | **49** | |

The 23 intent/view failures are systematic:

- Four nested-report rows: Russian `пересказала` is inferred as factual instead of report content.
- Four counterfactual rows: Russian counterfactual questions are inferred as factual. In one run a standalone non-purchase record is available but does not answer the requested hypothetical; in the other no eligible record is selected.
- Eight assistant rows: the English tentative assistant reading is inferred as factual, while Russian wording around `предварительную версию ... предложил ассистент` is inferred as planning. The proposal verb governs a reading/version, not an intended real-world action.
- Seven fiction rows: the English fictional promise is inferred as factual because the fiction matcher recognizes narrower example forms; Russian `предложила обсудить` is inferred as planning and selects the discussion proposal without the fictional promise content. The eighth analogous run 2 row becomes the accepted false-absence answer described above rather than a null.

The six guard nulls include four run 1 Russian undated outputs rejected for discourse. Three attach `предварительно` to the proposal/review and are appropriately conservative; one explicitly says that the timing is tentative, that the record date is unknown, and that there is no plan or meeting, so its rejection appears to be a false positive. Run 2 also rejects a faithful Russian counterfactual phrased with `нереализованный вариант` rather than an explicit `если бы`, another likely grammar-boundary false positive. The remaining assistant attribution rejection is safe overall because its passive “the contract was not checked” still loses the epistemic actor, even though its assistant attribution is otherwise clear.

The three semantic-verifier nulls in run 2 are conservative: a hypothesis answer changes considering an assumed rule into proposing one; an assistant answer omits personal contract examination; and an undated answer attaches `предварительно` to the review action. The sole generation failure is a run 1 Russian alternatives answer containing the English word `evidence`; the language check safely returns null.

There is no model-transport availability failure in these held-out records. The 49 nulls therefore reflect expected read-only behavior or semantic/language policy decisions, not provider unavailability.

## Source-frame reach and limits

The trace contains 142 answer-generation calls with 162 evidence entries, and every evidence entry has a source frame. It contains 131 semantic-verifier calls with 142 cited-evidence entries, again all framed. Thus the V48 bridge reached both model calls in every observed held-out use; none of the errors above is explained by payload-only fallback.

The bridge also enforces excerpt selection in observed verifier calls: two comparisons return `selected_by_retained_excerpt: false`, and the corresponding extra material is not accepted. The remaining failures expose the limit of this mechanism. The model can misread grammatical roles despite the frame, can omit a source qualification while claiming it preserved scope, and can make an original-source absence claim after retrieval selected only one of multiple retained records. An array or a larger prompt would not by itself repair those judgment and selection errors.

The artifacts demonstrate frame presence and matching text. They do not independently expose enough storage internals to re-prove the live tuple, marker, slug, payload-byte, and archive-hash binding; that remains a code/test invariant rather than an empirical conclusion from this packet.

## Smallest general fixes suggested by the evidence

1. Give qualified content heads precedence during inferred-intent classification. Report nouns and verbs such as “report,” “reading,” “version,” “relay,” `версия`, `сообщение`, and `пересказала`, together with attribution or uncertainty markers, should select report semantics. A surface `suggest/propose/предложил` should select planning only when it governs an intended action, not when it governs a reading or version.
2. Generalize counterfactual and fiction recognition around discourse markers and content nouns: counterfactual, unrealized, fictional, invented, hypothetical, and their Russian stems (`несостоявш-`, `контрфактич-`, `вымышленн-`, `гипотетическ-`). A proposal to discuss fictional content should retrieve the content needed to answer the question, not only the proposal record.
3. Prevent generated source-absence claims unless the selected evidence affirmatively establishes absence at the original-source scope. If a content-bearing sibling record may have been excluded, return null or request the missing concept internally. Do not turn “not in this excerpt” into “not in the supplied record.”
4. Compare the epistemic subject explicitly for access and verification predicates such as read, examine, check, and confirm. Reject an agentless passive when the source only states that a named speaker or assistant did not perform the check.
5. Add a narrow semantic-role check for translated coverage relations. In Russian, the repair must remain the thing covered and the warranty the covering instrument (`ремонт ... покрывается гарантией`); lexical overlap is insufficient.
6. Render undated relative time with an explicit source clock: the proposal is asserted, while “next year” is relative to a record with an unknown calendar date. This removes modifier-scope ambiguity without weakening the proposal event.
7. When one retained proposition couples a hypothetical rule to its conditional consequence, require the generated answer to retain that conditional clause. This can be enforced against the selected payload/frame; it does not require a new public obligation array.
8. For the omitted collection claim, resolve a possessive device reference to an adjacent explicit item only when the source span provides bounded coreference, then keep same-source placement coherent. Avoid a broad folder/group fallback that could route unrelated claims.

These are general structural rules derived from repeated shapes in the held-out set. Because the held-out inputs are now exposed, any runtime tuning based on them needs fresh held-out inputs for evaluation.
