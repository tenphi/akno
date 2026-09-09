# V75 conditional full-trial plan review

I reviewed `tmp/v75-full-trial-plan-draft.md` only after completing the independent built-package forensics. This is a design review, not authorization to launch.

The evaluation boundaries are coherent:

- the unchanged frozen runtime, model roles, effective role caps, pass count, retry policy, corpus fingerprint, and diagnostic history remain fixed;
- development and held-out each run twice, with all ten writable and one read-only case and all eight coordinates;
- 320 writable and 32 read-only observations are arithmetically correct;
- each 80-answer split/run cell must independently reach 72 useful answers, with no averaging across cells;
- retention/retrieval, accepted-error, availability, and source-byte gates remain independent;
- nulls and unavailable results cannot be reclassified as useful abstentions;
- exposed diagnostics stay outside full-trial denominators, and the original repetitive fixture failure remains visible beside the successful amendment;
- source-only grading, trace forensics, disagreement preservation, and provenance validation remain separate.

The once-only start markers, per-runner receipts, pre-entry frozen/source-dist/hash checks, isolated temporary knowledge bases, and preservation of partial traces are appropriate. Concurrent split execution is acceptable only with the stated isolated paths and frozen runtime; each split/run result still stands on its own, including any contention-related availability failure.

There is one current blocker explicitly recognized by the draft: the selected 64-coordinate V75 probe, its independent source grade, and the final coordinate/provenance audit are still pending. Any material accepted error, retention loss, availability problem, or required runtime change there cancels this unchanged-runtime plan. A separate final proceed decision is therefore required after those artifacts exist.

Subject to that pending evidence, I found no structural blocker or threshold relaxation in the draft. I do not authorize or launch the full trial in this review.
