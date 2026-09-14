# Evidence publication review

## Scope

I reviewed only `publish-evidence.mjs` and the evidence and limits claims in `README-draft.md`. I did not run publication, inspect pending integration outputs, or change frozen harness, inputs, grades, or runtime. Pending integration and deployment artifacts are expected dependencies and are not treated as defects.

## Assessment

The intended public/private boundary is generally sound. Raw model events are excluded from the published trace projection, while case receipts and `public-result`/public failure events remain available for review. For each projected trace, the manifest records the full local trace's SHA-256 as `originalSha256`, the projection's SHA-256 as `publishedSha256`, and an explicit transformation description. That is an honest source/projection relationship, even though the original trace itself remains private. Normal files likewise receive pre-redaction and published hashes.

The source corpus is invented, and the run is isolated from the private knowledge base. Publishing source items, public retained pages, retrievals, answers, and judgments is consistent with the evidence claims. The exclusion of model-start/model-result/model-throw events keeps prompts, internal model responses, and private verifier material out of the public bundle.

Three issues should be fixed before publication.

## Must fix 1: the evidence README is not published

`README-draft.md` contains the public bundle's design, completed comparison results, decision rules, evidence inventory, and reliability limits, but it is absent from the `files` set and is not otherwise copied to the target. As written, the published directory would contain machine-readable evidence and assorted reviews without the central document that states how to interpret them.

Publish the finalized document as `README.md` after the integration section is completed. Its original and published hashes should be included in the manifest like every other published source. The script should fail if the README still contains the explicit pending-result language when final publication is attempted.

## Must fix 2: publication is not atomic and cannot recover from partial failure

The script asserts that the final target does not exist, then creates it incrementally during the first `publish` call. Many failures can occur afterward: a pending file can be absent, a trace line can fail JSON parsing, a redaction assertion can fire, a duplicate path can fail `wx`, or the final manifest write can fail. Any such error leaves a partial `benchmarks/language/results/fixed-comparison` directory. A retry then fails immediately because the target exists.

Build the entire bundle in a fresh sibling staging directory, validate every input and projected output first, write and validate the manifest there, then atomically rename the staging directory to the final target. Remove only that newly created staging directory on failure. The final target should remain absent unless publication completes successfully.

## Must fix 3: machine-path redaction and detection are too narrow

The README and manifest claim that machine-local paths are replaced with explicit placeholders. The sanitizer replaces only one exact repository path and one exact Node executable path. The assertion detects only absolute paths beginning with `<home-path-example>` or `<home-path-example>`.

Other machine-local paths can pass unchanged, including macOS temporary paths under `<machine-path>`, `<machine-path>`, `<machine-path>`, mounted-volume paths, alternate Node installations, and candidate roots outside the exact repository string. This matters because candidate descriptors, public error records, and archived receipts can contain paths. The current check therefore does not justify the general path-redaction claim.

Derive and redact the actual candidate roots and relevant executable/repository roots from the publication inputs, and reject remaining absolute filesystem paths across supported platforms. Apply the same scan after projection and redaction to every output, including the final README and manifest-relevant text. Avoid treating public URLs as filesystem paths.

## Additional privacy hardening

The current secret scan catches common OpenAI-style and GitHub-style tokens, and public traces omit model-call payloads. It does not scan for other credential forms, authorization headers, emails, phone numbers, or identifier-like values in public error messages and model-generated public outputs. Given the invented corpus and isolated run, this is not evidence of a current leak. A broader final content scan would still be prudent, especially for public/open error events, before moving the staged bundle into place.

## Claims that are supportable after these fixes

- Raw model traces can remain local while their hashes identify the exact private source used to derive reviewable public-operation projections.
- Public receipts, packets, grades, corrections, postvalidation, deltas, declarations, selection, preflight, frozen harness code, and bounded reviews provide enough evidence to audit the fixed comparison and integration without publishing private model reasoning.
- The README correctly distinguishes repeated coordinates from independent source scenarios, the fixed comparison from historical experiments, evaluation permission from rollout approval, and a bounded recovery result from general reliability.
- The stated limitations are appropriately conservative: one exposed fixed suite cannot establish unseen-language, implicit-discourse, longitudinal, or general reliability, and model grading remains fallible.

## Disposition

Do not publish with the current script. Add the finalized README to the bundle, make publication atomic and retry-safe, and broaden machine-path redaction/detection so the manifest's claim is accurate. Pending integration and deployment files can remain pending until their upstream work completes.
