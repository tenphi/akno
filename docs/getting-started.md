# Getting started

This guide takes Akno from an empty installation to a useful, read-only first result. New recommended and
model-free configurations leave knowledge-base files unchanged; updates and specialist configurations may
retain explicit metadata or rendition write opt-ins.

## Requirements

- macOS or Linux;
- Node 22.18 or newer;
- a folder containing Markdown notes, optionally with attached documents.

Akno does not download or run models. Every model role is optional and points to an OpenAI-compatible endpoint
you choose.

Markdown indexing needs no additional operating-system packages. Native document extraction has optional
platform dependencies:

- macOS compiles its PDFKit/Vision helper on demand and needs the Xcode command line tools for PDF and image
  extraction (`xcode-select --install`); `textutil` handles supported office formats.
- Linux uses Poppler for PDF text and rasterization, Tesseract for OCR, and LibreOffice for supported office
  formats. On Debian or Ubuntu, install all three paths with:

  ```bash
  sudo apt-get install poppler-utils tesseract-ocr libreoffice-writer
  ```

Missing tools do not disable Akno or Markdown indexing. `akno doctor` reports the available extraction backend
and commands, and ingestion returns typed degradation for an affected document rather than hiding the gap.

## Install and configure

```bash
npm install -g @tenphi/akno
akno init
```

Guided setup first asks about configuration and write boundaries:

1. Which folder is the knowledge base?
2. Which model strategy should Akno use?
3. Is it connected to a trusted agent, operated with human review, or intended to remain read-only?
4. Which maintenance profile should be written?
5. Which visible top-level folders are managed memory and which are source/reference material?
6. Should unroutable durable claims have one exact managed fallback page?

Folder discovery reads directory names only. A selected managed folder becomes `knowledge + remember:
integrate`; a selected source/reference folder becomes `source + remember: deny`. Every other discovered folder
is written explicitly as searchable read-only knowledge, so its files remain intact but still participate in
recall. Hidden folders and Akno's operational directories are not offered. Existing configurations default to
keeping their current folder and fallback policy untouched.

For an autonomous trusted-agent setup, the fallback offer defaults to `memory/inbox`. Accepting it adds an
explicit `memory/**` managed rule when needed, but does not create the folder or page. Normal routing and an
admitted model-suggested page still take priority. The fallback is a temporary queue rather than a canonical
home; later managed-item curation can move its items only to unambiguous existing admitted pages. See
[Remember fallback](configuration.md#remember-fallback).

It then shows the exact configuration overlay and a path-only diff before asking to write. Once the config is
safe on disk, it separately offers to build the index, run a first recall, and install the platform background
service plus nightly schedule: launchd on macOS or systemd `--user` on Linux. Every follow-up explains its
boundary and defaults to no. Declining one leaves
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

An existing config is never silently replaced. Guided updates default to leaving folder policy unchanged, show
a path-only diff for every accepted change, and default to not applying it. Non-interactive updates require
`--force` and do not classify folders or configure a fallback implicitly.

Before reviewing an existing installation interactively, inspect its authority-preserving proposal:

```bash
akno doctor --no-probe --admission-preview
```

It lists only top-level folder globs and counts—never page slugs or content—and proposes `remember: deny` so
implicit read-only behavior becomes explicit without promoting any page. Root-level pages remain a separate
count. Use `akno init` when you are ready to classify folders deliberately.

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

The repository contains only invented material under
[`examples/demo-brain`](https://github.com/tenphi/akno/tree/main/examples/demo-brain).

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

On macOS this manages launchd agents. On Linux it manages systemd user services and timers, so
`systemctl --user` must be available for the account running Akno. Foreground and in-process operation remain
available when no user service manager is present.

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
