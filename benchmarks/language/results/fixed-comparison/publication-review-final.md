# Final evidence publication review

## Scope

I re-reviewed only `publish-evidence.mjs` and the updated evidence and limits language in `README-draft.md`. I did not run publication, inspect pending integration outputs, or alter the publisher, frozen harness, inputs, grades, or runtime. The initial publication review remains preserved.

## Assessment

Clean static assessment. The three prior publication blockers are resolved, and I found no new concrete defect in the reviewed scope.

The finalized README is now published by the script as `README.md`, with original and published hashes recorded through the same manifest path as other artifacts. Publication explicitly rejects the current pending-integration language, so the draft cannot be presented as a final evidence report before the integration result is complete.

Publication is now failure-safe. It writes into a uniquely owned sibling staging directory, uses exclusive file creation, verifies every staged file against its manifest `publishedSha256`, checks again that the final target is absent, and renames the complete staging directory into place. The `finally` block removes only that process-owned staging directory after a failure. A late missing dependency, parse error, redaction failure, or hash mismatch therefore does not leave a partial final bundle or block a corrected retry.

Path handling now supports the bounded README and manifest claims. The publisher replaces the exact repository and Node executable paths plus recognized temporary, workspace, mounted-volume, and per-user runtime roots. It rejects remaining recognized Unix home/system paths and common Windows user/system/temp paths after sanitization. The README now accurately calls this a bounded check rather than a proof against every private string.

The public/private evidence boundary remains appropriate:

- complete case receipts and public operation projections remain reviewable;
- projections include case boundaries and public operation results or failures;
- raw model-start, model-result, and model-throw events remain local;
- each projection records the full local trace hash as its original source hash, its own published hash, and an explicit projection transformation;
- ordinary published files record their pre-redaction and published hashes; and
- secret-shaped OpenAI and GitHub tokens are rejected after sanitization.

The file set is sufficient for the stated claims once the intentionally pending final evaluation and deployment artifacts exist. It includes the frozen sources and obligations, grading contract, declarations and approvals, public receipts, anonymous packets, preserved grades and corrections, postvalidation and scoring results, case deltas, selection evidence, implementation hypotheses and reviews, validation controls, execution/analysis scripts, deployment proof, the final publication reviews, and the completed README.

The privacy posture is proportionate to this archive: fixture content is invented, the experiment is isolated from the private knowledge base, private model traces are excluded, and the README candidly limits the path/content scan. Public generated answers and public errors remain evidence and are intentionally reviewable rather than silently omitted.

## Disposition

Clean, pending the expected final integration, grading, validation, documentation, and deployment dependencies. Publication should remain unrun until those files exist and `README-draft.md` contains the completed integration result; the script enforces both conditions. No publication was performed during this review.
