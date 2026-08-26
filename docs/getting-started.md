# Getting started

This guide takes Akno from an empty installation to a useful, read-only first result. New recommended and
model-free configurations leave knowledge-base files unchanged; updates and specialist configurations may
retain explicit metadata or rendition write opt-ins.

## Requirements

- macOS;
- Node 22.18 or newer;
- a folder containing Markdown notes, optionally with attached documents.

Akno does not download or run models. Every model role is optional and points to an OpenAI-compatible endpoint
you choose.

## Install and configure

```bash
npm install -g @tenphi/akno
akno init
```

Guided setup first asks four configuration questions:

1. Which folder is the knowledge base?
2. Which model strategy should Akno use?
3. Is it connected to a trusted agent, operated with human review, or intended to remain read-only?
4. Which maintenance profile should be written?

It then shows the exact configuration overlay and a path-only diff before asking to write. Once the config is
safe on disk, it separately offers to build the index, run a first recall, and install the macOS background
service plus nightly schedule. Every follow-up explains its boundary and defaults to no. Declining one leaves
an explicit command to run later; a failed follow-up never rolls back the valid config. Non-interactive setup
always stops after the configuration write. Accepted actions stay pinned to the knowledge-base and state paths
shown in the preview, including paths written into background-service definitions.

Indexing under the OpenAI preset sends configured page or document inputs to OpenAI to build derived search
data. Model-free indexing stays local. A first recall is offered only after the index succeeds, and prompts for
your actual question rather than running an irrelevant example query.

### Choose a model strategy

| Strategy          | Use it when                              | Result                                                                                                            |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| OpenAI minimum    | You want the simplest hosted setup       | One Responses endpoint and credential; `text-embedding-3-small` for embeddings and `gpt-5.6-luna` for other roles |
| No models         | You want local lexical retrieval only    | Every model caller is explicitly disabled; existing provider definitions remain dormant                           |
| Specialist/manual | You already have role-specific endpoints | Akno writes the path/profile and preserves provider and model blocks                                              |

For the OpenAI option, put the credential in the environment. The config stores only its variable name:

```bash
export AKNO_OPENAI_API_KEY="..."
akno init
```

The optional setup preflight sends only invented fixtures. It checks embedding access separately from Luna's
structured ranking contract, so access to one model cannot hide a denial for the other.

For automation, supply every required value explicitly:

```bash
akno init --preset openai-luna --akno-path /path/to/markdown \
  --maintenance autonomous --dry-run --check

akno init --preset no-model --akno-path /path/to/markdown \
  --maintenance audit
```

An existing config is never silently replaced. Guided updates show a diff and default to no; non-interactive
updates require `--force`.

## Build the first index

```bash
akno index
akno doctor
```

Run `index` before `doctor`: many diagnostics compare configured capabilities with what the index actually
contains.

Indexing is read-only by default. It scans Markdown and documents, derives its search state, and leaves the set
and bytes of knowledge-base files unchanged. The notable opt-ins are documented in
[Configuration](configuration.md#settings-that-may-create-files).

## Ask the first question

Use `recall` when you want inspectable evidence:

```bash
akno recall "How long is the Zephyr QX-100 warranty?"
```

Use `answer` when you want Akno to compose and verify the direct response:

```bash
akno answer "How long is the Zephyr QX-100 warranty?"
```

Every useful excerpt carries a Markdown line or document-page locator. Read the exact source when needed:

```bash
akno read products/zephyr-qx-100
```

See [Reading memory](reading.md) for the difference between recall, answer, graph, timeline, and automatic
context.

## Try the demo knowledge base

The repository contains only invented material under [`examples/demo-brain`](../examples/demo-brain).

```bash
cp -R examples/demo-brain /tmp/akno-demo
export AKNO_STATE_DIR=/tmp/akno-demo-state
akno --akno-path /tmp/akno-demo index
akno --akno-path /tmp/akno-demo doctor
akno --akno-path /tmp/akno-demo recall "Who services the boiler?"
```

Copy the demo before trying writes because `remember`, `ingest`, and enabled maintenance phases can change it.

## Add background operation

After the first read-only session works, install the watcher without nightly maintenance:

```bash
akno service install --no-dream
akno service status
```

The service watches the folder, reconciles external edits, and gives hosts one long-lived process for the index
and model clients. Install the nightly schedule only after reading [The dream cycle](dream-cycle.md):

```bash
akno service install
```

## A safe adoption path

1. **Read only:** use `index`, `recall`, `answer`, `read`, `list`, `timeline`, and `graph`.
2. **Explicit writes:** try `write` or `remember --dry-run`; inspect the returned change id and test `undo`.
3. **Document intake:** declare folder rules, ingest one invented or replaceable file, then consider an inbox.
4. **Watcher:** install `service --no-dream` and verify external editor changes are reconciled.
5. **Maintenance audit:** run `akno dream --mode audit`, inspect pending plans, and only then choose review or
   autonomous authority.

The sequence is about learning the trust boundaries, not satisfying a technical dependency.

## Working from a checkout

```bash
pnpm install
pnpm build
cp config/local.example.jsonc config/local.jsonc
pnpm akno init
pnpm akno index
```

Use `pnpm akno`, not the installed `akno`, while developing. After code changes, `pnpm akno redeploy` builds,
restarts the service, and waits for its socket. See [Operations](operations.md#updating-a-checkout).
