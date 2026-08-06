import type { DegradedReason } from '@akno/protocol';
import type { AknoConfig } from './config/schema.ts';
import type { Store } from './store/db.ts';
import type { ModelClient } from './models/client.ts';
import type { Assembler } from './recall/assemble.ts';

/** Everything an op needs, assembled once per process by `open()`. */
export interface AknoContext {
  config: AknoConfig;
  store: Store;
  models: {
    embedding: ModelClient;
    reranker: ModelClient;
    chat: ModelClient;
    vision: ModelClient;
  };
  assembler: Assembler;
  /** False when another process holds the write handle (§16). */
  writable: boolean;
  lockHeldBy: number | null;
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
