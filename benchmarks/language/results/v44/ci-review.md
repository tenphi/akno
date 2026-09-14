# V44 macOS CI timeout review

Scope: read-only review of GitHub Actions run `34270298053`, the two timed-out tests, macOS extraction initialization, and CI ordering. I did not edit or rerun CI.

## Evidence and confidence

The macOS job failed only because two tests exceeded Vitest's 30-second per-test timeout:

- `packages/core/src/ops/answer.test.ts:2070`, which calls `memory.doctor()`;
- `packages/core/test/dream.test.ts:2499`, which writes an orphan `stray.pdf` and indexes it.

The log contains no assertion failure, thrown extraction error, Swift compiler output, nested timing, or stack identifying the awaited operation. It therefore does **not prove** that Swift compilation caused either timeout.

The cold-extractor explanation is nevertheless well supported by the reachable code:

- `memory.doctor()` queries extraction capabilities, and macOS `extractionCapabilities()` calls the private `ensureExtractor()`.
- Indexing the orphan PDF enters macOS PDF extraction, which also calls `ensureExtractor()`.
- On a cache miss, each Vitest worker process can run `swiftc` with a 180-second subprocess budget. The module-level cache is process-local, while the suite runs files concurrently.
- The helper binary is shared through `~/Library/Caches/akno/bin` only after compilation completes. Thus the two timed-out tests can independently enter cold compilation and contend during a heavily concurrent suite.
- The same job's ingest test file took about 50 seconds, while the overall local suite and Linux CI passed. This is compatible with macOS cold native-tool startup or contention, but it is circumstantial rather than a measured causal trace.

## Narrow recommendation

Prepare and validate the native helper once in the macOS CI job after `pnpm build` and before the concurrent `pnpm test`. Use the built `extractionCapabilities('darwin')` entry point, which exercises the production cache-key/source-discovery/atomic-build path, and fail the preparation step with a clear error if `swift` is false. Subsequent Vitest worker processes will find the completed hash-keyed binary in the shared user cache instead of compiling it during a 30-second test.

Conceptually, the CI-only step should do the equivalent of:

```sh
node --input-type=module -e '
  const { extractionCapabilities } = await import("./packages/core/dist/ingest/extract.js");
  const capabilities = await extractionCapabilities("darwin");
  if (!capabilities.swift) throw new Error("macOS extractor preparation failed");
'
```

This should be added only to the macOS build job. Linux has its separate extractor/tool path. Calling the built module avoids duplicating the Swift source hash, cache directory, temporary-file, rename, and permission logic in workflow shell code.

Do not raise the two test timeouts or change the runtime's 180-second compiler budget based on this evidence. Those would hide a CI scheduling prerequisite and would not improve observability. If the two tests still time out after deterministic preparation, the cold-compilation hypothesis is falsified for that rerun and the next step should add bounded stage timing around doctor/index setup rather than relax assertions.

## Risk boundary

This recommendation changes CI preparation only. It does not prebuild or commit a platform binary, alter runtime extraction behavior, change language gates, or weaken either timed-out test. It also turns missing Xcode/Swift capability into a direct setup failure instead of two opaque downstream timeouts.
