# Command reference

This table answers three questions: which command matches the user's intent, whether it can change their
knowledge base, and which model roles may be involved.

| Command               | Purpose                                                    | Knowledge-base write?      | Model roles                                   |
| --------------------- | ---------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| `init`                | Configure or check guided setup                            | No                         | Embedding and reranker with `--check`         |
| `index`               | Reconcile derived state with files                         | No by default              | Embedding, derive                             |
| `recall <query>`      | Find and rank cited page/document evidence                 | No                         | Expansion, embedding, reranker                |
| `answer <question>`   | Return a direct grounded answer and citations              | No                         | Expansion, embedding, answer; reranker opt-in |
| `read <slug>`         | Read one exact page or document                            | No                         | None                                          |
| `list`                | Browse folders, pages, or a tree                           | No                         | None                                          |
| `graph [seed]`        | Inspect bounded exact evidence paths and locators          | No                         | None                                          |
| `timeline`            | Retrieve authored events and typed document dates          | No                         | None                                          |
| `context <query>`     | Assemble broad context or precision-first automatic recall | No                         | Embedding; reranker at an ambiguous boundary  |
| `write`               | Create, append, patch, or replace a page                   | Yes                        | Vision for textless attachments only          |
| `remember <text>`     | Extract durable knowledge and route it                     | Yes or held proposal       | Maintenance or derive, plus recall roles      |
| `folder <path>`       | Declare a folder and its default policy                    | Yes, `akno.jsonc`          | None                                          |
| `approve` / `decline` | Resolve a held routing proposal                            | Approval may write         | Depends on the held action                    |
| `forget`              | Retract a fact or trash a page/document                    | Yes                        | None                                          |
| `undo <change-id>`    | Restore exact bytes from a journalled change               | Yes                        | None                                          |
| `move <from> <to>`    | Move a page and its owned documents                        | Yes                        | None                                          |
| `ingest <path\|url>`  | Extract, name, route, store, and index                     | Yes                        | Derive; vision when needed                    |
| `inbox`               | Process arrivals in configured routed folders              | Yes                        | Same as ingest                                |
| `adopt <document-id>` | Give an orphan document a minimal owned page               | Policy-dependent plan      | Maintenance or derive                         |
| `dream`               | Run the seven maintenance phases                           | Depends on policy          | Maintenance or derive                         |
| `plan`                | Inspect, decide, and apply durable maintenance items       | Apply only                 | None after planning                           |
| `serve`               | Run watcher and operation doors                            | No by itself               | None by itself                                |
| `service`             | Install, inspect, or remove background jobs                | Outside the knowledge base | None                                          |
| `doctor`              | Diagnose paths, index, models, and structural warnings     | No                         | Probes configured roles                       |
| `rules [path]`        | Explain effective folder and maintenance policy            | No                         | None                                          |
| `config`              | Print resolved, redacted configuration                     | No                         | None                                          |
| `bench`               | Measure latency and invented-corpus quality gates          | Only explicit write test   | Roles selected by target                      |
| `redeploy`            | Build, restart, and wait for the local service             | No                         | None                                          |

Add `--help` to any command for its current flags and examples:

```bash
akno --help
akno recall --help
akno dream --help
```

Commands that support machine-readable output accept `--json`.

## Global flags

| Flag                 | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `--akno-path <path>` | Override the knowledge base for this invocation        |
| `--state-dir <path>` | Override disposable/durable operational state location |
| `--json`             | Use the command's structured output                    |
| `--connect`          | Require a running service; do not fall back in process |
| `-h`, `--help`       | Show command help                                      |

## Retrieval choices

- Use `recall` when you want evidence cards or intend to synthesize with another model.
- Use `answer` when you want Akno to answer a memory question and verify its support.
- Use `read` when you already know the exact slug or document id.
- Use `graph` when the relationship path matters more than page content.
- Use `timeline` when time is the primary filter.
- Use `context --profile auto_recall` from an agent host before a substantive turn with no explicit memory
  question.

See [Reading memory](reading.md) for ranking, qualification, citations, and result-state details.

## Write choices

- Use `write` when destination and wording are already known.
- Use `remember` when Akno must decide what is durable and where it belongs.
- Use `ingest` for a file, folder, or URL; use `inbox` for configured drop folders.
- Use `forget` for a deliberate retraction and `undo` when reversing a known Akno change.
- Use `plan` for maintenance decisions. `approve` and `decline` are for held remember/ingest routing proposals,
  not dream-plan items.

See [Writing and ingestion](writing.md) and [The dream cycle](dream-cycle.md).

## Agent operations

The CLI names correspond to operations in the shared protocol registry. Agent hosts should discover schemas
from MCP or use the typed client rather than constructing CLI arguments. Some operator-only surfaces—service
management, journal listing, plan decisions, and broad private diagnostics—are intentionally not granted to an
agent merely because it can call memory.
