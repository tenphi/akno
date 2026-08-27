# Akno

Akno is a memory layer for agents built on a Markdown knowledge base you own.

It lets an agent search, answer from, and deliberately update the same files you edit in Obsidian, vim, or any
other editor. The files remain the source of truth; Akno's SQLite index is disposable and can be rebuilt at any
time.

Akno is useful when an agent needs continuity across conversations but its memory must remain inspectable,
citable, reversible, and independent of a chat provider.

> **Status:** active development and used on a real personal knowledge base. Reading, writing, ingestion,
> evidence-graph retrieval, grounded answering, and autonomous maintenance are implemented at Akno's current
> single-writer service boundary. Automatic changes use sealed plans, separate decisions, verification, and
> durable safety pauses. Defaults remain conservative: model-dependent inference is opt-in and scheduled
> maintenance starts in audit mode. User guidance now follows human edits, agent writes, and dream outcomes
> through one end-to-end memory lifecycle. The release gate exercises the actual installed tarballs through
> first-run configuration, indexing, and recall, while schedule health keeps ephemeral dry-run diagnostics
> separate from real full cycles. Recall, context, and timeline now expose one canonical typed result shape,
> without pre-release compatibility aliases that could hide evidence. Remaining work is narrower release
> hardening and explicitly deferred capabilities, not an unfinished core workflow.

## Why use it?

Ordinary retrieval gives an agent fragments. Akno gives it evidence with enough structure to act responsibly:

- Every returned claim has a page line or document-page citation.
- `empty`, `degraded`, and `unavailable` are different results, so “not recorded” is never inferred from a
  broken search path.
- `recall` finds and ranks evidence; `answer` produces a separately verified grounded response.
- Pages, source documents, inferred observations, and ignored material have different retrieval policies.
- Writes are journalled and undoable.
- Nightly maintenance plans exact diffs before a human or separate curator decides what may apply.
- Orphan documents are searchable immediately; organization never blocks retrieval.

Akno does not replace your editor, backup system, or judgment. It only knows what the indexed files and
documents contain.

## Quick start

Akno currently supports macOS and requires Node 22.18 or newer.

```bash
npm install -g @tenphi/akno
akno init
```

Guided setup asks for the notes folder, model strategy, and maintenance authority. It also classifies visible
top-level folders as managed memory, searchable read-only knowledge, or source/reference material. For a trusted
agent it offers a guarded `memory/inbox` fallback; the fallback is configuration only and no page is created by
setup. Existing installations leave folder policy unchanged unless you explicitly review it. The model choices
are:

- the benchmark-qualified OpenAI minimum: `text-embedding-3-small` plus `gpt-5.6-luna` through one endpoint;
- a model-free lexical setup that sends no content to a model; or
- a specialist/manual setup that preserves existing provider and model blocks.

For the OpenAI setup, provide the credential through the environment. Akno stores only the variable name:

```bash
export AKNO_OPENAI_API_KEY="..."
akno init
```

The configuration write is isolated from later actions. Guided setup then offers, with a separate confirmation
for each, to build the disposable index, run a first recall, and install the macOS background service with its
nightly schedule. Every offer defaults to no; non-interactive setup remains configuration-only. The equivalent
commands are:

```bash
akno index
akno doctor
akno recall "How long is the Zephyr QX-100 warranty?"
```

