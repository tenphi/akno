# Contributing to Akno

Thanks for looking. Akno is source-available under the PolyForm Noncommercial License 1.0.0
and contributions are welcome.

## Getting set up

```bash
pnpm install
pnpm build
cp config/local.example.jsonc config/local.jsonc   # set akno_path
pnpm test
```

`pnpm test` needs no models and no knowledge base of your own — the integration suite builds one in a temp
directory. If it passes, your checkout is working.

Once a service is installed, `pnpm akno redeploy` is the one command that applies a change: it builds, then
restarts `dev.akno`, then waits for the socket to come back. Both halves are needed and for different
reasons — launchd runs the TypeScript directly, so the _service_ needs the restart and not the build, while a
host importing `@tenphi/akno-client` reads `packages/*/dist`, so it needs the build and not the restart.
Doing one and not the other leaves half the system on the old code, and the symptom is `unknown op`.

Node 22.18+ (native type stripping) and pnpm 10+. `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (three
days), so a brand-new release of a dependency will not resolve; that is deliberate.

**macOS only.** `@tenphi/akno-core` and the CLI declare `"os": ["darwin"]`, and there is no plan to change
that — see [Platform](README.md#platform). Do not add a Linux or Windows code path "just in case": an untested
second watcher is a correctness claim nobody has checked. `@tenphi/akno-client` is the exception and must stay
portable, because a Linux container talking to a macOS host over the HTTP door is a supported deployment.

## The one rule about config

**Never commit anything from your own machine.**

- `config/default.jsonc` is committed and must stay machine-independent: no home paths, no endpoints, no
  credentials, no model ids that assume a particular server. CI greps for violations.
- `config/local.jsonc` is gitignored. That is where your `akno_path` and your model ids live.
- A credential is referenced by env var name (`{ "env": "AKNO_OPENAI_API_KEY" }`), never inlined. If you find
  yourself wanting to put a secret in a config file, the config schema needs a change, not the file.

If you add a config key, add it to `default.jsonc` **with a comment explaining what it costs to change**, and
to `ConfigDoc` in `packages/core/src/config/schema.ts`. The default config is documentation as much as
configuration; a key that appears only in the schema is a key nobody will find.

## Repo shape

```
packages/protocol   op registry, zod schemas, wire format. Depends on zod and nothing else.
packages/core       config, store, indexer, models, recall, watcher, doctor, bench.
packages/client      thin typed client over a running service. No native dependencies — ever.
packages/cli        commands, and the three doors (socket, HTTP, MCP).
config/             default.jsonc (committed) + local.jsonc (never)
examples/demo-brain a small invented knowledge base, with a test that keeps it working
scripts/            the two smoke scripts, and the pack-time asset staging
```

`@tenphi/akno-protocol` exists so `@tenphi/akno-client` can share schemas with `@tenphi/akno-core`
without pulling `better-sqlite3` and `sqlite-vec` into a host's build. **Do not add a runtime dependency from `client` to
`core`.** That boundary is the reason a containerized agent can talk to Akno without compiling anything.

## Adding an op

One place, then everything else follows:

1. Add the input/output schemas under `packages/protocol/src/ops/`.
2. Register it in `packages/protocol/src/registry.ts` with a `description` written for an agent to read, and
   `implemented: false` until the body exists.
3. Implement it in `packages/core/src/ops/` and wire it into the `implementations` map in `open.ts`.
4. Add a CLI command if a human would use it.
5. `pnpm akno redeploy`. The op registry a _host_ sees is the built one, so a new op is invisible to a host
   until the build has run — and it fails as `unknown op`, which looks like a wiring mistake in the host
   rather than a stale artifact.

The socket, HTTP and MCP doors are generated from the registry, so they need no change. That is the point: an
op cannot exist over one door and be missing from another.

## Things that are load-bearing

Changes here need more care than the line count suggests.

- **Line addresses must be real.** `recall` reads its lines from the file on disk, not from chunk text, so a
  cited line number is the number the line actually has. A citation pointing at the wrong line is worse than no
  citation.
- **Absence has a reason.** `empty`, `degraded` and `unavailable` are three different results. Never collapse
  them, and never return `empty` when a model was missing — an agent uses that distinction to decide whether it
  may say "not recorded".
- **Degradation must be reported.** If a model is missing or a call fails, it goes in `degraded`. Silent
  degradation is the failure mode Akno exists to prevent, and it has already bitten this codebase once: a
  reranker that ran, cost its latency, and changed nothing, because its logits were being compared against
  fusion scores on a different scale.
- **Never mix score scales in one array.** bm25, cosine, reciprocal rank and cross-encoder logits are four
  different units. Fuse by rank; normalize before comparing.
- **The knowledge base is the user's.** With the defaults, an index pass must leave the _set_ of files and every
  file's bytes unchanged. The integration suite asserts this by hashing the whole tree either side of a pass —
  which catches a file appearing as well as a file being edited. Frontmatter keys other than `id` are preserved
  byte for byte, which is why frontmatter writes splice text rather than round-tripping through a YAML
  serializer. A setting may add a file (`write_ids`, `ingest.text_rendition`); it must ship off.
- **Deleting the index must cost nothing.** Everything except the journal is derived and rebuildable. If you
  add a table, either it is derivable from Markdown or it needs the same durability argument the journal has.
- **Never pre-record a hash in `files` before the indexer runs.** The stat fast path compares against `files`,
  so a hash recorded first makes the indexer conclude "unchanged" and skip the page — it lands on disk and never
  reaches the index. Equally, **never delete a `files` row** to signal a deletion: `known` is built from
  `files`, so a path that is not there can never appear in the reconciler's vanished set, and the `pages` row
  survives pointing at a file that is gone. Both bugs shipped once; both are now asserted.
- **Scope the model passes.** `run({ only })` scopes them for you, and `run({ modelPaths })` scopes them while
  still walking the whole tree — which is what `undo`, `forget` and `move` need, because only a full walk can
  conclude a file is gone. A full pass with no scope re-derives everything, and one `write` then blocks on the
  entire backlog.
- **Compare like with like.** Inline conflict detection runs the _same_ extractor over the page and over the
  incoming text. Joining a structurally-extracted attribute against a model-assigned one silently never matches,
  which is how `- Nights: 5` landed on top of `- Nights: 3` with no conflict reported.
- **Threshold `relevance`, never `score`.** `score` orders one result set — the best hit is 1.0 whether it is a
  perfect match or the least bad of a bad batch — so thresholding it made routing unconditional and left "a
  document with no home stays put" impossible to reach. `relevance` is absolute when a cross-encoder or the
  embedding arm supplied one, and absent otherwise, which is when routing must refuse and ask.
- **A threshold is only as good as the query it scores.** Routing once built its query from the document's
  summary plus 400 characters of its text. Measured on a 223-page base, that collapsed the spread across
  candidate folders from 0.49 to 0.014 — everything at 0.98–0.99, so nothing could fail `route_threshold` and
  the winner was noise: a water bill filed under `travel/2026` while the folder holding its own previous
  statement missed the top eight. A long query resembles everything a little. `routingQuery` is one line and has
  a test for exactly this reason.
- **Rules are config, and config changes have to reach the index.** A rule edit is not a file edit, so the stat
  fast path skips every page and the pass reports "223 unchanged" while the new role does nothing. The
  resolved rules are fingerprinted in `meta`; when the fingerprint moves, pages whose role or management
  policy moved are re-indexed and their derivations dropped. Note that an ignored page has no `pages` row at
  all — walk `files` too, or ignoring becomes a one-way door.
- **Never infer "the source line is gone" from the absence of a fact.** Retiring vs deleting hangs on whether
  the _page_ still contains the line, so the live-line set comes from the page. Read from the incoming facts, a
  derivation that returned nothing looks like every line vanishing at once, and a page that merely became a
  `source` retires its whole history as superseded on lines nobody touched.
- **A document's text belongs to the document, not to a page body.** It is invalidated by the _file's_ hash,
  which a page body cannot honour, and indexing the same words in both places makes one match arrive twice
  against one recall budget. Document chunks live in `chunks` with a `document_id` and a `doc_page` so FTS,
  vectors and fusion need no second mechanism — but they carry the owning page's id too, and `replaceChunks`
  must leave them alone or every page edit silently unindexes its attachments.
- **Parts of one document are one document.** `passport.pdf` and `passport-2.pdf` share a `group_key`, are
  extracted together so page offsets stay consistent, get one summary, and collapse to one entry on a card. When
  several parts match, quote the **best-ranked** part — iterating parts in order instead quoted whichever file
  happened to be part one.
- **An inference engine's guardrails belong in code.** Every rule for `observe` is enforced after the model
  replies, not asked for in the prompt — because a real run wrote "X lives with a wife" with the prompt rule in
  place. A prompt is a suggestion, and a replaceable prompt is how every guard gets lost at once.
- **Group observation input by folder, not by subject alone.** A small deriver writes the _attribute_ into
  `subject`, so grouping on it joined a bag with a drum kit and a Roman church with a person's page. Given
  unrelated facts under one heading, a model will find a pattern across them: the input was the bug.
- **Anything that writes must be reachable through the writer.** Exactly one process holds the write handle, so a
  command that opens the index directly is broken the moment a service is running. `dream`, `index` and `inbox`
  travel the socket as _commands_ — not ops, because the ten ops are the agent's memory surface — and fall back
  in-process only when no service answers. All three were broken this way, each failing differently: a hard
  error, a warning, and an "empty inbox" it had never been able to read.
- **Ownership has to be re-asked, not assumed.** After `adopt` writes a page _for_ an existing attachment, the
  attachment's bytes are unchanged, so the stat fast path skips the one file whose ownership just became
  answerable. It re-indexes those paths with `reindexUnchanged`, so ownership still resolves the ordinary way —
  through the `![[…]]` embed the new page carries — rather than by writing `page_id` behind the indexer's back.
- **Never cite a line that does not exist.** A hit inside a PDF is not a line of the Markdown page. Document
  hits come back as a quote attributed to the document and its page number; only body hits produce `lines`.
- **Never report where text came from inaccurately.** A vision model's _description_ of a photograph is not a
  transcription of text in it, and a PDF's own text layer is not OCR. `text_from` distinguishes them because
  presenting them identically is a false claim about provenance, which is the one thing this layer must not do.

## Tests

- Unit tests sit beside the code as `*.test.ts`.
- `packages/core/test/integration.test.ts` indexes a real knowledge base on disk **with no models configured**.
  Keep it that way: proving Akno degrades rather than fails is more valuable than proving it works when
  everything is present, and it keeps CI free of an LLM.
- `scripts/smoke.mjs` drives the built CLI end to end against a generated knowledge base, and
  `scripts/smoke-demo.mjs` does the same against the one this repo ships at `examples/demo-brain`. Both set
  `AKNO_ISOLATED=1` so your `config/local.jsonc` cannot make them pass or fail for the wrong reason.
  `pnpm smoke` runs both.
- The example is documentation that runs, which is why it has a test. Nothing else in the suite would notice
  an event line in a format the indexer does not match, or a relative Markdown link pointing out of the
  folder — which indexes as a broken link _inside_ it. Both were real.
- `akno bench` asserts the performance budgets. If you make something slower, the budget should move
  deliberately and with a reason in the commit message, not quietly.

## Toolchain

- **oxlint**, not ESLint. Roughly 5x faster wall-clock and 12x less CPU on this repo, and it caught a real
  issue ESLint's config had not been asked about (an error rethrown without `cause`). Config in
  `.oxlintrc.json`. Nothing here needed type-aware rules, which is the one thing oxlint does not do.
- **knip** for dead exports and unused dependencies, in CI. It found 39 gratuitous `export`s on the first run —
  an export is a promise not to break something, and a barrel full of false promises hides the real contract.
- **No bundler in the dev path.** Node 22.18+ strips types itself. Source imports name the `.ts` file on disk
  and `rewriteRelativeImportExtensions` turns them into `.js` on emit; `erasableSyntaxOnly` keeps the source
  inside what stripping supports, which is why classes use `#private` fields rather than parameter properties.
  Add a parameter property or an enum and the build will tell you.
