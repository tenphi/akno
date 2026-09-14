# V44 macOS CI extractor-preparation review

Scope: read-only review of the CI-only workflow diff following the two opaque 30-second macOS test timeouts. I did not edit runtime or CI, rerun the full suite, or treat the earlier latency hypothesis as proven.

## Disposition

No actionable finding in the proposed CI-only change.

The new step runs after `pnpm build` and before concurrent `pnpm test` in the macOS job only. It imports the built internal extraction module, calls the production `extractionCapabilities('darwin')` path, and fails explicitly unless the shared Swift helper is available. That reuses the runtime's source discovery, source-hash cache key, atomic temporary build, rename, permissions, and 180-second compiler budget instead of duplicating them in workflow shell.

The preparation does not change test timeouts, runtime extraction behavior, language gates, or Linux CI. Because the compiled helper is stored in the shared user cache, later Vitest worker processes can observe the completed binary even though each worker's in-memory `cachedBinary` starts empty.

The reported local cold-cache preparation completed with `swift: true` in about 2.1 seconds. I did not execute that check myself; it supports that the command and built-module path work locally, but it does not prove the original CI timeouts were caused by compilation. The prepared CI rerun remains the useful test of that hypothesis.

The step checks helper construction/availability rather than performing a PDF extraction. That is sufficient for its narrow purpose of moving compilation outside per-test budgets. Existing extraction tests remain responsible for behavior. If the same tests still time out after this preparation, the next investigation should collect bounded stage timing rather than increase their timeouts.
