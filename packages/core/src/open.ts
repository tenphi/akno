import fs from 'node:fs';
import path from 'node:path';
import {
  AknoError,
  OPS,
  type AknoOps,
  type OpName,
  type OpInput,
  type OpResult,
} from '@tenphi/akno-protocol';
import { loadConfig, type LoadOptions } from './config/load.ts';
import type { AknoConfig } from './config/schema.ts';
import { acquireWriteLock, openStore, type WriteLock } from './store/db.ts';
import { DeferredDerive } from './index/defer.ts';
import { ModelClient } from './models/client.ts';
import { resolveAutoProviderApis } from './models/provider-api.ts';
import { Assembler } from './recall/assemble.ts';
import { Indexer, type IndexOptions, type IndexReport } from './index/indexer.ts';
import { Watcher, type WatcherEvents } from './watch/watcher.ts';
import { doctor, type DoctorOptions, type DoctorReport } from './doctor.ts';
import { effectiveRule, matchRules } from './rules/compile.ts';
import { looksLikeLedger } from './reserved.ts';
import type { AknoContext } from './context.ts';
import { Journal, type ChangeSummary } from './write/journal.ts';
import { Gate, type ProposalRow } from './write/gate.ts';
import { recall } from './ops/recall.ts';
import { answer as answerOp } from './ops/answer.ts';
import { read } from './ops/read.ts';
import { list } from './ops/list.ts';
import { timeline } from './ops/timeline.ts';
import { context as contextOp } from './ops/context.ts';
import { graph as graphOp } from './ops/graph.ts';
import { write as writeOp } from './ops/write.ts';
import { folder as folderOp } from './ops/folder.ts';
import { remember as rememberOp } from './ops/remember.ts';
import { forget as forgetOp } from './ops/forget.ts';
import { undo as undoOp } from './ops/undo.ts';
import { move as moveOp } from './ops/move.ts';
import { ingest as ingestOp } from './ops/ingest.ts';
import { adopt as adoptOp } from './ops/adopt.ts';
import { isInInbox, processInbox, type InboxResult } from './ingest/inbox.ts';
import { dream, type DreamOptions, type DreamReport } from './maintenance/dream.ts';
import {
  applyMaintenancePlan,
  decideMaintenanceItem,
  getMaintenancePlan,
  listMaintenancePlans,
  maintenanceStatus,
  pruneMaintenancePlans,
  renderStoredMaintenanceDiff,
  reviseMaintenanceItem,
  supersedeMaintenancePlan,
  type ApplyMaintenanceResult,
  type MaintenanceActionOptions,
  type MaintenancePlan,
  type MaintenancePlanStatus,
  type MaintenancePlanSummary,
  type MaintenancePlanPruneResult,
  type MaintenanceRevisionInput,
  type MaintenanceMode,
  type MaintenanceStatus,
  type MaintenanceStatusQuery,
} from './maintenance/plans.ts';
import { recoverInterruptedDreamRuns } from './maintenance/runs.ts';
import { explainMaintenancePath, type MaintenancePathPolicy } from './maintenance/path-policy.ts';
import {
  resumeMaintenanceRecovery,
  type MaintenanceRecoveryScope,
  type MaintenanceRecoveryStatus,
} from './maintenance/recovery.ts';

/** Host-facing watch callbacks, including the inbox result the watcher triggers. */
export interface AknoWatchEvents extends WatcherEvents {
  onInbox?: (result: InboxResult) => void;
}

export interface OpenOptions extends LoadOptions {
  /**
   * Who is asking. `user` is never gated — a person who makes a folder has
   * made it. Defaults to `agent`, because the safe assumption about an unlabelled
   * caller is that it is one.
   */
  actor?: 'user' | 'agent' | 'akno';
  /** Take the write handle. False for a second process that only reads. */
  writable?: boolean;
  /**
   * How long to wait for the write handle if another process still holds it.
   *
   * For a long-running service, whose start is usually a restart: the supervisor launches the
   * replacement while the outgoing process is still closing, and checking once at that instant is
   * how a daemon comes up read-only and stays that way for its whole life. One-shot commands leave
   * it at zero — they should say so immediately rather than hang.
   */
  writeLockWaitMs?: number;
  /** Start the FSEvents watcher and the periodic sweep. Off for one-shot commands. */
  watch?: boolean;
  watchEvents?: AknoWatchEvents;
  /**
   * Resolve uncached `providers.*.api: auto` settings with invented network probes.
   * Defaults to true; diagnostics use false for their explicit `--no-probe` path.
   */
  resolveProviderApis?: boolean;
  /** Ignore a cached `api: auto` answer and run the invented probes again. */
  refreshProviderApis?: boolean;
}

