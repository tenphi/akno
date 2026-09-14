# V75 conditional full-trial harness review — final

The initial findings remain preserved in `tmp/language-v75-full-harness-review-initial.md`. I reviewed only the unexecuted provenance correction; I did not run a provider, benchmark, preparation, or approval path.

## Finding resolution

Both findings are resolved:

1. `tmp/v75-full-launch-integrity.mjs` now includes `bench-results/language-selected-v75.json` in the manifest's exact file-hash map. Each integrity check recomputes the expected map and requires deep equality with the prepared manifest. The report contract used by the validator can therefore no longer change independently of the approved manifest.
2. The same map now includes `tmp/language-v21-blind-inputs.json`. `tmp/validate-v75-full.mjs` explicitly verifies both the baseline and blind-input hashes against the manifest before reading either value. This binds the metadata used for expected case IDs/admissions without exposing held-out content for tuning.

The previous integrity script, validator, and prepared manifest are preserved with `.before-provenance-fix` suffixes. The obsolete current manifest was removed. No current manifest, preflight approval, or full-start marker exists, so the correction has not silently inherited the prior preparation or authorized execution.

## Disposition

**The corrected harness code is clean.** The two initial provenance blockers are closed.

Final manifest preparation and inspection must wait until the selected report exists in its final form. Launch remains held until selected64 grading/forensics/provenance support an explicit proceed decision and a separate independent approval is bound to the final manifest, decision, and provenance hashes. This review is not that approval.
