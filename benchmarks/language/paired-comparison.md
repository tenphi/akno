# Comparing the scope and routing changes in PR 73

PR 73 changes two production modules: `kb/prose.ts` and `memory/intent.ts`. Retention, answer generation,
and answer verification are unchanged from its base. Comparing independent end-to-end percentages cannot
isolate these changes when extraction itself varies between runs.

The [frozen comparison plan](pr73-paired-plan.json) therefore uses identical downstream inputs in both
revisions. This is a regression experiment on exposed cases, not a new general language acceptance gate.

## Reproduce

Build the PR checkout and a separate checkout of the plan's baseline. Install each checkout's own workspace
dependencies; the runner verifies that each arm resolves its own built protocol and records both compiled
trees. Do not rebuild either runtime while a comparison is running.

```sh
git worktree add --detach /tmp/akno-comparison-base ce8fbe4ed0d529bec35dd154e8bbfec79eefb0eb
pnpm --dir /tmp/akno-comparison-base install --frozen-lockfile
pnpm --dir /tmp/akno-comparison-base build
pnpm build
node scripts/compare-language-reliability.mjs \
  --baseline /tmp/akno-comparison-base --candidate "$PWD" \
  --output /tmp/akno-comparison-offline
node scripts/summarize-language-comparison.mjs /tmp/akno-comparison-offline
```

Output directories must be new. Both completed and failed coordinates are retained; a failed or partial
comparison cannot produce a successful summary. `results.json` indexes canonical per-pair files by hash.
An interrupted pair retains its incremental `.partial.json` checkpoint.

The optional live mode adds `--live --config /path/to/private-provider-config.json`. Its provider key must
resolve from the environment through that private configuration. It requires Luna with low reasoning for
answers and Luna reranking, plus an enabled embedding model. No stronger runtime model is substituted.
The configuration must not be committed. The runner publishes model settings and physical usage without
credentials, endpoints, request headers, or provider reasoning.

## What is compared

The offline matrix contains every public retained set from the two full V23 runs, including empty and
incomplete sets, plus the four original ordinary Markdown fixtures. The original retention judgments remain
attached. Reconstructed managed markers preserve public text, IDs and typed qualifications exactly; both
arms assert equality after indexing. The original source and support references are also available for
review. Missing marker receipts and links are replaced by declared fixture metadata. Consequently, this
does not reproduce retention, original provenance-backed verification, replay, or archive lineage.

Each revision creates its own index from identical bytes and file timestamps. Checks cover inferred and
explicit views, evidence supplied to answers, factual answer and auto-context controls, and file preservation.
The ordinary fixtures additionally upgrade a real baseline index through an ordinary candidate index pass;
their resulting stored projections and readable frames must match a fresh candidate index. Existing unit
and operation tests cover negation, conditionals, clause boundaries, invalid headings and fenced examples.

`recall` may return ineligible material for inspection. Its returned-line count is therefore reported
separately from evidence actually supplied to an answer. Model-free auto-context may remain degraded or
inactive; that is not counted as an available live answer, and no generation score is inferred from it.

## Live coupling and review

The fixed live subset uses two repetitions, alternating which revision executes first, inferred and
explicit views, English/Russian answers, and factual controls. Two independent case pairs can run at once.
Within a case/repetition/stage, only byte-identical provider requests share a response across revisions.
Provider identity, headers and the exact body participate in matching. Repeated requests and retries within
one arm remain separate physical calls; the other arm can reuse the corresponding occurrence only. Each
revision still executes its own generation parsing, guards and verification. HTTP and network failures
remain failures. Repetitions never share responses.

The network ledger distinguishes physical calls from coupled responses and charges token usage once.
Different requests still sample the model independently. Equality obtained through coupling demonstrates
an invariant, not independent statistical replication. Two repetitions cannot establish general accuracy
or noninferiority.

Independent review must assess all published answers against the original source and available frozen
evidence, keeping source fidelity, qualification, usefulness and citation correctness distinct. An empty
retained artifact can explain a downstream null without making abstention justified by the original source.
The historical full quality gate remains unchanged and failed; the new experiment supports only the
declared scope and routing claims.
