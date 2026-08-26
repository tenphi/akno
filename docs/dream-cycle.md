# The dream cycle

`akno dream` is an ordered maintenance workflow. It is not one model prompt with permission to rewrite the
knowledge base.

The cycle inspects first, seals exact proposals, separates proposal from decision, applies only authorized and
still-valid items, re-indexes them, and verifies the result.

## Start with audit

```bash
akno dream --mode audit
akno dream status --pending
```

`--mode audit` creates durable exact plans without decisions or writes. Prefer it to legacy `--dry-run` when you
need to inspect diffs, pending work, or an autonomous curator-cost estimate.

## Profiles and policies

The scheduled command remains `akno dream`; authority comes from `maintenance.profile` at runtime.

| Profile      | Decision and apply behavior                                    |
| ------------ | -------------------------------------------------------------- |
| `audit`      | Seal plans and apply nothing                                   |
| `review`     | Wait for a human decision on eligible items                    |
| `autonomous` | Ask a separate curator turn; apply accepted items after guards |

A command-line mode may lower configured authority for one run. It can never promote it.

Individual transformation policies can be stricter than the profile:

```jsonc
{
  "maintenance": {
    "profile": "autonomous",
    "policies": {
      "hygiene": "auto",
      "managed_item": "auto",
      "broken_link": "auto",
      "merge": "review",
      "contradiction": "off",
    },
  },
}
```

Policy values are `off`, `audit`, `review`, and `auto`. An omitted class inherits the profile. The effective
policy is sealed on each plan item, so one plan can apply a link repair while holding a merge for review.

Profile and policy are not the only gates. Whole-page transformations require a page `dream` opt-in;
`managed_item` instead requires `remember: integrate` and owns only its marked fragment. Page role, folder
rules, protected paths, transformation-specific evidence, merge allowlists, model availability, and whole-run
budgets can only reduce authority.

## Defaults and opt-ins

Akno ships maintenance in `audit`: curation and adoption can produce exact plans, but nothing is applied
automatically. The cross-page conflict pass and housekeeping report run; document extraction and orphan
discovery remain available.

The higher-risk or privacy-sensitive surfaces require explicit configuration:

- `observe` and `reflect` are disabled until their phase/policy and page rules opt in;
- automatic curate and adopt writes require the `autonomous` profile or an explicit `auto` policy;
- the standalone `repair` phase is a disabled, report-only compatibility surface—plan-backed broken-link repair
  belongs to curate;
- `maintenance.log_changes` is off because its private line-level log duplicates sensitive material under the
  state directory; and
- `maintenance.notifications` is off because even content-safe operational alerts are an owner choice.

`review` is the intermediate authority: planners run, decisions wait for a person, and approved items still go
through stale-input, budget, re-index, and verification guards.

## The nightly order

```text
1. conflicts
2. plan observe
3. plan reflect
4. plan curate
5. plan adopt
   ── decide every automatic item ──
   ── apply in dependency order ──
   ── one bounded dependency replan ──
6. repair
7. housekeeping
```

Conflict analysis runs before inference so unresolved claims cannot quietly become observation evidence. In a
full policy-backed cycle, every writable planner finishes before the first curator call or note write. Curator
decisions finish before accepted items apply.

## Phase summary

| Phase          | Purpose                                                  | Output                                                                                 | Default write behavior            |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| `conflicts`    | Classify disagreeing cross-page facts before inference   | Typed verdicts and eligibility                                                         | Report only                       |
| `observe`      | Infer evidence-backed patterns across authored knowledge | Append/create plans for inference pages                                                | Disabled until opted in           |
| `reflect`      | Derive principles from several current observations      | Append plans for principles                                                            | Disabled until opted in           |
| `curate`       | Maintain opted-in pages and Akno-owned fragments         | Managed-item, hygiene, synthesis, split, extract, merge, contradiction, and link plans | Audit plans under default profile |
| `adopt`        | Give readable orphan documents a durable page            | Low-risk filing plans                                                                  | Audit plans under default profile |
| `repair`       | Preserve the legacy broken-link report surface           | Read-only exact proposals/refusals                                                     | Disabled/report only              |
| `housekeeping` | Report remaining structural work                         | Counts and actionable diagnostics                                                      | Report only                       |

### 1. Conflicts

Conflict analysis compares eligible facts about the same subject and attribute. Optional model verification
classifies a candidate as:

- `not_a_conflict` or `time_scoped`, where both claims may stand;
- `unresolved`, where both claims remain and curation may add a warning;
- `superseded`, where explicit dated authority permits moving one stale claim into history; or
- `qualified`, where exact evidence can narrow an over-broad claim without inventing new wording.

Unverified, unresolved, and pending qualification claims are excluded from inference and current graph edges.
Conflict status itself does not authorize a write; contradiction changes are high-risk curate items.

