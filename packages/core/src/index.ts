/**
 * The public surface of `@tenphi/akno-core`. Deliberately small: an export is a
 * promise not to break something, and a barrel that re-exports every internal
 * helper makes the actual contract impossible to read. Internals are reachable by
 * deep import for a caller who accepts the churn; tests import them relatively.
 */

export { open, readOnlyExplanation, type Akno, type OpenOptions } from './open.ts';
export { loadConfig, type LoadOptions } from './config/load.ts';
export type { AknoConfig, FolderRule, ResolvedModelRole, ResolvedProvider } from './config/schema.ts';
export { doctor, type DoctorReport, type RoleReport } from './doctor.ts';
export { runBench, type BenchOptions, type BenchReport, type BenchResult } from './bench.ts';
export type { IndexOptions, IndexProgress, IndexReport } from './index/indexer.ts';
export type { WatcherEvents } from './watch/watcher.ts';
export type { AknoWatchEvents } from './open.ts';
export type { InboxResult } from './ingest/inbox.ts';
export {
  DREAM_PHASES,
  parsePhase,
  type DreamOptions,
  type DreamMaintenancePlan,
  type DreamPhase,
  type DreamReport,
  type CuratedPage,
  type ObservationWritten,
  type PhaseReport,
} from './maintenance/dream.ts';
export type {
  DreamRunCounts,
  DreamRunMode,
  DreamRunReceipt,
  DreamRunStatus,
  DreamSnapshotManifest,
} from './maintenance/runs.ts';
export type { ConflictClaim, ConflictQualification, CrossPageConflict } from './maintenance/conflicts.ts';
export type { AdoptedDocument } from './maintenance/adopt.ts';
export type { BrokenLink, Housekeeping, OrphanedDocument, RuleDrift } from './maintenance/housekeeping.ts';
export type { LinkIdentitySignal, LinkRepair, RepairResult } from './maintenance/link-repairs.ts';
export type { ChangeFile, ChangeSummary, FileAction } from './write/journal.ts';
export type { ProposalRow } from './write/gate.ts';
export {
  CURATOR_SCHEMA,
  type ApplyMaintenanceResult,
  type CreateOperation,
  type DeleteOperation,
  type MaintenanceCheck,
  type MaintenanceDecision,
  type MaintenanceEvidence,
  type MaintenanceItem,
  type MaintenanceItemStatus,
  type MaintenanceMode,
  type MaintenanceOperation,
  type MaintenancePlan,
  type MaintenancePlanStatus,
  type MaintenancePlanSummary,
  type MaintenanceStatus,
  type MaintenanceVerification,
  type ReplaceOperation,
} from './maintenance/plans.ts';

// Re-exported so a host importing only `@tenphi/akno-core` gets the op types and the
// error class without adding a second dependency it never calls directly.
export {
  AknoError,
  OPS,
  OP_NAMES,
  PROTOCOL_VERSION,
  type Card,
  type DegradedReason,
  type DocumentTimelineEvidence,
  type AknoOps,
  type ErrorCode,
  type Line,
  type OpName,
  type PageRole,
  type RecallMode,
  type ResultStatus,
  type TimelineResult,
} from '@tenphi/akno-protocol';
