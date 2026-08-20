import type { DegradedReason } from '@tenphi/akno-protocol';
import type { AknoConfig } from './config/schema.ts';
import type { Store } from './store/db.ts';
import type { ModelClient } from './models/client.ts';
import type { Assembler } from './recall/assemble.ts';
import type { Indexer } from './index/indexer.ts';
import type { DeferredDerive } from './index/defer.ts';
import type { Journal } from './write/journal.ts';
import type { Gate } from './write/gate.ts';

/** Everything an op needs, assembled once per process by `open()`. */
export interface AknoContext {
  config: AknoConfig;
  store: Store;
  models: {
    embedding: ModelClient;
    reranker: ModelClient;
    /** Quality work off the hot path: facts, summaries, naming, remember, the cycle. */
    derive: ModelClient;
    /** The recall path only, where latency is felt on every question. */
    expansion: ModelClient;
    vision: ModelClient;
  };
  assembler: Assembler;
  /** The write path needs it to reconcile immediately after its own write. */
  indexer: Indexer;
  /**
   * Model-backed indexing of pages a write just changed, run after the answer goes out.
   *
   * A write is done when the Markdown is on disk; deriving facts from it is a reading of a file
   * that is already correct. Awaiting that put a cold local deriver — a minute to load — inside
   * every `remember`, past the timeout of the tool calling it.
   */
  derive: DeferredDerive;
  journal: Journal;
  gate: Gate;
  /**
   * **The user is never gated; only agents are.** Which one is asking is a
   * property of the caller, not of the op — so it lives here rather than in every
   * write's input, where a caller could simply claim to be the user.
   */
  actor: 'user' | 'agent' | 'akno';
  /** False when another process holds the write handle. */
  writable: boolean;
  lockHeldBy: number | null;
  /**
   * Why this handle cannot write, when it cannot. `requested` is a caller asking for a
   * read-only handle — `doctor` does, so that inspecting a knowledge base never takes the
   * write lock away from a running service. It is not a problem, and reporting it as one
   * ("another process holds the write handle") named a process that was never there.
   */
  readOnlyReason: 'requested' | 'held' | 'unwritable' | null;
}

/**
 * A partially embedded index gives real but weaker recall, and saying so is the
 * difference between "not recorded" and "I could not check properly".
 */
export function indexDegradation(store: Store): DegradedReason[] {
  const out: DegradedReason[] = [];
  const row = store.db.prepare('SELECT count(*) AS total, sum(embedded) AS embedded FROM chunks').get() as {
    total: number;
    embedded: number | null;
  };
  if (row.total > 0 && (row.embedded ?? 0) < row.total) out.push('partial_index');
  if (store.vectors.count() === 0 && row.total > 0) out.push('no_vector_index');
  return out;
}