Conflict eligibility is also a post-write condition. A successful knowledge-page edit is re-derived before the
run finishes, then conflict candidates and graph eligibility are rebuilt from the new claims. Until that full
derivation succeeds, the page's retained pre-write facts are marked stale by its body/derivation hash mismatch
and are excluded from conflict analysis, inference, curation evidence, line-level recall metadata, and
fact-backed graph edges.

### 2. Observe

Observe looks for patterns supported by at least two distinct authored knowledge pages. It writes only derived
inference with exact evidence links. It cannot use another observation as evidence, cannot infer private-life
claims, and rejects hedged or record-describing conclusions.

The phase is off by default because guardrails can reject unsafe output but cannot make a weak model insightful.
Accepted conclusions append; they do not rewrite earlier inference.

### 3. Reflect

Reflect derives reusable principles from at least three distinct current observation pages. It uses the same
plan, decision, stale-input, append-only, re-index, and verification lifecycle as observe. It is also off by
default because small corpora make “patterns of patterns” especially fragile.

### 4. Curate

Curate has two authority boundaries. Whole-page transformations consider only pages whose own policy permits
`hygiene` or `synthesize`. Managed-item maintenance separately inspects strict Akno-owned fragments on
`remember: integrate` knowledge pages, even when the page has no `dream` value:

- **managed item:** delete an empty marker, normalize one unambiguous legacy marker, or remove an exact
  payload/provenance duplicate. It also verifies global id uniqueness, exact marker-to-fact line/hash binding,
  typed conflict participation, and section fit. A qualified classifier may select only `keep`, `move`, or
  `uncertain`; one accepted same-page move must target an existing unique `##` section, and deterministic code
  moves the complete marker-plus-payload bytes. For items created with replayable evidence, another qualified
  pass compares the generated sentence with its exact retained source quote. It may mark it supported, hold it
  as uncertain, or propose one source-grounded payload-line correction; old or unquoted items are
  `source_unavailable`. Malformed markers, missing current derivation, conflicting ids/facts, unavailable
  placement, and ambiguous placement remain typed held findings; authored surrounding prose is outside this
  transformation's authority. Marker normalization is sealed first; semantic checks wait for those canonical
  bytes on the next cycle rather than certifying an item they did not classify;

- **hygiene:** conservative formatting, local-language repair, and structurally safe cleanup;
- **synthesis:** evidence-backed rewrite or reorganization;
- **split:** keep the canonical page and atomically create bounded child pages for the same subject;
- **extract:** move one verbatim authored section into an independent reusable subject page, leaving bridges;
- **merge:** losslessly combine identity-backed duplicates in allowed folders, rewrite eligible inbound links,
  and retain the retired identity as an alias. Exact discovery uses an explicit alias or at least two distinct
  current attributes that resolve exactly through the evidence graph when the candidate title contains a
  multi-token canonical entity's complete name. Optional semantic discovery adds a bounded embedding prefilter
  and a strict same-subject classifier for compact sibling pages;
- **contradiction:** add an unresolved warning, archive an explicitly superseded line, or qualify one claim from
  exact evidence;
- **broken link:** rewrite only from exact move, alias, or canonical identity evidence.

Similarity alone never authorizes identity-changing work. A graph- or semantic-backed candidate is still
rejected when the second page has a useful separate scope. Semantic verdicts are cached by content, endpoint,
prompt, and threshold fingerprints without retaining page text or model rationale. Merge and contradiction
items are high-risk and must fit the high-risk budget. Every operation is one exact, collision-checked,
undoable unit.

### 5. Adopt

Adopt finds readable unowned documents and plans minimal filing pages. It does not make documents searchable;
they were already searchable. It improves browsing, page policy, linking, and future synthesis.

Source bytes and ownership are rechecked before apply. Missing originals cannot be adopted because the new page
would otherwise certify evidence Akno can no longer inspect.

### 6. Repair

The standalone repair phase is a compatibility report. Plan-backed broken-link changes now belong to curate,
where they use the same decision and verification lifecycle as other page transformations.

### 7. Housekeeping

Housekeeping reports the remaining state after writes: orphan documents, broken links, rule drift, graph
identity collisions, ambiguous authored subjects, traversal hubs, and other structural diagnostics. It is
read-only and grants no authority to merge or rewrite.

## The plan lifecycle

Every writable transformation follows the same stages:

1. **Inspect:** find candidates without changing files.
2. **Plan:** seal exact operations, source evidence, hashes, policy, and risk.
3. **Decide:** a human or separate curator approves, rejects, or leaves the item pending.
4. **Apply:** recheck every sealed input and reserve the whole budget before the first write.
5. **Re-index:** reconcile every affected path.
6. **Verify:** confirm the expected disk and index outcome; roll back a proven failed result.
7. **Retry dependencies once:** replan only work invalidated by successful earlier items, using remaining budget.
8. **Refresh changed claims:** derive the final page bytes, reclassify changed conflict fingerprints, and rebuild
   graph eligibility.
9. **Verify the run:** recheck every applied item together and seal a content-safe final receipt.

Proposal generation never authorizes itself in the same model turn.

## Final run verification

