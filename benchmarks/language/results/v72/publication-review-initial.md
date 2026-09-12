# V72 publication review

## Result

The numerical and substantive claims in the V72 README, PR-body draft, output summary, decision, independent source-only grades, and source-first forensic reviews agree. I found no incorrect grading claim, acceptance claim, causal comparison, model claim, or token-budget claim.

The publication is not yet mechanically complete. Two concrete evidence-preservation issues must be resolved before commit:

1. `tmp/preserve-v72-final.mjs` requires `tmp/language-v72-retention-scope-design.md`, but that source file does not currently exist. The script will stop at its preflight and copy nothing. Either create the intended reviewed design artifact before preservation or remove that entry if it was never part of the finalized V72 evidence set; do not substitute a differently scoped note silently.
2. `benchmarks/language/results/v72/` currently contains only the README, two code reviews, prefreeze manifest, property design review, and report design review. The README and PR draft say reports, initial/final grades, source-first reviews, protocol receipts, decision, and hashes are preserved there. That statement becomes accurate only after the corrected preservation script runs and its copied links are checked.

## Verified accounting

- Selected: 5/8 complete retained sets, 48/64 useful retrievals, 43/64 useful answers, 21 nulls.
- Built: 2/4 complete retained sets, 24/32 useful retrievals, 24/32 useful answers, 8 nulls.
- Combined: 7/12 complete retained sets, 72/96 useful retrievals, 67/96 useful answers, 29 nulls.
- All 67 produced answers are source-entailed, qualified, requested-language compliant, citation-supported, and useful under the adopted focused-subset rule. The grade receipts contain zero accepted source, qualification, language, or promotion errors.
- Twenty-four nulls follow the report/undated/alternatives upstream retention losses. The other five comprise one source-faithful assistant draft falsely held and four defective drafts correctly held: three coverage-role outputs and one untranslated-term output.
- Five source sets are incomplete: selected report, counterfactual, and undated; built rejected and alternatives.
- The sixteen false private `absent_from_both` classifications divide as stated: fifteen accompany accepted public answers and one an unrelated held answer. The text correctly distinguishes these private audit errors from published semantic errors.
- The source-only and source-first reviews agree on published answer usefulness and complete retention counts. Their additional forensic classification of held drafts does not create an undisclosed grading adjudication.

The readiness limits are accurately stated: the probes are exposed, once-only diagnostics; V21 held-out inputs remain unexecuted; the last full repeated V65 gate remains failed; the 2,400-token isolated ceiling does not validate the service's 1,024-token overlay; protocol echoes do not establish model competence or universal budget sufficiency. The frozen SHA, 3,410 tests in 146 files, seventeen compiled groups, four protocol/provider controls, two successful CI workflows, and zero case availability/source-byte failures match the preserved receipts I checked.

After the two preservation issues above are resolved and the copied relative links are verified, the publication wording is ready.
