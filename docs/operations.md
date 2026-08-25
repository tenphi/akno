# Operations

Akno can run for one command at a time or as a long-lived macOS service. The service is the normal agent
integration: it keeps the index warm, watches the knowledge base, owns the single write handle, and exposes the
same operation registry through several transports.

## Run in process

```bash
akno index
akno recall "Zephyr QX-100 warranty"
```

Without a service, most CLI commands open Akno in the current process. With a service, commands that need the
writer are forwarded to it. `--connect` requires a live service and disables the in-process fallback.

For foreground integrations:

```bash
akno serve
akno serve --mcp
akno serve --http 127.0.0.1:7777
```

- The Unix socket is the default local door. Owner-only filesystem permissions are its authentication.
- MCP is a stdio adapter for agent hosts. `server.mcp_allow` controls which operations the agent receives.
- HTTP is for a containerized agent that cannot open the host socket. It has no built-in authentication; bind it
  only to loopback and expose the smallest useful allow list.

## Install the background service

```bash
akno service install --no-dream
akno service install
akno service install --dream-hour 2
akno service status
akno service uninstall
```

`service install` writes macOS launchd user agents:

| Label                   | Behavior                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `dev.akno`              | KeepAlive service for the index, watcher, models, socket, and write handle |
| `dev.akno.dream`        | One nightly `akno dream --scheduled` pass; default 03:00 local time        |
| `dev.akno.dream-health` | Checks for a missed cycle after a two-hour grace window                    |

The scheduled command resolves `maintenance.profile` and policies at run time. Changing authority therefore
does not require reinstalling the schedule. Re-run installation after an Akno upgrade when release notes say
the launchd definition changed.

`service uninstall` removes Akno's launchd files and prints the corresponding `launchctl bootout` commands. It
does not remove the knowledge base or state directory.

## Nightly status and notifications

```bash
akno dream status
akno dream status --last 10
akno dream status --run <run-id>
akno dream status --pending
```

Status includes the next expected schedule, recent durable runs, policy, typed model degradation, decisions,
verification, and budget use. The normal surface is content-safe: inspect exact private changes only with
`akno plan diff <plan-id>`.

Local notifications are off by default:

```jsonc
{
  "maintenance": { "notifications": "actionable" },
}
```

`actionable` reports review backlog, failures, incomplete verification, exhausted budgets, repeated typed
degradation, and missed schedules. `all` also reports healthy scheduled completion. Notifications contain
counts, states, timestamps, and run ids—not note text, paths, diffs, prompts, model output, or provider errors.

## Diagnostics

Run these before changing configuration or deleting state:

```bash
akno doctor
akno doctor --no-probe
akno config
akno rules
akno rules products/zephyr-qx-100.md
akno service status
```

`doctor` reports:

- knowledge-base and state locations;
- whether this process can acquire the writer;
- page, chunk, fact, event, document, and broken-link counts;
- storage-only lookup latency;
- model-role availability, schema probes, latency, and the cost of each missing role;
- extraction support; and
- reserved-path collisions.

Probe failures are operational evidence, not a reason to erase the index. Use `--no-probe` for an immediate
configuration-and-index report without network model calls.

`config` shows every loaded source and the resolved configuration. API keys, authorization headers, passwords,
tokens, and similarly named future secret fields are redacted recursively. `rules` explains effective path and
maintenance policy, including why a transformation is off, audit-only, reviewable, or potentially automatic.

## State and recovery

The default installed state lives under `~/.akno`; `state_dir` can move it. Its important contents are:

```text
<state_dir>/
  akno.db       derived index, journal, gates, plans, and run receipts
  akno.sock     local service socket
  akno.lock     current writer metadata
  trash/        recoverable forgotten files
  logs/         service and scheduled-cycle logs
```

Recovery depends on what is wrong:

| Symptom                                      | First action                                           |
| -------------------------------------------- | ------------------------------------------------------ |
| Search is stale or derived state looks wrong | Run `akno index`                                       |
| A journalled write was wrong                 | Run `akno undo <change-id>`                            |
| A page or document was forgotten             | Undo it or recover it from `trash/` within retention   |
| A maintenance item is unclear                | Inspect `dream status` and `plan diff` before applying |
| Models changed behavior                      | Run `doctor`, then the relevant benchmark              |
| Service seems stale after a checkout edit    | Run `pnpm akno redeploy`                               |

Do not delete `akno.db` merely to refresh search: it also contains undo history, gated writes, maintenance
plans, and run receipts. If those durable records no longer matter and a clean rebuild is intentional, stop
the service first and use the supported index workflow rather than removing files under a live writer.

Akno's trash and journal are not backups. Keep the Markdown knowledge base under normal backup or version
control.

## Updating a checkout

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm akno redeploy
```

`redeploy` builds packages, restarts the launchd service, and waits until the socket is ready. Building matters:
the running CLI imports compiled core and client packages, so restarting without a build can silently keep old
behavior.

Use `pnpm akno redeploy --no-restart` for a checkout without an installed service, or `--no-build` only when no
compiled package changed.

## Privacy boundaries

Akno sends only the content needed by an invoked model role to the configured endpoint. A lexical-only setup
sends nothing to a model. `doctor` uses invented probe text; opt-in live benchmarks use their own invented
corpora rather than the configured knowledge base.

Operational output is content-safe by default. Commands that deliberately display memory—such as `recall`,
`read`, `answer`, and `plan diff`—are private-content surfaces and should not be copied into public logs or bug
reports without inspection.

The owner controls both the files and service. Akno currently has no per-user authorization, tenancy, or
untrusted collaborative-write model.

## Platform

Akno's core and CLI target macOS. Document extraction deliberately uses PDFKit, Vision, and `textutil`; service
installation deliberately uses launchd. These paths are tested as one platform rather than maintained as
untested portability branches.

`@tenphi/akno-client` and `@tenphi/akno-protocol` are portable. A Linux container or another process can call an
Akno service running on the macOS host through loopback HTTP or the Unix socket where available.
