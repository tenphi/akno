import path from 'node:path';
import { AknoError } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import { normalizeSlug } from '../ops/write.ts';

const REPLAY_SAFE_OPERATIONS = ['write', 'move', 'forget', 'folder'] as const;
export type ReplaySafeOperation = (typeof REPLAY_SAFE_OPERATIONS)[number];

export interface ActiveMutationReceipt {
  actor: AknoContext['actor'];
  operation: ReplaySafeOperation;
  idempotencyKey: string;
  requestHash: string;
  started: boolean;
}

interface MutationReceiptRow {
  actor: AknoContext['actor'];
  operation: ReplaySafeOperation;
  idempotency_key: string;
  request_hash: string;
  state: 'reserved' | 'running' | 'committed' | 'completed' | 'interrupted';
  change_id: string | null;
  result: string | null;
  started_at: string;
  completed_at: string | null;
}

type MutationInput = Record<string, unknown> & { idempotency_key?: string };
type MutationResult = Record<string, unknown> & { outcome?: unknown };

// A process can open the same knowledge base twice because its pid already owns the write lock.
// Key by database path as well as receipt identity so those handles still agree which call is live.
const activeReceipts = new Set<string>();
const MAX_RESULT_BYTES = 64 * 1024;

export function isReplaySafeOperation(operation: string): operation is ReplaySafeOperation {
  return (REPLAY_SAFE_OPERATIONS as readonly string[]).includes(operation);
}

/**
 * Bind a caller-owned key before the first effect and return a completed request without
 * reapplying it. Incomplete rows fail closed: only a process that knows it never crossed the
 * mutation boundary may discard its reservation and let the caller try again.
 */
export async function executeReplaySafeMutation<T extends MutationResult>(
  ctx: AknoContext,
  operation: ReplaySafeOperation,
  parsedInput: MutationInput,
  work: (ctx: AknoContext, input: MutationInput) => Promise<T>,
): Promise<T> {
  const { idempotency_key: key, ...operationInput } = parsedInput;
  if (!key) return work(ctx, operationInput);

  const requestHash = mutationRequestHash(operation, operationInput);
  const identity = receiptIdentity(ctx.config.dbPath, ctx.actor, operation, key);
  const existing = readReceipt(ctx.store, ctx.actor, operation, key);
  if (existing) {
    assertSameRequest(existing, requestHash);
    if (existing.state === 'completed') {
      return replayResult(ctx, operation, operationInput, existing) as T;
    }
    if (activeReceipts.has(identity)) {
      throw new AknoError('busy', `${operation} with this idempotency key is still running`, {
        operation,
        idempotency_key: key,
        state: existing.state,
      });
    }
    throw interruptedError(existing);
  }

  const now = new Date().toISOString();
  ctx.store.db
    .prepare(
      `INSERT INTO mutation_receipts(
         actor, operation, idempotency_key, request_hash, state, started_at
       ) VALUES(?, ?, ?, ?, 'reserved', ?)`,
    )
    .run(ctx.actor, operation, key, requestHash, now);

  const receipt: ActiveMutationReceipt = {
    actor: ctx.actor,
    operation,
    idempotencyKey: key,
    requestHash,
    started: false,
  };
  activeReceipts.add(identity);

  try {
    const result = await work({ ...ctx, mutationReceipt: receipt }, operationInput);
    if (!receipt.started && isRetryablePrecondition(result)) {
      deleteReceipt(ctx.store, receipt);
      return result;
    }
    if (receipt.started) assertJournalCommit(ctx.store, receipt, result);

    const stored = compactResult(operation, result);
    const updated = ctx.store.db
      .prepare(
        `UPDATE mutation_receipts
            SET state = 'completed', result = ?, completed_at = ?
          WHERE actor = ? AND operation = ? AND idempotency_key = ? AND request_hash = ?
            AND state IN ('reserved', 'running', 'committed')`,
      )
      .run(stored, new Date().toISOString(), ctx.actor, operation, key, requestHash);
    if (updated.changes !== 1) {
      throw new AknoError('internal', `could not complete the ${operation} mutation receipt`);
    }
    return result;
  } catch (error) {
    if (receipt.started) {
      ctx.store.db
        .prepare(
          `UPDATE mutation_receipts
              SET state = 'interrupted', result = NULL, completed_at = NULL
            WHERE actor = ? AND operation = ? AND idempotency_key = ? AND request_hash = ?
              AND state IN ('running', 'committed')`,
        )
        .run(ctx.actor, operation, key, requestHash);
    } else {
      deleteReceipt(ctx.store, receipt);
    }
    throw error;
  } finally {
    activeReceipts.delete(identity);
  }
}