An item passing once is not the end of an autonomous run. After every apply and bounded dependency retry,
Akno re-runs the deterministic postconditions for all applied items attached to the run. It checks that each
has a journal id and passed item receipt, that its sealed final bytes still agree with the structural index,
and that transformation-specific identity, ownership, and link conditions still hold. It also checks the
whole-run budget against the live reservation tracker and proves that per-stage model calls and token totals
sum to the reported aggregate.

The run also stores a content-safe changed-claim receipt: changed-file and knowledge-page counts, current versus
stale derivations, final conflict candidates, and unverified candidates. No paths or claims are retained. A
model or derivation failure does not roll back an already verified authored edit; the old facts remain
non-current, the graph excludes them, and the run becomes `partially_completed` so the next index pass can
retry rather than certifying stale evidence.

The result is stored on the run as counts and typed issue codes only—never paths, page text, prompts, or
verifier details. A failed final check makes the run `failed`; the CLI exits non-zero and actionable scheduled
notifications can surface it. Akno does not overwrite a path that changed after item verification. Exact
per-item evidence and recovery details remain on the maintenance plan.

This check covers work the run claims to have applied. It does not yet freeze every planner read to one global
database revision or classify unrelated edits made elsewhere in the knowledge base as maintenance failures.

## Dependencies and concurrent edits

Before curator calls, Akno blocks automatic items that write the same path or invalidate another item's sealed
input. Exact create-before-link relationships can order otherwise independent items. Cycles, duplicate planned
identities, and incompatible delete/reference combinations are deferred rather than guessed through.

Immediately before decision and again before apply, Akno re-hashes relevant operations, evidence, link targets,
and documents. A changed item reports `snapshot_drift`, receives no curator call or write, and is replanned on a
later cycle. Unrelated work continues.

After independent items apply and verify, each affected phase gets at most one same-run replan. Persistent
dependencies wait for the next cycle; the workflow does not loop until the model eventually agrees.

## Whole-run budgets

```jsonc
{
  "maintenance": {
    "limits": {
      "max_items": 30,
      "max_files_changed": 40,
      "max_bytes_written": 500000,
      "max_high_risk_items": 3,
    },
  },
}
```

Observe, reflect, curate, and adopt share one budget in a full cycle. Planning is not truncated, so audit and
review still expose every proposal. Apply reserves a complete atomic item; an item that would cross a ceiling
writes nothing and returns to `proposed` with `budget_exhausted`. Unrelated smaller items may still fit.

## Reviewing plans

```bash
akno plan list --status awaiting_review
akno plan diff <plan-id>
akno plan decide <plan-id> --item <item-id> --approve
akno plan apply <plan-id>

# Retire queued work that a newer plan or a human decision made obsolete.
akno plan supersede <plan-id> --reason "Replaced by a newer review."

# Preview configured terminal-plan retention; mutation remains explicit here.
akno plan prune
akno plan prune --apply

akno dream status
akno dream status --last 10
akno dream status --run <run-id>
akno dream status --pending
akno dream status --explain-policy people/ada-marlow.md
```

General status and JSON receipts contain counts, typed outcomes, ids, policy, budget use, model-call counts,
latency, provider-reported token coverage, final run-verification checks, and aggregate semantic-merge work:
pages prepared, embedding cache hits and inputs, pairs compared, classifier cache hits and calls, and qualified
pairs. They omit page bodies, prompts, paths, excerpts, semantic candidates, model responses, and provider
errors. `plan diff` is the explicit private-content inspection surface.

`plan list --status` accepts one exact status or a comma-separated set, such as
`awaiting_review,approved`. Superseding keeps the sealed plan and its reason as audit history but removes it
from the active queue; it neither changes the knowledge base nor deletes a plan. Akno permits it only before
apply begins. Applying, verification, completed, partial, and failed states remain visible for recovery and
diagnosis.

Terminal plans use two-stage retention: exact private operations and evidence are removed after 30 days by
default, while compact decisions, hashes, and verification receipts remain for 180 days. The command previews
eligible plan, item, and exact private-byte counts before `--apply`. Full writable dream runs enforce the same
configured boundary automatically. Active decisions and apply/verification recovery are never candidates, and
plan pruning never changes the knowledge base or shortens change-journal undo retention.

Use `akno rules <path>` or `dream status --explain-policy <path>` to understand why a page is ineligible,
audit-only, waiting for a person, eligible for curator apply, or blocked.

## Safe rollout

1. Keep the default `audit` profile.
2. Run a full audit and inspect exact plan diffs.
3. Enable `review` for selected transformation classes.
4. Use `undo` on a deliberately approved test change.
5. Move low-risk classes such as hygiene or exact broken-link repair to `auto`.
6. Keep merges and contradiction changes in review until their behavior is familiar.
7. Install the nightly schedule only after `dream status` is understandable and healthy.

`maintenance.notifications: "actionable"` can report review backlog, failures, repeated degradation, budget
deferral, or missed schedules without putting memory content on the lock screen. See [Operations](operations.md).
