/**
 * The public surface of `@tenphi/akno-core`. Deliberately small: an export is a
 * promise not to break something, and a barrel that re-exports every internal
 * helper makes the actual contract impossible to read. Internals are reachable by
 * deep import for a caller who accepts the churn; tests import them relatively.
 */

export { open, readOnlyExplanation, type Akno, type OpenOptions } from './open.ts';
export { loadConfig, type LoadOptions } from './config/load.ts';
export {
  applySetupConfigWrite,
  planSetupConfigWrite,
  setupConfigTarget,
  type SetupConfigChange,
  type SetupConfigTargetOptions,
  type SetupConfigWriteOptions,
  type SetupConfigWritePlan,
  type SetupConfigWriteResult,
} from './config/write-setup.ts';
export type {
  AknoConfig,
  FolderRule,
  MaintenanceLimits,
  MaintenancePolicy,
  MaintenanceProfile,
  MaintenanceTransform,
  ProviderApi,
  ProviderTransport,
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
export {
  type MaintenancePathOutcome,
  type MaintenancePathPolicy,
  type MaintenancePathReason,
  type MaintenancePathState,
  type MaintenancePathTransformPolicy,
  type PageMaintenanceTransform,
} from './maintenance/path-policy.ts';
export {
  doctor,
  type AdmissionPreview,
  type DoctorOptions,
  type DoctorReport,
  type RoleReport,
} from './doctor.ts';
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
export type { ProviderApiResolution } from './models/provider-api.ts';
export {
  MODEL_FREE_PRESET,
  MODEL_FREE_PRESET_STATUS,
  modelFreePreset,
  type ModelFreePresetOptions,
} from './setup/model-free.ts';
export { runBench, type BenchOptions, type BenchReport, type BenchResult } from './bench.ts';
export {
  ANSWER_BENCH_SCHEMA_VERSION,
  markAnswerBenchPersisted,
  runAnswerBench,
  type AnswerBenchCaseReport,
  type AnswerBenchOptions,
  type AnswerBenchReport,
  type AnswerBenchRunSummary,
} from './bench/answer.ts';
export {
  AUTO_RECALL_BENCH_SCHEMA_VERSION,
  markAutoRecallBenchPersisted,
  runAutoRecallBench,
  validateAutoRecallCorpora,
  type AutoRecallBenchCaseReport,
  type AutoRecallBenchOptions,
  type AutoRecallBenchReport,
  type AutoRecallBenchRunSummary,
} from './bench/auto-recall.ts';
export {
  AUTO_RECALL_ANSWER_BENCH_SCHEMA_VERSION,
  AUTO_RECALL_ANSWER_HELD_OUT_FINGERPRINT,
  AUTO_RECALL_HOST_PROMPT_VERSION,
  markAutoRecallAnswerBenchPersisted,
  runAutoRecallAnswerBench,
  validateAutoRecallAnswerCorpora,
  type AutoRecallAnswerArmReport,
  type AutoRecallAnswerBenchOptions,
  type AutoRecallAnswerBenchReport,
  type AutoRecallAnswerCaseReport,
  type AutoRecallAnswerRunSummary,
} from './bench/auto-recall-answer.ts';
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
  MERGE_DISCOVERY_BENCH_VERSION,
  evaluateMergeDiscoveryScores,
  evaluateMergeDiscoveryStability,
  markMergeDiscoveryBenchPersisted,
  runMergeDiscoveryBench,
  type MergeDiscoveryBenchOptions,
  type MergeDiscoveryBenchReport,
  type MergeDiscoveryCaseScore,
  type MergeDiscoveryCategory,
  type MergeDiscoveryClassifierCase,
  type MergeDiscoveryClassifierReport,
  type MergeDiscoveryEvaluation,
  type MergeDiscoverySplit,
  type MergeDiscoveryStability,
} from './bench/merge-discovery.ts';
export {
  MERGE_DISCOVERY_REVIEW_EVIDENCE_VERSION,
  MERGE_DISCOVERY_REVIEW_PACKET_VERSION,
  completeMergeDiscoveryReview,
  createMergeDiscoveryReviewPacket,
  type MergeDiscoveryReviewCase,
  type MergeDiscoveryReviewEvidence,
  type MergeDiscoveryReviewIssue,
  type MergeDiscoveryReviewMark,
  type MergeDiscoveryReviewPacket,
  type MergeDiscoveryReviewerKind,
  type MergeDiscoveryReviewSource,
} from './bench/merge-discovery-review.ts';
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
  completeRankingReview,
  createRankingReviewPacket,
  rankingCorpusFingerprint,
  rankingReviewEvidenceMatches,
  rebaseRankingReviewPacket,
  reviewPacketFingerprint,
  RANKING_REVIEW_EVIDENCE_SCHEMA_VERSION,
  RANKING_REVIEW_PACKET_SCHEMA_VERSION,
  type RankingReviewCase,
  type RankingReviewDecision,
  type RankingReviewEvidence,
  type RankingReviewIssue,
  type RankingReviewMark,
  type RankingReviewPacket,
  type RankingReviewerKind,
  type RankingReviewSource,
} from './bench/ranking-review.ts';
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
  RANKING_INTERACTIVE_P95_TARGET_MS,
  RANKING_LATENCY_SCHEMA_VERSION,
  evaluateRankingLatency,
  refreshRankingLatencyReport,
  runRankingLatencyBench,
  type RankingLatencyCheck,
  type RankingLatencyMetrics,
  type RankingLatencyOptions,
  type RankingLatencyProfile,
  type RankingLatencyProgress,
  type RankingLatencyReport,
} from './bench/ranking-latency.ts';
export {
  attachRankingReviewEvidence,
  attachRankingLatencyEvidence,
  attachRankingEndToEndEvidence,
  evaluateRankingRelease,
  markRankingMatrixPersisted,
  refreshRankingMatrixReport,
  medianTop3Overlap,
  RANKING_MATRIX_SCHEMA_VERSION,
  RANKING_MATRIX_VARIANT_IDS,
  runRankingMatrix,
  type RankingEndToEndEvidence,
  type RankingMatrixOptions,
  type RankingMatrixProgress,
  type RankingMatrixReport,
  type RankingMatrixRun,
  type RankingMatrixSelection,
  type RankingMatrixVariant,
  type RankingMatrixVariantId,
  type RankingReleaseCheck,
  type RankingReleaseGate,
} from './bench/ranking-matrix.ts';
export type { IndexOptions, IndexProgress, IndexReport } from './index/indexer.ts';
export type { WatcherEvents } from './watch/watcher.ts';
export type { AknoWatchEvents } from './open.ts';
export type { MaintenanceNotificationMode } from './config/schema.ts';
export type { InboxResult } from './ingest/inbox.ts';
export {
  DREAM_PHASES,
  parsePhase,
  type DreamOptions,
  type DreamMaintenancePlan,
  type DreamConflictRefreshReceipt,
  type DreamPhase,
  type DreamReport,
  type CuratedPage,
  type ObservationWritten,
  type PhaseReport,
} from './maintenance/dream.ts';
export type {
  ManagedItemFindingCode,
  ManagedItemFindingReference,
  ManagedItemReport,
} from './maintenance/managed-items.ts';
export type {
  MaintenanceBudgetDimension,
  MaintenanceBudgetReceipt,
  MaintenanceBudgetUsage,
} from './maintenance/budget.ts';
export type {
  DreamAutoEstimate,
  DreamRunCounts,
  DreamRunMode,
  DreamRunProfile,
  DreamRunReceipt,
  DreamRunStatus,
  DreamSnapshotManifest,
} from './maintenance/runs.ts';
export type {
  DreamRunVerificationCheckStatus,
  DreamRunVerificationIssue,
  DreamRunVerificationIssueCode,
  DreamRunVerificationReceipt,
  DreamRunVerificationStatus,
} from './maintenance/run-verification.ts';
export type {
  DreamModelDegradation,
  DreamModelStage,
  DreamModelStageUsage,
  DreamModelUsageReceipt,
} from './maintenance/model-telemetry.ts';
export type { SemanticMergeDiscoveryMetrics } from './maintenance/semantic-merge-discovery.ts';
export type { ConflictClaim, ConflictQualification, CrossPageConflict } from './maintenance/conflicts.ts';
export type { AdoptedDocument } from './maintenance/adopt.ts';
export type {
  BrokenLink,
  Housekeeping,
  HousekeepingPlanRef,
  OrphanedDocument,
  RuleDrift,
  RuleRepairDisposition,
} from './maintenance/housekeeping.ts';
export type {
  GraphMaintenanceCandidate,
  GraphMaintenanceCandidateKind,
} from './maintenance/graph-candidates.ts';
export type { LinkIdentitySignal, LinkRepair, RepairResult } from './maintenance/link-repairs.ts';
export type { RuleRepairAssessment } from './maintenance/rule-drift.ts';
export type { ChangeFile, ChangeSummary, FileAction } from './write/journal.ts';
export type { ProposalRow } from './write/gate.ts';
export {
  CURATOR_SCHEMA,
  MAINTENANCE_PLAN_STATUSES,
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
  type MaintenancePlanPruneResult,
  type MaintenancePlanStatus,
  type MaintenancePlanSummary,
  type MaintenanceRevisionInput,
  type MaintenanceRevisionSummary,
  type MaintenanceStatus,
  type MaintenanceStatusQuery,
  type MaintenanceVerification,
  type MoveOperation,
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
