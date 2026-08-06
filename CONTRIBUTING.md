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

Node 22+ and pnpm 10+. `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (three days), so a brand-new
release of a dependency will not resolve; that is deliberate.

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
```

`@akno/protocol` exists so `@akno/client` can share schemas with `@akno/core` without pulling
`better-sqlite3` and `sqlite-vec` into a host's build. **Do not add a runtime dependency from `client` to
`core`.** That boundary is the reason a containerized agent can talk to Akno without compiling anything.

## Adding an op

One place, then everything else follows:

1. Add the input/output schemas under `packages/protocol/src/ops/`.
2. Register it in `packages/protocol/src/registry.ts` with a `description` written for an agent to read, and
   `implemented: false` until the body exists.
3. Implement it in `packages/core/src/ops/` and wire it into the `implementations` map in `open.ts`.
4. Add a CLI command if a human would use it.

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
- **The knowledge base is the user's.** With `write_ids: false` (the default) Akno must leave every file
  byte-identical. The integration suite asserts this. Frontmatter keys other than `id` are preserved byte for
  byte, which is why frontmatter writes splice text rather than round-tripping through a YAML serializer.
- **Deleting the index must cost nothing.** Everything except the journal is derived and rebuildable. If you
  add a table, either it is derivable from Markdown or it needs the same durability argument the journal has.

## Tests

- Unit tests sit beside the code as `*.test.ts`.
- `packages/core/test/integration.test.ts` indexes a real knowledge base on disk **with no models configured**.
  Keep it that way: proving Akno degrades rather than fails is more valuable than proving it works when
  everything is present, and it keeps CI free of an LLM.
- `scripts/smoke.mjs` drives the built CLI end to end. It sets `AKNO_ISOLATED=1` so your `config/local.jsonc`
  cannot make it pass or fail for the wrong reason.
- `akno bench` asserts the performance budgets. If you make something slower, the budget should move
  deliberately and with a reason in the commit message, not quietly.

## Style

Prettier and ESLint are configured; `pnpm format` and `pnpm lint:fix`. Beyond that:

Comments should explain **why**, especially where the obvious implementation is wrong. `git blame` covers what
changed; a comment earns its place by recording the reasoning that is not visible in the code — the failure
mode being avoided, the alternative that was rejected, the measurement behind a constant. A comment restating
the line above it is noise.

## Reporting a bug

`akno doctor` and `akno config` (both redact secrets) are the two most useful things to paste. If it is a
retrieval problem, `akno recall "<query>" --json` includes `searched`, `degraded` and `coverage`, which
usually says what happened.

## License

By contributing you agree your contribution is licensed under the PolyForm Noncommercial
License 1.0.0, and that the copyright holder may also license it on other terms.
