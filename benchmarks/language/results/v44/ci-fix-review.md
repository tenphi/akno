# V44 macOS CI extractor-preparation review — package-hook fallback

Scope: read-only review of the fallback after the GitHub OAuth token could not update workflow files. The prior workflow-based review is preserved as `language-v44-ci-fix-review-original.md`. I did not edit CI, runtime, or tests.

## Disposition

No actionable finding in the package `pretest` fallback.

Root `package.json` now runs `scripts/prepare-test-extraction.mjs` before `vitest run`. The script immediately exits without imports or output unless both `GITHUB_ACTIONS === 'true'` and `process.platform === 'darwin'`. Local runs and Linux CI therefore retain their prior setup. On macOS GitHub Actions, it imports the production source extraction module, calls `extractionCapabilities('darwin')`, and fails clearly unless the Swift helper is available.

Importing source is compatible with this repository's pinned Node runtime and existing direct-TypeScript execution. It also removes any dependency on a separately built internal `dist` path while still reusing production source discovery, source-hash cache naming, atomic compilation, and the shared `AKNO_CACHE_DIR`/user-cache behavior. The helper is prepared before Vitest creates concurrent file workers, outside their 30-second per-test budgets.

The supplied forced-path log (`GITHUB_ACTIONS=true` on Darwin with an empty isolated `AKNO_CACHE_DIR`) records `macOS document extractor ready`, followed by 133 passing files and 2,133 passing tests. I inspected that log rather than running it. This confirms the hook executed and the suite completed in that local environment; it still does not prove the original remote timeouts were caused by cold compilation. Remote CI remains the test of that hypothesis.

No test timeout, production extractor budget, runtime behavior, model/language gate, or workflow file changes. `test:watch` is also unchanged because the lifecycle hook belongs only to the `test` script.

## Fallback explanation

The workflow-step design could not be pushed because the available GitHub OAuth authorization lacked workflow-update scope. The unpublished commit was soft-reset and `.github/workflows/ci.yml` restored exactly to remote `354ff7e`; no public history was rewritten. Moving the same preparation behind the existing root `pnpm test` lifecycle achieves the bounded CI prerequisite without modifying the protected workflow. The environment/platform gate keeps it CI-specific.

## Remaining uncertainty

If remote macOS CI still reports the same two 30-second timeouts after this hook logs readiness, cold helper compilation is no longer an adequate explanation for that run. The next step should capture bounded timing around doctor capabilities and orphan-PDF indexing rather than raise timeouts or weaken assertions.
