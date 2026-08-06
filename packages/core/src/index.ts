/**
 * The public surface of `@akno/core`. Deliberately small: an export is a
 * promise not to break something, and a barrel that re-exports every internal
 * helper makes the actual contract impossible to read. Internals are reachable by
 * deep import for a caller who accepts the churn; tests import them relatively.
 */

export { open, type Akno, type OpenOptions } from './open.ts';
export { loadConfig, type LoadOptions } from './config/load.ts';
export type { AknoConfig, FolderRule, ResolvedModelRole, ResolvedProvider } from './config/schema.ts';
export { doctor, type DoctorReport, type RoleReport } from './doctor.ts';
export { runBench, type BenchOptions, type BenchReport, type BenchResult } from './bench.ts';
export type { IndexOptions, IndexProgress, IndexReport } from './index/indexer.ts';
export type { WatcherEvents } from './watch/watcher.ts';

// Re-exported so a host importing only `@akno/core` gets the op types and the
// error class without adding a second dependency it never calls directly.
export {
  AknoError,
  OPS,
  OP_NAMES,
  PROTOCOL_VERSION,
  type Card,
  type DegradedReason,
  type AknoOps,
  type ErrorCode,
  type Line,
  type OpName,
  type PageClass,
  type RecallMode,
  type ResultStatus,
} from '@akno/protocol';