export interface Akno extends AknoOps {
  readonly config: AknoConfig;
  readonly writable: boolean;
  /** Set when another process holds the write handle. */
  readonly lockHeldBy: number | null;
  /** Reconcile the index against the knowledge base. */
  index(options?: IndexOptions): Promise<IndexReport>;
  doctor(options?: DoctorOptions): Promise<DoctorReport>;
  /** Explain which rule governs a path, and why. */
  rules(slug: string): { effective: Record<string, unknown>; candidates: { glob: string; source: string }[] };
  /** Explain the layered scheduled-maintenance authority for one page path. */
  maintenancePolicy(slug: string, mode?: MaintenanceMode): MaintenancePathPolicy;
  /** Recent changes, newest first. What `undo` takes an id from. */
  changes(limit?: number): ChangeSummary[];
  /** Gated proposals waiting on the user. */
  proposals(): ProposalRow[];
  /** Durable maintenance plans, newest first. */
  plans(limit?: number, statuses?: readonly MaintenancePlanStatus[]): MaintenancePlanSummary[];
  /** One sealed plan, including its exact operations and decisions. */
  plan(planId: string): MaintenancePlan;
  /** A compact unified diff for one item or the whole plan. */
  maintenanceDiff(planId: string, itemId?: string, revision?: number): string;
  /** Seal a corrected after-state as a new item revision; the previous proposal stays inspectable. */
  revisePlan(planId: string, itemId: string, input: MaintenanceRevisionInput): Promise<MaintenancePlan>;
  /** Record a human decision without applying it. */
  decidePlan(
    planId: string,
    itemId: string,
    outcome: 'approve' | 'reject',
    reason?: string,
    options?: MaintenanceActionOptions,
  ): MaintenancePlan;
  /** Apply approved items with stale-input checks, journaling and verification. */
  applyPlan(planId: string, options?: MaintenanceActionOptions): Promise<ApplyMaintenanceResult>;
  /** Retire a not-yet-applied plan while preserving its sealed audit history. */
  supersedePlan(planId: string, reason?: string): MaintenancePlan;
  /** Preview or apply configured two-stage retention to terminal maintenance plans. */
  prunePlans(options?: { apply?: boolean }): MaintenancePlanPruneResult;
  /** A small operational view of the maintenance queue. */
  maintenanceStatus(query?: MaintenanceStatusQuery): MaintenanceStatus;
  /** Explicitly clear one durable automatic-maintenance safety pause after inspection. */
  resumeMaintenance(scope: MaintenanceRecoveryScope): MaintenanceRecoveryStatus;
  /**
   * The user resolves a gate. Approving **completes the write**, because the
   * pending content was held with the proposal — a caller should not have to
   * remember and repeat what it already sent.
   */
  /**
   * Answer a gated proposal, replaying the held write as the user.
   *
   * `slug` is the destination, and a `route` proposal has none of its own — it exists precisely
   * because nothing scored high enough to pick one, so approving it without saying where is not a
   * decision anybody can act on.
   */
  approve(
    proposalId: string,
    options?: { slug?: string },
  ): Promise<{ subject: string; write?: OpResult<'write'>; ingest?: OpResult<'ingest'> }>;
  /** A declined proposal is remembered, so the agent stops re-asking. */
  decline(proposalId: string): Promise<{ subject: string }>;
  /**
   * Process whatever is sitting in an inbox folder: extract, name, route, and move
   * what finds a home. Safe to call repeatedly — a file that could not be routed stays
   * put and is reconsidered next time, which is what makes an inbox a to-do list rather
   * than a queue that loses things.
   */
  inbox(options?: { limit?: number }): Promise<InboxResult>;
  /**
   * The maintenance cycle: conflict-first inspection, inference, plan-backed curation,
   * adoption, plan-backed broken-link fixing, and housekeeping. Phases are safe to re-run; selecting an
   * inference or curation phase still performs its conflict prerequisite.
   *
   * Needs the write handle, because `observe` writes pages — and one process at a time, for
   * the same reason indexing does.
   */
  dream(options?: DreamOptions): Promise<DreamReport>;
  /** Force a full reconcile — what a host calls on wake. */
  reconcile(): Promise<void>;
  /** Call any op by name, validating input against the registry. The door path. */
  /**
   * Dispatch by name. `actor` overrides who the call speaks for, which the gate reads and the
   * journal records; omitted, it is the actor this handle was opened with.
   */
  call<N extends OpName>(
    op: N,
    input: OpInput<N>,
    options?: { actor?: 'user' | 'agent' | 'akno' },
  ): Promise<OpResult<N>>;
  close(): Promise<void>;
}

