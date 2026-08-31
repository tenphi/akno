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

Akno verifies the service handshake against the resolved knowledge-base path before forwarding anything. A
command with `--akno-path`, `--state-dir`, `AKNO_CONFIG`, `AKNO_PATH`, or `AKNO_STATE_DIR` therefore cannot
silently use a conventional socket owned by another memory. If the requested memory has its own service, pass
the matching state directory; otherwise stop that service or let the command run in process. An invalid
explicit config remains a configuration error even when another Akno service is available.

For foreground integrations:

```bash
akno serve
akno serve --mcp
akno serve --http 127.0.0.1:7777
```

- The Unix socket is the default local door. Owner-only filesystem permissions are its authentication.
- MCP is a stdio adapter for agent hosts. `server.mcp_allow` controls which operations the agent receives,
  including when the adapter forwards through an already-running service. `--allow` can narrow that policy;
  it cannot widen it.
- HTTP is for a containerized or remote agent that cannot open the host socket. Unauthenticated loopback
  callers receive only `server.http_public_allow`, which may narrow but cannot widen the read-only public
  surface. A non-loopback bind requires at least one resolved bearer identity in `server.http_access`; each
  credential owns its actor and allowlist.

For authenticated HTTP, keep the credential in the environment and only name it in config:

```jsonc
{
  "server": {
    "http": "0.0.0.0:7777",
    "http_access": [
      {
        "name": "vulpine-agent",
        "token": { "env": "AKNO_HTTP_AGENT_TOKEN" },
        "actor": "agent",
        "allow": ["recall", "answer", "read"],
      },
    ],
  },
}
```

The typed client passes that credential with `connect({ http, token })`. HTTP rejects `x-akno-actor` and client
actor overrides, because identity is assigned by the server credential. The built-in listener is plain HTTP;
put a non-loopback deployment behind a trusted tunnel or TLS reverse proxy so the bearer token is encrypted in
transit, and restrict access from that proxy to Akno.

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

During the initial planner wave, the service holds one index revision. Watcher and explicit index passes that
reach the shared indexer are queued, not discarded, then drained before curator decisions and apply. Filesystem
edits themselves remain available and are handled by stale-input and whole-tree verification after the barrier.
A foreground memory mutation instead takes priority: its structural index completes immediately, invalidates
the planner revision, and makes the dream stop before curator decisions or writes. Post-response model
derivation may finish later without delaying the foreground result.

`service uninstall` removes Akno's launchd files and prints the corresponding `launchctl bootout` commands. It
does not remove the knowledge base or state directory.

## Nightly status and notifications

```bash
akno dream status
akno dream status --last 10
akno dream status --run <run-id>
akno dream status --pending
akno plan list --status awaiting_review
akno plan prune
```

Status includes the next expected schedule, recent durable runs, policy, typed model degradation, decisions,
item verification, final run verification, and budget use. Final verification rechecks every applied item's
sealed disk/index outcome, budget and model accounting, and the complete indexable knowledge-base diff. An
unrelated concurrent add, edit, or removal is preserved but fails certification as an aggregate
`unattributed_file_change`; paths never enter the run receipt. Inspect exact private planned changes only with
`akno plan diff <plan-id>`.

Schedule health uses the latest non-dry-run full cycle. A later `--dry-run` remains visible in run history but
cannot replace a healthy nightly result with a diagnostic failure. Use `--mode audit` when you want a durable,
realistic no-write maintenance cycle that does count as a full attempt.

If a newer run makes queued work obsolete, retire the old plan without touching the knowledge base:

```bash
akno plan supersede <plan-id> --reason "Replaced by a newer review."
```

Only work that has not begun applying can be superseded. Interrupted apply and verification states stay in
the queue so recovery cannot be hidden as cleanup.

For an automated review client, make response-loss retries explicit:

```bash
akno plan decide <plan-id> --item <item-id> --approve \
  --idempotency-key review:PLAN_ID:ITEM_ID:approve
akno plan apply <plan-id> --idempotency-key apply:PLAN_ID
```

