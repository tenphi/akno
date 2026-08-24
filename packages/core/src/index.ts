/**
 * The public surface of `@tenphi/akno-core`. Deliberately small: an export is a
 * promise not to break something, and a barrel that re-exports every internal
 * helper makes the actual contract impossible to read. Internals are reachable by
 * deep import for a caller who accepts the churn; tests import them relatively.
 */

export { open, readOnlyExplanation, type Akno, type OpenOptions } from './open.ts';
export { loadConfig, type LoadOptions } from './config/load.ts';
export type {
  AknoConfig,
  FolderRule,
  MaintenanceLimits,
  MaintenancePolicy,
  MaintenanceProfile,
  MaintenanceTransform,
  ReasoningEffort,
  ResolvedModelRole,
  ResolvedProvider,
} from './config/schema.ts';
export {
  configuredTransformPolicy,
  configuredMaintenanceAuthority,
  effectiveTransformPolicy,
  highestPolicyMode,
  policyMode,
  profileMode,
  type EffectiveMaintenancePolicy,
  type MaintenanceAuthority,
  type MaintenancePhaseAuthority,
} from './maintenance/profile.ts';
export { doctor, type DoctorReport, type RoleReport } from './doctor.ts';
export {
  OPENAI_LUNA_EMBEDDING_DIMENSIONS,
  OPENAI_LUNA_EMBEDDING_MODEL,
  OPENAI_LUNA_GENERATIVE_MODEL,
  OPENAI_LUNA_PRESET,
  OPENAI_LUNA_PRESET_STATUS,
  openAiLunaPreset,
  preflightOpenAiLuna,
  type OpenAiLunaPreflightReport,
  type OpenAiLunaPresetOptions,
  type SetupMaintenanceMode,
  type SetupRolePreflight,
} from './setup/openai.ts';
export { runBench, type BenchOptions, type BenchReport, type BenchResult } from './bench.ts';
export {
  runMixedRetrievalBench,
  type MixedRetrievalBenchOptions,
  type MixedRetrievalBenchReport,
  type RetrievalBenchComparison,
  type RetrievalBenchResult,
  type RetrievalBenchUnit,
} from './bench/mixed-retrieval.ts';
export {
  runEntityResolutionBench,
  type EntityResolutionBenchCaseReport,
  type EntityResolutionBenchOptions,
  type EntityResolutionBenchReport,
} from './bench/entity-resolution.ts';
export {
  GRAPH_BENCH_SCHEMA_VERSION,
  runGraphBench,
  type GraphBenchCaseReport,
  type GraphBenchCategory,
  type GraphBenchOptions,
  type GraphBenchReport,
} from './bench/graph.ts';
export {
  runLlmRankingProbe,
  type LlmRankingProbeOptions,
  type LlmRankingProbeReport,
} from './bench/llm-ranking-probe.ts';
export {
  runRankingBench,
  validateRankingCorpus,
  type RankingBenchOptions,
  type RankingBenchReport,
  type RankingBenchSplit,
  type RankingBenchSystem,
  type RankingCandidateCount,
  type RankingCategory,
  type RankingCategoryReport,
  type RankingExcerptChars,
  type RankingQualityMetrics,
  type RankingQualificationMetrics,
  type RankingQueryReport,
} from './bench/ranking.ts';
export {
  RANKING_END_TO_END_SCHEMA_VERSION,
  runRankingEndToEnd,
  type RankingEndToEndCategoryReport,
  type RankingEndToEndOptions,
  type RankingEndToEndProgress,
  type RankingEndToEndQueryReport,
  type RankingEndToEndReport,
  type RankingEndToEndStageReport,
  type RankingEndToEndSystem,
} from './bench/ranking-end-to-end.ts';
export {
  attachRankingEndToEndEvidence,
  evaluateRankingRelease,
  markRankingMatrixPersisted,
  refreshRankingMatrixReport,
  medianTop3Overlap,
  RANKING_MATRIX_SCHEMA_VERSION,
  runRankingMatrix,
  type RankingEndToEndEvidence,
  type RankingMatrixOptions,
  type RankingMatrixProgress,
  type RankingMatrixReport,
  type RankingMatrixRun,
  type RankingMatrixSelection,
  type RankingMatrixVariant,
  type RankingReleaseCheck,
  type RankingReleaseGate,
} from './bench/ranking-matrix.ts';
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
  MaintenanceBudgetDimension,
  MaintenanceBudgetReceipt,
  MaintenanceBudgetUsage,
} from './maintenance/budget.ts';
export type {
  DreamRunCounts,
  DreamRunMode,
  DreamRunProfile,
  DreamRunReceipt,
  DreamRunStatus,
  DreamSnapshotManifest,
} from './maintenance/runs.ts';
export type { ConflictClaim, ConflictQualification, CrossPageConflict } from './maintenance/conflicts.ts';
export type { AdoptedDocument } from './maintenance/adopt.ts';
export type { BrokenLink, Housekeeping, OrphanedDocument, RuleDrift } from './maintenance/housekeeping.ts';
export type {
  GraphMaintenanceCandidate,
  GraphMaintenanceCandidateKind,
} from './maintenance/graph-candidates.ts';
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
  type MaintenanceItemStatusCode,
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
  type GraphEdgeRef,
  type GraphInput,
  type GraphNodeRef,
  type GraphOutput,
  type GraphPath,
  type Line,
  type OpName,
  type PageRole,
  type RecallMode,
  type ResultStatus,
  type TimelineResult,
} from '@tenphi/akno-protocol';
