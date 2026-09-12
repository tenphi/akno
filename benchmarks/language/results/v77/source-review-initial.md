# V77 terminal full-output source review

This is the independent source-only review of the official two-split terminal packet. It uses the original invented inputs, the sealed source-first notes, the grading contract, and the output-only official packet. The previously graded held-out fragment was carried forward only after the supplied integrity verification established an exact case and report-fingerprint match. No runtime traces, verifier verdicts, forensic reviews, aggregate runtime judgments, provider calls, or other graders’ judgments were used.

Official packet fingerprint: `fbfe5a20ed6a66f26a3e9312d16649700224d2eef8e3c7adbcd1a8e002e79d1d`.

The review covers all 44 case/run entries and all 352 answer coordinates individually. There are 40 writable case/runs with 320 answer cells and 4 read-only case/runs with 32 answer cells.

## Supported totals

| Measure | Development | Held-out | Full |
| --- | ---: | ---: | ---: |
| Case/run entries | 22 | 22 | 44 |
| Complete useful writable retention | 16 / 20 | 13 / 20 | 29 / 40 |
| Justified read-only retention holds | 2 / 2 | 2 / 2 | 4 / 4 |
| Retention with qualifications preserved, including holds | 18 / 22 | 15 / 22 | 33 / 44 |
| Useful qualified retrieval | 104 / 176 | 96 / 176 | 200 / 352 |
| Useful qualified writable answers | 91 / 160 | 79 / 160 | 170 / 320 |
| Justified read-only null abstentions | 16 / 16 | 16 / 16 | 32 / 32 |
| Nonnull answers source-entailed | 115 / 115 | 106 / 106 | 221 / 221 |
| Nonnull answers language-compliant | 115 / 115 | 106 / 106 | 221 / 221 |
| Unsafe factual promotions | 0 / 176 | 0 / 176 | 0 / 352 |

Across the writable cells, 99 answers are null. None is a source-justified abstention because every writable original source answers its query. A further 51 nonnull answers remain source-entailed and language-compliant but do not count as useful qualified answers because they omit requested content or a coupled qualification.

## Important distinctions

- A retained proposition can be individually faithful while the retained set is incomplete. This occurs where only an independent negative fact survives, where the core report or speculation is absent, or where a source-relative clock or actual introduction act is lost.
- Safe refusal and source-justified abstention are different. Writable nulls avoid invention from missing or incomplete retrieval, but the original source permits an answer. They therefore fail usefulness and justified abstention. Read-only nulls are justified because a typed policy hold correctly blocks retention and answering.
- Retrieval and answering are graded separately. Some answers remain source-entailed even when their retrieved evidence is incomplete, and some complete retrieved bundles yield null answers. Paired answer-language coordinates receive the same retrieval grade where their query and view retrieved identical evidence.
- Source entailment alone does not establish a useful qualified answer. The grading treats explicit independent negatives and discourse or clock limits as coupled where the source expectation requires them to travel with the queried proposition.
- No nonnull answer reverses polarity, swaps the material actor or object, invents a calendar date, or promotes reported, hypothetical, counterfactual, fictional, tentative, unresolved, or rejected material into established fact.

## Grading ambiguities resolved

The principal ambiguity was how much a focused answer may omit. I applied the contract’s coupling rule conservatively and consistently. Nested-report answers that omitted the speaker’s separate delivery denial, and rejected-plan answers that omitted collection or appointment/transport status, are source-entailed but not useful qualified answers. Likewise, fictional answers that omitted Ada’s actual proposal/introduction act, and relative-time answers that omitted the explicit source-record rather than processing-time anchor, fail qualification preservation where those facts were required by the sealed source rubric.

Minor lexical variation was accepted when it preserved the tested property and relationship. Natural translations of terms such as guide rail, belt fastening, control dial, alignment, and rotation-stop angle were treated as language-compliant when their meaning remained clear. Slightly awkward grammar did not fail language compliance when the requested language and semantic relation were still unambiguous.

The first-pass combined review is preserved at `tmp/language-v77-full-output-review-initial.json`; the final review is separately written at `tmp/language-v77-full-output-review.json`. They are identical because no correction was needed after structural and count validation. The held-out fragment first pass remains untouched at `tmp/language-v77-held-output-review-initial.json`.