/** Mark the durable boundary immediately before the first filesystem effect. */
export function beginMutation(ctx: AknoContext): void {
  const receipt = ctx.mutationReceipt;
  if (!receipt || receipt.started) return;
  const updated = ctx.store.db
    .prepare(
      `UPDATE mutation_receipts SET state = 'running'
        WHERE actor = ? AND operation = ? AND idempotency_key = ? AND request_hash = ?
          AND state = 'reserved'`,
    )
    .run(receipt.actor, receipt.operation, receipt.idempotencyKey, receipt.requestHash);
  if (updated.changes !== 1) {
    throw new AknoError('internal', `could not start the ${receipt.operation} mutation receipt`);
  }
  receipt.started = true;
}

/**
 * A new writer proves the old process is gone. Reservations never reached the mutation boundary;
 * every later state might have changed Markdown and therefore remains as an explicit interruption.
 */
export function recoverInterruptedMutationReceipts(ctx: AknoContext): void {
  if (!ctx.writable) return;
  ctx.store.transaction(() => {
    const rows = ctx.store.db
      .prepare(
        "SELECT actor, operation, idempotency_key, state FROM mutation_receipts WHERE state != 'completed'",
      )
      .all() as Pick<MutationReceiptRow, 'actor' | 'operation' | 'idempotency_key' | 'state'>[];
    const remove = ctx.store.db.prepare(
      `DELETE FROM mutation_receipts
        WHERE actor = ? AND operation = ? AND idempotency_key = ? AND state = 'reserved'`,
    );
    const interrupt = ctx.store.db.prepare(
      `UPDATE mutation_receipts SET state = 'interrupted', result = NULL, completed_at = NULL
        WHERE actor = ? AND operation = ? AND idempotency_key = ?
          AND state IN ('running', 'committed')`,
    );
    for (const row of rows) {
      if (
        activeReceipts.has(receiptIdentity(ctx.config.dbPath, row.actor, row.operation, row.idempotency_key))
      ) {
        continue;
      }
      if (row.state === 'reserved') remove.run(row.actor, row.operation, row.idempotency_key);
      else interrupt.run(row.actor, row.operation, row.idempotency_key);
    }
  });
}

function mutationRequestHash(operation: ReplaySafeOperation, input: Record<string, unknown>): string {
  return sha256(stableJson({ operation, request: canonicalRequest(operation, input) }));
}

function canonicalRequest(
  operation: ReplaySafeOperation,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const request = withoutUndefined(input);
  if (operation === 'write') {
    if (typeof request.slug === 'string') request.slug = normalizeSlug(request.slug);
    if (typeof request.propose_slug === 'string') request.propose_slug = normalizeSlug(request.propose_slug);
    if (Array.isArray(request.documents)) {
      request.documents = request.documents.map((document) =>
        isRecord(document) && typeof document.path === 'string'
          ? { ...document, path: path.resolve(document.path) }
          : document,
      );
    }
    request.dry_run = request.dry_run ?? false;
  } else if (operation === 'move') {
    if (typeof request.from === 'string') request.from = normalizeSlug(request.from);
    if (typeof request.to === 'string') request.to = normalizeSlug(request.to);
  } else if (operation === 'forget') {
    if (typeof request.slug === 'string') request.slug = request.slug.replace(/\.(md|markdown)$/i, '');
  } else {
    if (typeof request.path === 'string') request.path = normalizeSlug(request.path).replace(/\/\*+$/, '');
    const role = typeof request.role === 'string' ? request.role : 'knowledge';
    request.role = role;
    request.remember = request.remember ?? (role === 'knowledge' ? 'integrate' : 'deny');
    request.dry_run = request.dry_run ?? false;
  }
  return request;
}

function compactResult(operation: ReplaySafeOperation, result: MutationResult): string {
  const safe = withoutUndefined({ ...result });
  delete safe.removed;
  delete safe.rule;
  if (operation === 'folder' && result.rule !== undefined) {
    if (result.outcome === 'noop') {
      safe.rebuild_existing_rule = true;
      safe.rule_hash = sha256(stableJson(result.rule));
    } else {
      safe.rebuild_rule = true;
    }
  }

  let encoded = stableJson(safe);
  if (Buffer.byteLength(encoded) <= MAX_RESULT_BYTES) return encoded;

  const bounded = withoutUndefined({
    status: result.status,
    outcome: result.outcome,
    change_id: result.change_id,
    removed_from: result.removed_from,
    trashed: result.trashed,
    path: result.path,
    glob: result.glob,
    rules_file: result.rules_file,
    result_truncated: true,
  });
  encoded = stableJson(bounded);
  if (Buffer.byteLength(encoded) > MAX_RESULT_BYTES) {
    throw new AknoError('internal', 'mutation result locator exceeded its storage bound');
  }
  return encoded;
}

