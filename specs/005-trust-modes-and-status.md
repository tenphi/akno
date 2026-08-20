# Trust modes and maintenance status

- **Status:** proposed
- **Depends on:** [Maintenance plans and decisions](001-maintenance-plans-and-decisions.md),
  [Dream lifecycle](003-dream-lifecycle.md)

## Problem

Today, trust is spread across phase enable flags, write flags, page frontmatter, command-line dry runs, and
whether the scheduler was installed. That is safe in pieces but hard to understand as a product. A user cannot
answer, in one place, “What will Akno do tonight?” or “What did it change while I was away?”

Audit-only operation matters, but the primary experience should also support meaningful autonomy without a
maze of booleans.

## Outcome

Akno exposes three trust modes with increasing authority:

| Mode     | Plan | Decision                               | Apply                                            |
| -------- | ---- | -------------------------------------- | ------------------------------------------------ |
| `audit`  | yes  | none                                   | never                                            |
| `review` | yes  | human; optional curator recommendation | only after explicit approval                     |
| `auto`   | yes  | separate curator turn                  | automatically apply accepted items within policy |

The mode is a ceiling. A command-line override may lower authority for one run but cannot raise it above the
configured profile without an explicit confirmation or configuration change. `--dry-run` is an alias for
`--mode audit`.

Autonomous mode does not skip review. It assigns review to a curator model operating in a separate turn from
the planner, then applies accepted items that pass deterministic guards and scope limits.

## Profiles

Users select a named profile during setup or configure one directly:

```jsonc
{
  "maintenance": {
    "profile": "autonomous",
    "policies": {
      "hygiene": "auto",
      "broken_link": "auto",
      "split": "auto",
      "extract": "auto",
      "merge": "review",
      "contradiction": "review",
      "synthesis": "auto",
      "adopt": "auto",
    },
    "limits": {
      "max_items": 30,
      "max_files_changed": 40,
      "max_bytes_written": 500000,
      "max_high_risk_items": 3,
    },
  },
}
```

Policy values are:

- `off`: do not inspect or plan this class;
- `audit`: plan and report it, regardless of the run's higher authority;
- `review`: wait for a human decision;
- `auto`: send to the curator and automatically apply accepted work when the run mode permits it.

A lower run mode lowers every per-class policy for that invocation. An `audit` policy never becomes writable
because the run is `auto`.

Suggested profiles:

- `audit`: every supported class is `audit`;
- `review`: low-risk classes and adoption are `review`; high-risk classes are `audit` until enabled;
- `autonomous`: hygiene, stable link repair, split/extract, synthesis, and adoption are `auto`; merge and
  contradiction resolution initially remain `review`;
- `custom`: explicit policies and limits, with no inferred defaults hidden from `akno config`.

The suggested autonomous profile is a product starting point. Benchmark results and real-world receipts should
determine whether additional classes graduate to automatic application.

## Layered boundaries

Authority is the intersection of several boundaries:

1. run mode;
2. transformation policy;
3. folder rules;
4. page `akno.management.dream` policy;
5. protected-path and file-type rules;
6. deterministic safety checks;
7. run and risk budgets;
8. curator or human decision.

The most restrictive boundary wins. `akno rules <path>` should explain the resolved maintenance authority and
name every layer that narrowed it.

No profile may authorize writes outside the knowledge-base root, protected paths, or page-level `dream: none`.
Changing a profile never rewrites existing page opt-ins.

## Status experience

Add one high-level command:

```text
$ akno dream status
Maintenance: autonomous
Schedule: nightly at 03:00; next run in 6h 14m
Last run: completed with review items, 2030-01-02 03:04
  planned 12 · curator accepted 8 · applied 8 · verified 8
  review 2 · rejected 1 · blocked 1
  changed 9 files · journal changes chg_01J... … chg_01J...
Model: openai/gpt-5.6-luna
Degraded: embedding unavailable; recall uses lexical search
```

The default view answers:

- Is maintenance scheduled and currently running?
- What mode and per-class policies are effective?
- When did the last run happen, and when is the next one?
- What was proposed, accepted, changed, rejected, blocked, or left for review?
- Did verification pass?
- Which model capabilities were used or degraded?
- How much model work and wall time did the run consume?
- Which plan, receipt, and journal ids provide more detail?

Options include:

- `akno dream status --json`
- `akno dream status --run <run-id>`
- `akno dream status --last 10`
- `akno dream status --pending`
- `akno dream status --explain-policy <path>`

`doctor` continues to diagnose whether capabilities are available. `dream status` reports what maintenance is
configured to do and what actually happened. Neither should require reading raw JSONL logs.

## Notifications and summaries

Every completed scheduled run writes a compact receipt and optionally emits a local notification. The summary
uses the same vocabulary as status. It never includes private page bodies or model prompts.

Notifications are meaningful only for actionable states:

- review items waiting;
- verification or apply failure;
- repeated degradation that prevents a configured policy;
- budget exhaustion that leaves a persistent backlog;
- no successful run within the expected schedule window.

“No changes needed” is a successful, quiet state. An opt-in verbose mode may notify on every run.

## Audit-only behavior

Audit mode performs every selected inspection and planner model call necessary to produce realistic proposals,
but it:

- never writes knowledge-base files;
- never asks the curator to approve an apply;
- never creates change-journal entries;
- persists the complete plan and check results;
- reports estimated model usage for later auto runs;
- can be run while a scheduler uses another profile, without changing that profile.

An audit plan may later be reviewed, but apply requires all input hashes to remain current. A plan that is stale
must be regenerated; approval does not waive the hash check.

## Curator requirements

Automatic mode requires a configured curator capability. If it is unavailable, items become `degraded` and
remain planned; Akno does not silently replace curator review with automatic approval.

The curator may share a model id and provider with the planner, but it uses:

- a separate request and prompt;
- a structured decision schema;
- the complete sealed item and deterministic validation evidence;
- no write tool or operation surface;
- configured reasoning and output limits;
- a recorded prompt version in the receipt.

A curator recommendation in review mode is advisory. The human decision and actor remain separately recorded.

## Configuration migration

Existing installations retain their effective behavior. Migration translates phase enable/write flags into a
generated `custom` profile and prints it through `akno config`. Akno must not upgrade an existing dry-run or
write-disabled phase to `auto`.

New setup may recommend a profile but must state plainly whether scheduled writes are allowed. Choosing the
autonomous profile is one explicit decision, not a sequence of hidden confirmations for every low-risk class.

## Acceptance criteria

- One status command explains configured authority, schedule, last result, pending review, and verification.
- `--mode audit` performs zero knowledge-base writes even when the configured profile is autonomous.
- Per-class `audit` or `review` policy cannot be elevated by an automatic run.
- Curator outage produces a typed degradation and no automatic approval.
- Folder and page restrictions are visible in a path-specific policy explanation.
- Existing installations preserve their effective write behavior after migration.
- A new user can deliberately choose autonomous maintenance during setup without editing many phase booleans.
- Receipts and notifications reveal no page bodies, diffs, or prompts.
- “No changes needed” is recorded as success rather than empty, degraded, or unavailable.

## Non-goals

- Remote alert delivery in the first implementation.
- A universal risk score that replaces transformation-specific guards.
- Automatically changing a user's trust profile based on model confidence.
- Making audit mode free of model calls; it must model the real proposed behavior.

## Open questions

- Should the initial autonomous profile keep split/extract in `review` until enough audit receipts exist?
- Which failures should pause the schedule automatically versus retry on the next scheduled run?
- Should the CLI offer a one-command “promote this class after N clean audit runs” workflow?