/**
 * One sentence for each way a handle can be read-only. Kept in one place because the same
 * explanation belongs in a thrown error, in `doctor`, and in the CLI, and three copies
 * would drift into three different claims about what is happening.
 */
export function readOnlyExplanation(
  reason: 'requested' | 'held' | 'unwritable' | null,
  heldByPid: number | null,
): string {
  switch (reason) {
    case 'held':
      return `pid ${heldByPid} holds it. Do not run two Aknos against one knowledge base.`;
    case 'unwritable':
      return 'the lock file could not be written — check the permissions on the state directory.';
    case 'requested':
      return 'this handle was opened read-only.';
    default:
      return 'this handle cannot write.';
  }
}

/**
 * **The library is the product.** One op registry, one schema per op, three
 * transports over it — so the doors cannot drift into different behaviour.
 *
 *   import { open } from '@tenphi/akno-core';
 *   const mem = await open({ aknoPath: '~/Notes' });
 *   const { cards } = await mem.recall({ query: 'car insurance renewal' });
 *
 * Swapping `open()` for `connect()` from `@tenphi/akno-client` is the only difference
 * between embedding and connecting to a running service, so the decision is
 * reversible and nothing above the call site knows which is in use.
 */
export async function open(options: OpenOptions = {}): Promise<Akno> {
  const config = loadConfig(options);
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });
  if (options.resolveProviderApis !== false) {
    await resolveAutoProviderApis(config, { refresh: options.refreshProviderApis });
  }

  // Exactly one process may hold the write handle. A second one opens read-only
  // and says so, rather than racing two watchers over one directory.
  let lock: WriteLock | null = null;
  let writable = options.writable !== false;
  let lockHeldBy: number | null = null;
  let readOnlyReason: AknoContext['readOnlyReason'] = writable ? null : 'requested';
  if (writable) {
    lock = acquireWriteLock(config.lockPath, options.writeLockWaitMs ?? 0);
    if (!lock.acquired) {
      writable = false;
      lockHeldBy = lock.heldByPid;
      readOnlyReason = lock.failure ?? 'held';
    }
  }

  const dimensions = config.models.embedding.dimensions ?? 1024;
  const store = openStore({ dbPath: config.dbPath, embeddingDimensions: dimensions, readOnly: !writable });

  const models = {
    embedding: new ModelClient(config.models.embedding),
    reranker: new ModelClient(config.models.reranker),
    derive: new ModelClient(config.models.derive),
    expansion: new ModelClient(config.models.expansion),
    answer: new ModelClient(config.models.answer),
    vision: new ModelClient(config.models.vision),
  };

  const indexer = new Indexer(config, store, { embedding: models.embedding, derive: models.derive });
  const deferredDerive = new DeferredDerive(indexer, (err) => {
    // After the caller has gone, so there is nobody to throw at. A lost derivation costs a summary
    // and some facts until the next pass over the page; it never costs the write.
    options.watchEvents?.onError?.(err instanceof Error ? err : new Error(String(err)));
  });
  const ctx: AknoContext = {
    config,
    store,
    models,
    derive: deferredDerive,
    assembler: new Assembler(config, store),
    indexer,
    journal: new Journal(store, config.aknoPath, config.trashDir),
    gate: new Gate(store, config),
    actor: options.actor ?? 'agent',
    writable,
    lockHeldBy,
    readOnlyReason,
  };

  // The write handle proves that no predecessor is still applying. Finalize its unfinished
  // lifecycle rows before status or scheduling can mistake a crashed run for a live one.
  recoverInterruptedDreamRuns(ctx);

  if (writable && config.createReservedPaths) ensureReservedPaths(config);

  let watcher: Watcher | null = null;
  if (options.watch && writable && config.watch.enabled) {
    watcher = new Watcher(config, indexer, {
      ...(options.watchEvents ?? {}),
      // Dropping a file in the inbox is the whole interface. Indexing it where it
      // landed would leave it sitting there forever, which is the one thing an inbox
      // must not do.
      onArrival: async (changed) => {
        const arrivals = changed.filter((relPath) => isInInbox(ctx, relPath));
        if (arrivals.length === 0) return;
        const result = await processInbox(ctx, { only: arrivals });
        options.watchEvents?.onInbox?.(result);
      },
    });
    watcher.start();
  }

  const implementations: {
    [N in OpName]?: (ctx: AknoContext, input: unknown) => Promise<OpResult<N>>;
  } = {
    recall,
    answer: answerOp,
    read,
    list,
    timeline,
    context: contextOp,
    graph: graphOp,
    write: writeOp,
    folder: folderOp,
    remember: rememberOp,
    forget: forgetOp,
    undo: undoOp,
    move: moveOp,
    ingest: ingestOp,
    adopt: adoptOp,
  };

  async function call<N extends OpName>(
    op: N,
    input: OpInput<N>,
    callOptions: { actor?: 'user' | 'agent' | 'akno' } = {},
  ): Promise<OpResult<N>> {
    const definition = OPS[op];
    if (!definition) throw new AknoError('invalid', `unknown op: ${String(op)}`);

    // Every door validates against the same schema, so a bad call fails the same
    // way whether it came in-process, over a socket, or from MCP.
    const parsed = definition.input.safeParse(input);
    if (!parsed.success) {
      throw new AknoError('invalid', `invalid input for ${op}`, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (definition.kind === 'write' && !writable) {
      throw new AknoError(
        'read_only',
        `${op} needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
      );
    }

    const implementation = implementations[op];
    if (!implementation || !definition.implemented) {
      throw new AknoError(
        'not_implemented',
        `${op} is not implemented in this build. Its schema is final; the body lands with the write path.`,
      );
    }

    // One call, one actor. The gate reads it, and the journal records it for undo attribution, so
    // shadowing the context here is the whole mechanism — the same one `approve` uses to replay a
    // proposal as the person who answered it.
    const forCall =
      callOptions.actor && callOptions.actor !== ctx.actor ? { ...ctx, actor: callOptions.actor } : ctx;
    return implementation(forCall, parsed.data);
  }

  const akno: Akno = {
    config,
    writable,
    lockHeldBy,

    recall: (input) => call('recall', input),
    answer: (input) => call('answer', input),
    read: (input) => call('read', input),
    list: (input) => call('list', input),
    timeline: (input) => call('timeline', input),
    context: (input) => call('context', input),
    graph: (input) => call('graph', input),
    write: (input) => call('write', input),
    folder: (input) => call('folder', input),
    remember: (input) => call('remember', input),
    forget: (input) => call('forget', input),
    undo: (input) => call('undo', input),
    move: (input) => call('move', input),
    ingest: (input) => call('ingest', input),
    adopt: (input) => call('adopt', input),

    call,

    async index(indexOptions: IndexOptions = {}): Promise<IndexReport> {
      if (!writable) {
        throw new AknoError('read_only', `cannot index — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`);
      }
      return indexer.run(indexOptions);
    },

    doctor: (doctorOptions) => doctor(ctx, doctorOptions ?? {}),

    rules(slug: string) {
      const match = matchRules(slug, config.rules);
      return {
        effective: effectiveRule(slug, config.rules) as Record<string, unknown>,
        candidates: match.candidates.map((rule) => ({ glob: rule.glob, source: rule.source })),
      };
    },

    maintenancePolicy: (slug, mode) => explainMaintenancePath(ctx, slug, mode),

    changes: (limit) => ctx.journal.list(limit),

    proposals: () => ctx.gate.pending(),

    plans: (limit, statuses) => listMaintenancePlans(ctx, limit, statuses),

    plan: (planId) => getMaintenancePlan(ctx, planId),

    maintenanceDiff: (planId, itemId, revision) => renderStoredMaintenanceDiff(ctx, planId, itemId, revision),

    async revisePlan(planId, itemId, input) {
      if (!writable) {
        throw new AknoError(
          'read_only',
          `revising a maintenance plan needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return reviseMaintenanceItem(ctx, planId, itemId, input);
    },

    decidePlan(planId, itemId, outcome, reason = '', actionOptions = {}) {
      if (!writable) {
        throw new AknoError(
          'read_only',
          `deciding a maintenance plan needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return decideMaintenanceItem(ctx, planId, itemId, outcome, 'human', reason, actionOptions);
    },

    async applyPlan(planId, actionOptions = {}) {
      if (!writable) {
        throw new AknoError(
          'read_only',
          `applying a maintenance plan needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return applyMaintenancePlan(ctx, planId, undefined, actionOptions);
    },

    supersedePlan(planId, reason) {
      if (!writable) {
        throw new AknoError(
          'read_only',
          `superseding a maintenance plan needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return supersedeMaintenancePlan(ctx, planId, reason);
    },

    prunePlans(retentionOptions = {}) {
      if (retentionOptions.apply && !writable) {
        throw new AknoError(
          'read_only',
          `pruning maintenance plans needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return pruneMaintenancePlans(ctx, retentionOptions);
    },

    maintenanceStatus: (query) => maintenanceStatus(ctx, query),

    resumeMaintenance(scope) {
      if (!writable) {
        throw new AknoError(
          'read_only',
          `resuming automatic maintenance needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return resumeMaintenanceRecovery(ctx, scope);
    },

    async approve(
      proposalId: string,
      answer: { slug?: string } = {},
    ): Promise<{ subject: string; write?: OpResult<'write'>; ingest?: OpResult<'ingest'> }> {
      const proposal = ctx.gate.get(proposalId);
      if (!proposal) throw new AknoError('not_found', `no proposal with id ${proposalId}`);
      if (proposal.status !== 'pending') {
        throw new AknoError('invalid', `${proposalId} was already ${proposal.status}`);
      }

      // Replayed as the *user*, which is what makes approval work: the gate that
      // stopped the agent does not apply to the person answering it.
      const asUser: AknoContext = { ...ctx, actor: 'user' };

      // An ingest proposal holds the source, not a page write. Treat the answer as its folder and
      // run ingest again with that explicit destination. Replaying every proposal through `write`
      // stripped the source path and made file-placement proposals impossible to resolve.
      if (proposal.kind === 'ingest') {
        const folder = answer.slug?.trim();
        if (!folder) {
          const nearest = JSON.parse(proposal.nearest) as string[];
          const candidates = nearest.length > 0 ? ` Nearest: ${nearest.join(', ')}.` : '';
          throw new AknoError(
            'invalid',
            `${proposalId} has no destination — approve it with a folder.${candidates}`,
          );
        }
        const held = JSON.parse(proposal.payload) as OpInput<'ingest'>;
        const result = await ingestOp(asUser, { ...held, folder });
        if (result.outcome === 'ok' || result.outcome === 'duplicate') {
          ctx.gate.resolve(proposalId, 'approved', result.change_id);
        }
        return { subject: proposal.subject, ingest: result };
      }

      const held = JSON.parse(proposal.payload) as OpInput<'write'>;
      const payload: OpInput<'write'> = answer.slug ? { ...held, slug: answer.slug } : held;

      // A `route` proposal holds a claim and no destination — that *is* the question it asks. Left
      // unanswered the replay fails deep inside `write` with "requires a slug", which reads as a bug
      // in the approval rather than a missing answer, so it is refused here with the fix in the
      // message. The nearest pages travel on the proposal for exactly this choice.
      if (!payload.slug && !payload.propose_slug && !payload.event) {
        const nearest = JSON.parse(proposal.nearest) as string[];
        const candidates = nearest.length > 0 ? ` Nearest: ${nearest.join(', ')}.` : '';
        throw new AknoError(
          'invalid',
          `${proposalId} has no destination — approve it with a page to write to.${candidates}`,
        );
      }

      const result = await writeOp(
        asUser,
        proposal.kind === 'conflict' ? { ...payload, resolve_conflict: true } : payload,
      );
      ctx.gate.resolve(proposalId, 'approved', result.change_id);
      return { subject: proposal.subject, write: result };
    },

    async decline(proposalId: string): Promise<{ subject: string }> {
      const proposal = ctx.gate.get(proposalId);
      if (!proposal) throw new AknoError('not_found', `no proposal with id ${proposalId}`);
      ctx.gate.resolve(proposalId, 'declined');
      return { subject: proposal.subject };
    },

    inbox: (inboxOptions) => processInbox(ctx, inboxOptions ?? {}),

    async dream(dreamOptions: DreamOptions = {}): Promise<DreamReport> {
      // A dry run reads and reports; only a real one needs the handle. Refusing both would
      // make "what would the cycle write?" unanswerable from a second process.
      if (!writable && !dreamOptions.dryRun) {
        throw new AknoError(
          'read_only',
          `dream needs the write handle — ${readOnlyExplanation(readOnlyReason, lockHeldBy)}`,
        );
      }
      return dream(ctx, dreamOptions);
    },

    async reconcile(): Promise<void> {
      if (watcher) await watcher.reconcileNow();
      else await indexer.run({ verify: true });
    },

    async close(): Promise<void> {
      // A one-shot command would otherwise exit with its own write still underived.
      await deferredDerive.flush();
      await watcher?.stop();
      store.close();
      lock?.release();
    },
  };

  return akno;
}

/**
 * On startup Akno creates `timeline.md` (with a header and the current
 * year) and `inbox/` (with a short README) **if they are missing** — and only
 * when the user has opted in. Nothing else is created ahead of need.
 *
 * If a reserved path already exists and isn't what Akno expects, it is left
 * completely alone; `doctor` reports it and points at the config key.
 */
function ensureReservedPaths(config: AknoConfig): void {
  const timelineAbs = path.join(config.aknoPath, config.paths.timeline);

  // The rule here is absolute: if a reserved path already exists and isn't what Akno
  // expects — a `timeline.md` that is somebody's project plan — Akno warns,
  // points at the config key, and **refuses to start** rather than adopting a file
  // the user meant something else by. Silently treating it as a ledger would start
  // appending event lines into the middle of their document.
  if (fs.existsSync(timelineAbs) && !looksLikeLedger(timelineAbs)) {
    throw new AknoError(
      'invalid',
      `${config.paths.timeline} already exists and does not look like an event ledger — it has no ` +
        '`- **YYYY-MM-DD** | …` lines. Akno will not adopt a file you meant something else by. ' +
        'Point it elsewhere with `paths.timeline`, or set `create_reserved_paths: false`.',
    );
  }

  if (!fs.existsSync(timelineAbs)) {
    const year = new Date().getFullYear();
    fs.mkdirSync(path.dirname(timelineAbs), { recursive: true });
    fs.writeFileSync(
      timelineAbs,
      `---\ntype: timeline\ntitle: Timeline\n---\n\n# Timeline\n\n` +
        `What actually happened, newest first. One line per event; the detail lives on the linked\n` +
        `page, so this stays an index and never a second copy of a fact.\n\n` +
        `Append-only: never edit or remove a line, correct it with a new one. Each line reads\n` +
        `\`- **YYYY-MM-DD** | what happened. [[page/with/detail]]\` — that exact shape is what\n` +
        `makes a line an event, and prose Akno cannot match is invisible to search.\n\n` +
        `## ${year}\n`,
      'utf8',
    );
  }

  const inboxAbs = path.join(config.aknoPath, config.paths.inbox);
  if (fs.existsSync(inboxAbs) && !fs.statSync(inboxAbs).isDirectory()) {
    throw new AknoError(
      'invalid',
      `${config.paths.inbox} exists and is not a directory. Remap it with \`paths.inbox\`.`,
    );
  }
  if (!fs.existsSync(inboxAbs)) {
    fs.mkdirSync(inboxAbs, { recursive: true });
    fs.writeFileSync(
      path.join(inboxAbs, 'README.md'),
      `---\ntitle: Inbox\n---\n\n# Inbox\n\n` +
        `Drop anything here and it files itself: Akno extracts the text, OCRs it if there is no\n` +
        `text layer, gives it a name from its contents, summarizes it, and moves it to where it\n` +
        `belongs.\n\n` +
        `If it cannot work out where that is, the file **stays here** with a proposal attached —\n` +
        `deliberately. An inbox with three things in it is a to-do list. A misfiled document is a\n` +
        `lost one.\n`,
      'utf8',
    );
  }
}
