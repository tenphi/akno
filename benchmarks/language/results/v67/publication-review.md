# V67 evidence-publication review

## Disposition

Clean. I found no publication blocker, count inconsistency, hidden consensus claim, freshness misstatement, or runtime/provenance mismatch in the reviewed V67 evidence.

## Count reconciliation

The README, `output-summary.json`, and `full-trial-decision.json` agree:

| Probe | Observations | Published/useful | Nulls | Complete retention | Useful retrieval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Selected | 64 | 52 | 12 | 8/8 | 64/64 |
| Built | 32 | 23 | 9 | 3/4 | 24/32 |
| Combined | 96 | 75 | 21 | 11/12 | 88/96 |

Direct aggregation of the final source-only receipts gives 52 and 23 `usefulQualifiedAnswer:true`, 64 and 24 `usefulQualifiedRetrieval:true`, zero `sourceEntailed:false`, zero `qualificationPreserved:false`, zero `languageCompliant:false`, and zero `unsafeFactualPromotion:true`. This matches the adopted 75/96 grade and zero accepted-error fields. The per-case answer totals sum correctly in both probes.

The decision consistently records zero case-availability failures and one answer-operation failure: the traced language-policy rejection of ordinary untranslated `hinge-pin`, explicitly distinguished from provider/schema availability. The README's 21 writable nulls equals 96 − 75. Deferral is justified independently by selected usefulness and built retention/usefulness, so it does not depend on resolving the fiction interpretation disagreement.

## Preserved disagreement and corrections

The publication represents the disagreement honestly. It states that the initial selected forensic reversed the two fiction citations and misread the complete counterfactual; the corrected forensic retracts those findings. It then preserves the narrower forensic view that fiction q4/q6 lose or generalize Ada's explicit proposing-to-discuss action, while `meaning-adjudication.md` explains why the adopted source-only grade treats both as focused, supported promise identifications. `full-trial-decision.json` records both `acceptedErrorsInAdoptedGrade: 0` and `focusedFictionLossesInFinalForensics: 2`; the README does not imply unanimity or silently alter boolean grades.

The built-package correction is likewise explicit: the repaired alternatives text is faithful under the declared embedded-hypothesis commitment contract, while the whole-record verifier interpretation creates the loss. Initial and corrected built forensic and grading artifacts are all present.

## Provenance and finite claims

- Every principal receipt names frozen runtime `ac1059e4a3df85fbfef12749f65439a69434d56c`; the README reports the same hash.
- The published checks, CI identifiers, test totals, protocol controls, and deployment claims match the postdeploy/readiness evidence reviewed earlier.
- The manifest accurately describes its role: it hashes local raw traces and command logs and does not present those hashes as quality evidence. Its trace hashes and initial/corrected logs are present.
- The README limits provider echoes to transport/schema evidence, calls observed nonrecurrence descriptive rather than causal proof, and disclaims reliability under the unchanged 1,024-token service overlay.
- Fresh V21 held-out inputs are consistently stated as unexecuted; the full repeated trial is consistently deferred. No replacement run, semantic retry, threshold change, additional pass, or runtime change is claimed.

No correction is required before publication.