function replayResult(
  ctx: AknoContext,
  operation: ReplaySafeOperation,
  input: MutationInput,
  receipt: MutationReceiptRow,
): MutationResult {
  if (!receipt.result) throw new AknoError('internal', 'completed mutation receipt has no result locator');
  const result = JSON.parse(receipt.result) as MutationResult & {
    rebuild_rule?: boolean;
    rebuild_existing_rule?: boolean;
    rule_hash?: string;
    result_truncated?: boolean;
  };
  if (result.rebuild_rule && operation === 'folder') {
    result.rule = folderRuleFromRequest(input);
    delete result.rebuild_rule;
  }
  if (result.rebuild_existing_rule && operation === 'folder' && typeof result.glob === 'string') {
    const rule = currentFolderRule(ctx, result.glob);
    if (rule && sha256(stableJson(rule)) === result.rule_hash) result.rule = rule;
    delete result.rebuild_existing_rule;
    delete result.rule_hash;
  }
  if (operation === 'forget' && receipt.change_id && (input.fact || input.memory)) {
    const removed = removedTextFromJournal(ctx.store, receipt.change_id);
    if (removed !== null) result.removed = removed;
  }
  delete result.result_truncated;
  return { ...result, replayed: true };
}

function folderRuleFromRequest(input: MutationInput): Record<string, unknown> {
  const role = typeof input.role === 'string' ? input.role : 'knowledge';
  return withoutUndefined({
    description: input.description,
    role,
    remember: input.remember ?? (role === 'knowledge' ? 'integrate' : 'deny'),
    about: input.about,
    type: input.type,
    ingest: input.ingest,
    rank: input.rank,
    route: input.route,
  });
}

function currentFolderRule(ctx: AknoContext, glob: string): Record<string, unknown> | null {
  const compiled = ctx.config.rules.find((rule) => rule.glob === glob);
  if (!compiled) return null;
  const { glob: _glob, source: _source, specificity: _specificity, ...rule } = compiled;
  return withoutUndefined(rule);
}

function removedTextFromJournal(store: Store, changeId: string): string | null {
  const row = store.db
    .prepare(
      `SELECT before, after FROM change_files
        WHERE change_id = ? AND before IS NOT NULL AND after IS NOT NULL ORDER BY ord LIMIT 1`,
    )
    .get(changeId) as { before: string; after: string } | undefined;
  if (!row) return null;
  const before = row.before.split('\n');
  const after = row.after.split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  const removed = before.slice(prefix, before.length - suffix);
  return removed.length > 0 ? removed.join('\n') : null;
}

function readReceipt(
  store: Store,
  actor: AknoContext['actor'],
  operation: ReplaySafeOperation,
  key: string,
): MutationReceiptRow | undefined {
  return store.db
    .prepare(
      `SELECT * FROM mutation_receipts
        WHERE actor = ? AND operation = ? AND idempotency_key = ?`,
    )
    .get(actor, operation, key) as MutationReceiptRow | undefined;
}

function assertSameRequest(receipt: MutationReceiptRow, requestHash: string): void {
  if (receipt.request_hash === requestHash) return;
  throw new AknoError('conflict', 'this idempotency key is already bound to a different request', {
    operation: receipt.operation,
    idempotency_key: receipt.idempotency_key,
  });
}

function assertJournalCommit(store: Store, receipt: ActiveMutationReceipt, result: MutationResult): void {
  const row = readReceipt(store, receipt.actor, receipt.operation, receipt.idempotencyKey);
  if (
    row?.state !== 'committed' ||
    typeof result.change_id !== 'string' ||
    row.change_id !== result.change_id
  ) {
    throw new AknoError(
      'internal',
      `${receipt.operation} crossed its mutation boundary without an atomic journal commit`,
    );
  }
}

function interruptedError(receipt: MutationReceiptRow): AknoError {
  return new AknoError(
    'interrupted',
    `${receipt.operation} with this idempotency key may already have changed the knowledge base`,
    {
      operation: receipt.operation,
      idempotency_key: receipt.idempotency_key,
      state: receipt.state,
      ...(receipt.change_id ? { change_id: receipt.change_id } : {}),
      recovery: receipt.change_id
        ? 'Inspect the recorded change before deciding whether to undo or continue with a new idempotency key.'
        : 'Inspect the requested destination before continuing with a new idempotency key.',
    },
  );
}

function isRetryablePrecondition(result: MutationResult): boolean {
  return ['requires_folder', 'requires_approval', 'conflict'].includes(String(result.outcome));
}

function deleteReceipt(store: Store, receipt: ActiveMutationReceipt): void {
  store.db
    .prepare(
      `DELETE FROM mutation_receipts
        WHERE actor = ? AND operation = ? AND idempotency_key = ? AND request_hash = ?`,
    )
    .run(receipt.actor, receipt.operation, receipt.idempotencyKey, receipt.requestHash);
}

function receiptIdentity(dbPath: string, actor: string, operation: string, key: string): string {
  return `${dbPath}\0${actor}\0${operation}\0${key}`;
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, sortValue(value[key])]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
