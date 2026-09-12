# V68 publication review

## Finding

The V68 metrics and decision narrative are internally consistent with the preserved grades and reports:

- final useful answers are 71/96 = selected 39/64 + built 32/32;
- the preserved initial total is 72/96, with the one-point change coming from fiction q7;
- complete retained sets are 10/12 = selected 6/8 + built 4/4;
- useful retrieval observations are 80/96 = selected 48/64 + built 32/32;
- 73 answers were published, comprising 41 selected and 32 built, and the selected packet has 23 nulls;
- no produced answer is graded `sourceEntailed:false`, `languageCompliant:false`, `qualificationPreserved:false`, or unsafe promotion;
- the two material publication failures are nevertheless disclosed separately: the source-entailed but insufficiently specific connector-integrity answer, and fiction q7's source-entailed proposal clause backed by the wrong selected-record citation;
- fiction q3's stricter forensic completeness view and the final source-only focused-subset adjudication are both preserved without being presented as unanimity;
- the full repeated V21 trial is explicitly deferred and the fresh held-out split is described as unexecuted.

One concrete packaging/link defect remains. Both `built-forensic-review.md` and `built-forensic-review-initial.md` link to `language-v19-blind-inputs.json` in the V68 results directory, but that file is absent there. The packet itself contains the original source material, so this does not invalidate the findings, but the published evidence link is broken. Either copy the approved V19 input packet into `benchmarks/language/results/v68/` or point both links to a preserved existing copy with an intentional stable relative path.

All README-local links resolve. The staged final and initial selected grades, built grade, and meaning adjudication are byte-identical to their corresponding `tmp` receipts. No other count, qualification, freshness-boundary, or release-status mismatch was found.

## Resolution

The link defect is resolved. Both built forensic files now point to `../v65/language-v19-blind-inputs.json`; that target exists and is a stable preserved V19 input packet. The original finding above remains as review history. The final repository-gate log reports the repository check passing. No remaining publication mismatch was found.