- **`pnpm-workspace.yaml` holds a `catalog:`** for versions shared across packages. Two packages resolving
  different majors of zod produce schemas that look interchangeable and are not.
- **`minimumReleaseAge: 4320`** (three days). A brand-new release will not resolve; that is deliberate, and it
  has already blocked one same-day publish during development.

## The Swift extractor

`packages/core/swift/extract.swift` is a real Swift file, compiled on demand into
`~/Library/Caches/akno/bin/` and keyed by a hash of its source, so editing it recompiles on the next run.

- **Do not add `-O`.** Every expensive thing happens inside Vision and PDFKit; optimizing the glue costs 23 of
  the 29 seconds and buys nothing measurable.
- **The cache is not in `state_dir`.** The binary is an artifact of Akno, identical for every knowledge base,
  and `Caches` is the directory macOS may reclaim — correct for something rebuildable in six seconds.
- **It prints JSON on stdout.** Never prose: the caller must not have to parse English to find out whether OCR
  ran.
- **If it cannot be built, extraction degrades** — plain text and Office formats still work, images fall back to
  the vision model if one is configured, and `doctor` says what is missing.

Test it directly while iterating:

```bash
swiftc -o /tmp/akno-extract packages/core/swift/extract.swift
/tmp/akno-extract pdf some.pdf --force-ocr | python3 -m json.tool
```