Need invented notes to try? Copy [`examples/demo-brain`](examples/demo-brain) and follow the
[getting-started guide](docs/getting-started.md#try-the-demo-knowledge-base).

## The working model

```text
Markdown pages + documents
          │
          ├── index/watch ──> disposable search, facts, events, and evidence graph
          │                         │
          │                         └── recall / answer / read / timeline / context
          │
          └── journalled writes <── write / remember / ingest / guarded dream plans
```

Four ideas explain most of Akno:

1. **Files are authoritative.** Indexing reads the knowledge base and writes nothing there by default.
2. **Evidence and knowledge differ.** A contract or transcript can be searchable without becoming a fact Akno
   treats as canonical.
3. **Discovery and synthesis differ.** Use `recall` to inspect relevant evidence and `answer` when you want a
   direct, verified response.
4. **Autonomy is policy.** `audit`, `review`, and `autonomous` select who decides a sealed maintenance proposal;
   they do not bypass page opt-ins, folder rules, limits, or verification.

See [The memory lifecycle](docs/memory-lifecycle.md) for the everyday human/agent workflow and
[How Akno works](docs/how-it-works.md) for the implementation data flow.

## Main commands

| Intent                      | Commands                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Find or inspect memory      | `recall`, `answer`, `read`, `list`, `timeline`, `graph`, `context`                    |
| Capture or correct memory   | `write`, `remember`, `forget`, `undo`, `move`, `folder`                               |
| Bring in documents          | `ingest`, `inbox`, `adopt`                                                            |
| Maintain the knowledge base | `dream`, `plan`, `approve`, `decline`                                                 |
| Operate Akno                | `init`, `index`, `serve`, `service`, `doctor`, `rules`, `config`, `bench`, `redeploy` |

`akno --help` and `akno <command> --help` describe the installed interface. The
[command reference](docs/commands.md) explains which operation to choose and whether it writes.

## Autonomous maintenance

`akno dream` is a seven-phase maintenance cycle, not a prompt that rewrites the whole folder. It detects
conflicts before inference, plans observations and page maintenance, files orphan documents, then reports
remaining repair and housekeeping work.

Every writable item is a durable exact proposal with sealed inputs. The configured profile determines the
decision point:

| Profile      | Behavior                                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| `audit`      | Produce inspectable plans; apply nothing. This is the default.                    |
| `review`     | Wait for explicit human decisions.                                                |
| `autonomous` | Ask a separate curator turn and apply only accepted, still-valid, budgeted items. |

Start by inspecting one audit run:

```bash
akno dream --mode audit
akno dream status --pending
```

Read [The dream cycle](docs/dream-cycle.md) before enabling scheduled writes.

## Documentation

| Guide                                        | Use it for                                                            |
| -------------------------------------------- | --------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)   | Installation, guided setup, the demo, and a safe adoption path        |
| [Memory lifecycle](docs/memory-lifecycle.md) | Human edits, agent writes, dream outcomes, and concurrent changes     |
| [Core concepts](docs/concepts.md)            | Pages, documents, roles, rules, evidence, identity, and result states |
| [Configuration](docs/configuration.md)       | Config layers, secrets, models, profiles, and knowledge-base rules    |
| [Reading memory](docs/reading.md)            | Recall, grounded answers, graph, timeline, and automatic context      |
| [Writing and ingestion](docs/writing.md)     | Exact writes, remember, documents, inbox, undo, and adoption          |
| [The dream cycle](docs/dream-cycle.md)       | Phases, plans, policies, budgets, decisions, and verification         |
| [How Akno works](docs/how-it-works.md)       | Architecture, indexing, retrieval, writes, and service boundaries     |
| [Operations](docs/operations.md)             | Service installation, diagnostics, recovery, privacy, and platform    |
| [Benchmarks](docs/benchmarks.md)             | Quality gates, latency evidence, and the qualified OpenAI preset      |
| [Limitations](docs/limitations.md)           | Current capability boundaries and intentionally unsupported cases     |
| [Command reference](docs/commands.md)        | Complete command-purpose/write/model map                              |

The [`docs/` index](docs/README.md) groups these by common user journeys.

## Development

For a checkout:

```bash
pnpm install
pnpm build
cp config/local.example.jsonc config/local.jsonc
pnpm test
pnpm akno init
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) for architecture and testing invariants, and [AGENTS.md](AGENTS.md) for
the repository's strict rule against copying real knowledge-base data into tests, documentation, or commits.

## License

Akno is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Personal and other
noncommercial use is permitted; commercial use requires a separate licence.
