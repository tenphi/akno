import type { DegradedReason } from '@akno/protocol';
import type { AknoConfig } from './config/schema.js';
import type { Store } from './store/db.js';
import type { ModelClient } from './models/client.js';
import type { Assembler } from './recall/assemble.js';
import type { Indexer } from './index/indexer.js';

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
  indexer: Indexer;
  /** False when another process holds the write handle (§16). */
  writable: boolean;
  lockHeldBy: number | null;
}

/**
 * §9. Absence has a reason. Mapping a model's own error string to a named reason
 * happens here, once, so every op reports degradation in the same vocabulary
 * rather than each inventing its own.
 */
export function classifyDegradation(reasons: string[]): DegradedReason[] {
  const out = new Set<DegradedReason>();
  for (const reason of reasons) {
    const lower = reason.toLowerCase();
    if (lower.includes('embedding')) {
      out.add(lower.includes('no model id') || lower.includes('disabled') ? 'no_embedding_model' : 'embedding_failed');
    } else if (lower.includes('rerank')) {
      out.add(lower.includes('no model id') || lower.includes('disabled') ? 'no_reranker' : 'rerank_failed');
    } else if (lower.includes('chat') || lower.includes('expansion')) {
      out.add(lower.includes('no model id') || lower.includes('disabled') ? 'no_chat_model' : 'expansion_failed');
    }
  }
  return [...out];
}

/**
 * A partially embedded index gives real but weaker recall, and saying so is the
 * difference between "not recorded" and "I could not check properly".
 */
export function indexDegradation(store: Store): DegradedReason[] {
  const out: DegradedReason[] = [];
  const row = store.db
    .prepare('SELECT count(*) AS total, sum(embedded) AS embedded FROM chunks')
    .get() as { total: number; embedded: number | null };
  if (row.total > 0 && (row.embedded ?? 0) < row.total) out.push('partial_index');
  if (store.vectors.count() === 0 && row.total > 0) out.push('no_vector_index');
  return out;
}
