export { open, type Akno, type OpenOptions } from './open.js';
export { loadConfig, type LoadOptions } from './config/load.js';
export type { AknoConfig, FolderRule, ResolvedModelRole, ResolvedProvider } from './config/schema.js';
export { expandTilde, resolveUserPath, findRepoRoot, isSafeSlug } from './config/paths.js';
export { doctor, type DoctorReport, type RoleReport } from './doctor.js';
export type { IndexOptions, IndexProgress, IndexReport } from './index/indexer.js';
export { Watcher, type WatcherEvents } from './watch/watcher.js';
export { ModelClient, type ChatMessage, type ModelOutcome } from './models/client.js';
export { compileRules, effectiveRule, matchRules, matchesGlob } from './rules/compile.js';
export { parsePage, resolveClass, relPathToSlug, type ParsedPage } from './kb/page.js';
export { parseFrontmatter, withId } from './kb/frontmatter.js';
export { chunkPage, applyReferenceFence, embeddingText, type Chunk } from './index/chunk.js';
export { inferMode, extractConcepts, splitMultiPart } from './recall/expand.js';
export { computeCoverage, estimateTokens } from './recall/assemble.js';
export { scoreConfidence } from './index/derive.js';
export { newPageId, factId, eventId, sha256 } from './store/ids.js';
export { runBench, type BenchResult, type BenchReport } from './bench.js';

// Re-exported so a host importing only `@akno/core` still gets the op types and
// the error class without adding a second dependency.
export {
  AknoError,
  OPS,
  OP_NAMES,
  PROTOCOL_VERSION,
  type Card,
  type AknoOps,
  type ErrorCode,
  type Line,
  type OpName,
  type PageClass,
  type RecallMode,
} from '@akno/protocol';