The key is bound to the exact request and survives service restarts. An exact retry is a no-op; reuse for a
different decision or action is rejected as a conflict. Completed apply retries report `replayed: true` and no
new file changes.

`akno plan prune` is a content-safe preview of the configured two-stage retention boundary, including exact
private bytes eligible for removal. Add `--apply` for an immediate manual pass. Every writable dream run also
enforces the same policy: terminal exact operations/evidence expire before compact audit receipts, while active
or recovery-relevant plans are retained without an age limit. This state cleanup never touches Markdown or the
separate change journal.

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
akno doctor --no-probe --admission-preview
akno doctor --refresh-api
akno config
akno rules
akno rules products/zephyr-qx-100.md
akno service status
```

`doctor` reports:

- knowledge-base and state locations;
- whether this process can acquire the writer;
- page, chunk, fact, event, document, and broken-link counts;
- admitted, explicit read-only, and implicit read-only fact-injection counts; the opt-in admission preview adds
  top-level folder globs and authority-preserving `remember: deny` patches without page identities or content;
- storage-only lookup latency;
- model-role availability, schema probes, latency, and the cost of each missing role;
- extraction support; and
- reserved-path collisions.

Probe failures are operational evidence, not a reason to erase the index. Use `--no-probe` for an immediate
configuration-and-index report without network model calls. `--refresh-api` ignores cached `api: auto`
selections and repeats only the invented transport probes; it cannot be combined with `--no-probe`.

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
  provider-capabilities.json  content-free api:auto selections
  trash/        recoverable forgotten files
  logs/         service and scheduled-cycle logs
```

Recovery depends on what is wrong:

| Symptom                                      | First action                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| Search is stale or derived state looks wrong | Run `akno index`, or `akno index --rebuild` for a full refresh |
| A journalled write was wrong                 | Run `akno undo <change-id>`                                    |
| A page or document was forgotten             | Undo it or recover it from `trash/` within retention           |
| A maintenance item is unclear                | Inspect `dream status` and `plan diff` before applying         |
| A plan has the right scope but wrong result  | Correct it with `plan revise`; then review it again            |
| Automatic apply is paused                    | Inspect status/plans, then use the displayed resume command    |
| Models changed behavior                      | Run `doctor`, then the relevant benchmark                      |
| Service seems stale after a checkout edit    | Run `pnpm akno redeploy`                                       |

Do not delete `akno.db` merely to refresh search: it also contains undo history, gated writes, retained-source
receipts, maintenance plans, recovery state, and run receipts. `akno index --rebuild` re-hashes every file and
recomputes reproducible page, chunk, embedding, derivation, and graph projections in place. It is safe through
the running service and preserves every durable record.

Akno's trash and journal are not backups. Keep the Markdown knowledge base under normal backup or version
control.

### Automatic-apply recovery

`akno dream status` reports durable recovery state separately from configured authority. Akno pauses the whole
automatic profile when final verification cannot prove its live bytes, sealed plan, or journal receipt. Three
distinct automatically rolled-back items of one transformation pause only that class; unrelated maintenance
continues. A verified later attempt clears a pre-threshold streak, but a pause never silently clears itself.

After inspecting the referenced run and private plan details, resume explicitly:

```bash
akno dream resume --profile
akno dream resume --transform merge
```

Resume clears the selected safety state; it does not alter configuration, approve a plan, or apply anything.
Audit and review runs remain available while the autonomous profile is paused. Transient request retries stay
bounded inside the model client, while ordinary nightly cadence supplies the later retry for model outages and
fresh run budgets—Akno does not create a hidden multi-day retry schedule.

## Updating a checkout

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm akno redeploy
```

`redeploy` builds packages, restarts the launchd service, and waits until the socket is ready. It uses a
30-second fast readiness window and, when launchd confirms that the replacement process is still running, a
bounded three-minute live-handoff window. `--timeout <seconds>` replaces both with an explicit hard deadline.
Building matters:
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
