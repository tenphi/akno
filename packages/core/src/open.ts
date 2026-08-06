import fs from 'node:fs';
import path from 'node:path';
import { AknoError, OPS, type AknoOps, type OpName, type OpInput, type OpResult } from '@akno/protocol';
import { loadConfig, type LoadOptions } from './config/load.ts';
import type { AknoConfig } from './config/schema.ts';
import { acquireWriteLock, openStore, type WriteLock } from './store/db.ts';
import { ModelClient } from './models/client.ts';
import { Assembler } from './recall/assemble.ts';
import { Indexer, type IndexOptions, type IndexReport } from './index/indexer.ts';
import { Watcher, type WatcherEvents } from './watch/watcher.ts';
import { doctor, type DoctorReport } from './doctor.ts';
import { effectiveRule, matchRules } from './rules/compile.ts';
import { looksLikeLedger } from './reserved.ts';
import type { AknoContext } from './context.ts';
import { recall } from './ops/recall.ts';
import { read } from './ops/read.ts';
import { list } from './ops/list.ts';
import { timeline } from './ops/timeline.ts';
import { context as contextOp } from './ops/context.ts';

export interface OpenOptions extends LoadOptions {
  /** Take the write handle. False for a second process that only reads (§16). */
  writable?: boolean;
  /** Start the FSEvents watcher and the periodic sweep. Off for one-shot commands. */
  watch?: boolean;
  watchEvents?: WatcherEvents;
}

export interface Akno extends AknoOps {
  readonly config: AknoConfig;
  readonly writable: boolean;
  /** Set when another process holds the write handle. */
  readonly lockHeldBy: number | null;
  /** Reconcile the index against the knowledge base. */
  index(options?: IndexOptions): Promise<IndexReport>;
  doctor(options?: { probeModels?: boolean }): Promise<DoctorReport>;
  /** Explain which rule governs a path, and why (§5). */
  rules(slug: string): { effective: Record<string, unknown>; candidates: { glob: string; source: string }[] };
  /** Force a full reconcile — what a host calls on wake. */
  reconcile(): Promise<void>;
  /** Call any op by name, validating input against the registry. The door path. */
  call<N extends OpName>(op: N, input: OpInput<N>): Promise<OpResult<N>>;
  close(): Promise<void>;
}

/**
 * §16. **The library is the product.** One op registry, one schema per op, three
 * transports over it — so the doors cannot drift into different behaviour.
 *
 *   import { open } from '@akno/core';
 *   const mem = await open({ aknoPath: '~/Notes' });
 *   const { cards } = await mem.recall({ query: 'car insurance renewal' });
 *
 * Swapping `open()` for `connect()` from `@akno/client` is the only difference
 * between embedding and connecting to a running service, so the decision is
 * reversible and nothing above the call site knows which is in use.
 */
export async function open(options: OpenOptions = {}): Promise<Akno> {
  const config = loadConfig(options);
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });

  // Exactly one process may hold the write handle. A second one opens read-only
  // and says so, rather than racing two watchers over one directory.
  let lock: WriteLock | null = null;
  let writable = options.writable !== false;
  let lockHeldBy: number | null = null;
  if (writable) {
    lock = acquireWriteLock(config.lockPath);
    if (!lock.acquired) {
      writable = false;
      lockHeldBy = lock.heldByPid;
    }
  }

  const dimensions = config.models.embedding.dimensions ?? 1024;
  const store = openStore({ dbPath: config.dbPath, embeddingDimensions: dimensions, readOnly: !writable });

  const models = {
    embedding: new ModelClient(config.models.embedding),
    reranker: new ModelClient(config.models.reranker),
    chat: new ModelClient(config.models.chat),
    vision: new ModelClient(config.models.vision),
  };

  const indexer = new Indexer(config, store, { embedding: models.embedding, chat: models.chat });
  const ctx: AknoContext = {
    config,
    store,
    models,
    assembler: new Assembler(config, store),
    writable,
    lockHeldBy,
  };

  if (writable && config.createReservedPaths) ensureReservedPaths(config);

  let watcher: Watcher | null = null;
  if (options.watch && writable && config.watch.enabled) {
    watcher = new Watcher(config, indexer, options.watchEvents ?? {});
    watcher.start();
  }

  const implementations: {
    [N in OpName]?: (ctx: AknoContext, input: unknown) => Promise<OpResult<N>>;
  } = {
    recall,
    read,
    list,
    timeline,
    context: contextOp,
  };

  async function call<N extends OpName>(op: N, input: OpInput<N>): Promise<OpResult<N>> {
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
      throw new AknoError('read_only', `${op} needs the write handle, which pid ${lockHeldBy} is holding`);
    }

    const implementation = implementations[op];
    if (!implementation || !definition.implemented) {
      throw new AknoError(
        'not_implemented',
        `${op} is not implemented in this build. Its schema is final; the body lands with the write path.`,
      );
    }

    return implementation(ctx, parsed.data);
  }

  const akno: Akno = {
    config,
    writable,
    lockHeldBy,

    recall: (input) => call('recall', input),
    read: (input) => call('read', input),
    list: (input) => call('list', input),
    timeline: (input) => call('timeline', input),
    context: (input) => call('context', input),
    write: (input) => call('write', input),
    remember: (input) => call('remember', input),
    forget: (input) => call('forget', input),
    undo: (input) => call('undo', input),
    move: (input) => call('move', input),
    ingest: (input) => call('ingest', input),

    call,

    async index(indexOptions: IndexOptions = {}): Promise<IndexReport> {
      if (!writable) {
        throw new AknoError('read_only', `pid ${lockHeldBy} holds the write handle; cannot index`);
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

    async reconcile(): Promise<void> {
      if (watcher) await watcher.reconcileNow();
      else await indexer.run({ verify: true });
    },

    async close(): Promise<void> {
      await watcher?.stop();
      store.close();
      lock?.release();
    },
  };

  return akno;
}

/**
 * §4. On startup Akno creates `timeline.md` (with a header and the current
 * year) and `inbox/` (with a short README) **if they are missing** — and only
 * when the user has opted in. Nothing else is created ahead of need.
 *
 * If a reserved path already exists and isn't what Akno expects, it is left
 * completely alone; `doctor` reports it and points at the config key.
 */
function ensureReservedPaths(config: AknoConfig): void {
  const timelineAbs = path.join(config.aknoPath, config.paths.timeline);

  // §4 is emphatic here: if a reserved path already exists and isn't what Akno
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