## Style

Prettier and oxlint are configured; `pnpm format` and `pnpm lint:fix`. Beyond that:

Comments should explain **why**, especially where the obvious implementation is wrong. `git blame` covers what
changed; a comment earns its place by recording the reasoning that is not visible in the code — the failure
mode being avoided, the alternative that was rejected, the measurement behind a constant. A comment restating
the line above it is noise.

## Releasing

Four packages, one version, published from a tag by
[`.github/workflows/release.yml`](.github/workflows/release.yml).

```bash
# 1. Bump all four to the same version, and write the CHANGELOG entry.
# 2. Let CI go green on main.
git tag v0.1.0 && git push origin v0.1.0
```

The workflow re-runs the whole gate, checks the tag against every manifest, verifies the tarballs,
then publishes in dependency order: protocol, core, client, cli.

Three things about it are worth knowing, because each one is a way a release breaks quietly:

- **`pnpm publish`, never `npm publish`.** Only pnpm rewrites `workspace:*` and `catalog:` into real
  version ranges. A tarball packed the other way asks a registry for `workspace:*` and fails on
  install, and nothing before that point notices.
- **The tarball is not covered by the build or the suite.** `packages/core` needs
  `config/default.jsonc` and `swift/extract.swift` inside it — the first because an installed copy has
  no repo root to walk up to and throws `committed defaults are missing` without it, the second
  because PDF and OCR extraction is dead without it. Both are staged by
  [`scripts/pack-assets.mjs`](scripts/pack-assets.mjs) at `prepack`, alongside the LICENSE, and the
  release job asserts all of it before publishing.
- **A version number is spent once.** `pnpm publish` refuses one already on the registry, which is
  the behaviour you want — re-running a half-failed job cannot ship different bytes under the same
  number. If a publish fails partway, bump the patch rather than trying to reuse it.

To rehearse a release without publishing, run the workflow from the Actions tab with `dry_run` left
on: everything happens except the last step.

## Never use real data in tests

See [AGENTS.md](AGENTS.md). Short version: every name, number and body of text in a tracked file must be
invented, because Akno is developed against a real knowledge base and the fastest way to write a regression
test is to paste in the page that just failed.

## Reporting a bug

`akno doctor` and `akno config` (both redact secrets) are the two most useful things to paste. If it is a
retrieval problem, `akno recall "<query>" --json` includes `searched`, `degraded` and `coverage`, which
usually says what happened.

## License

By contributing you agree your contribution is licensed under the PolyForm Noncommercial
License 1.0.0, and that the copyright holder may also license it on other terms.
