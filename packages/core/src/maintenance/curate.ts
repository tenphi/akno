import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { AknoContext } from '../context.ts';
import { folderCatalog, type FolderCatalogEntry } from '../kb/folders.ts';
import { parseFrontmatter, withAknoAliases } from '../kb/frontmatter.ts';
import { AKNO_ITEM, normalizeLinkTarget, parsePage } from '../kb/page.ts';
import { parseJsonLoose } from '../models/client.ts';
import { effectiveRule, matchesGlob } from '../rules/compile.ts';
import { missingNumericValues } from './repair.ts';
import { mergePathAllowed, pageAllowsMaintenanceTransform } from './path-policy.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { sha256 } from '../store/ids.ts';
import {
  cleanTemporalProposal,
  inferTemporalMetadata,
  readTemporalDeclaration,
  temporalBoundaryCandidates,
  temporalClock,
  temporalPrompt,
  temporalState,
  withTemporalMetadata,
  type TemporalClock,
  type TemporalMetadata,
} from './temporal.ts';

export interface CuratedPage {
  slug: string;
  mode: 'hygiene' | 'synthesize';
  action: 'would-update' | 'updated' | 'unchanged' | 'rejected';
  splits: string[];
  extractions: string[];
  merges: string[];
  issues: string[];
  temporal?: {
    source: 'declared' | 'inferred' | 'model';
    state: 'active' | 'past';
    until: string;
    archival: boolean;
  };
}

export interface CurateResult {
  pages: CuratedPage[];
  files: ChangeFile[];
  changeId: string | null;
  warnings: string[];
  /** Exact, already-guarded rewrites for a durable maintenance plan. */
  drafts: CurateDraft[];
}

export interface CurateDraft {
  slug: string;
  mode: 'hygiene' | 'synthesize';
  relPath: string;
  inputHash: string;
  before: string;
  after: string;
  children: { slug: string; relPath: string; content: string }[];
  extractions: { slug: string; relPath: string; content: string }[];
  merge: {
    sourceSlug: string;
    sourceRelPath: string;
    sourceBefore: string;
    sourceBodyHash: string;
    identitySignal: string;
    linkUpdates: { slug: string; relPath: string; before: string; after: string }[];
  } | null;
  evidence: {
    slug: string;
    relPath: string;
    relationship: 'about' | 'outbound' | 'backlink';
    bodyHash: string;
    contentHash: string;
    summary: string | null;
    claims: string[];
    events: string[];
  }[];
  conflicts: { slug: string; subject: string; attribute: string; claim: string; value: string }[];
}

export type CurateTransformationKind = 'hygiene' | 'synthesis' | 'split' | 'extract' | 'merge';

interface PageRow {
  id: string;
  slug: string;
  rel_path: string;
  title: string;
  role: string;
  dream_management: 'hygiene' | 'synthesize';
  about: string;
  frontmatter: string;
  aliases: string;
  body_hash: string;
  bytes: number;
  curate_input_hash: string | null;
  curate_status: CurateStatus | null;
}

type CurateStatus = 'preview' | 'unchanged' | 'rejected' | 'applied';

interface EvidencePage {
  id: string;
  slug: string;
  rel_path: string;
  summary: string | null;
  about: string;
  role: string;
  body_hash: string;
  content_hash: string;
  facts: EvidenceFact[];
  events: { date: string; summary: string }[];
  relationship: 'about' | 'outbound' | 'backlink';
}

interface EvidenceFact {
  claim: string;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  item_id: string | null;
}

interface ConflictEvidence {
  subject: string;
  attribute: string;
  claim: string;
  value: string;
  slug: string;
}

interface CurateState {
  pageId: string;
  inputHash: string;
  status: CurateStatus;
}

interface Draft {
  body?: unknown;
  splits?: unknown;
  extracts?: unknown;
  temporal?: unknown;
}

interface SplitDraft {
  suffix: string;
  title: string;
  body: string;
}

interface ExtractionDraft {
  slug: string;
  title: string;
  body: string;
  bridge: string;
  sourceHeading: string;
  startIndex: number;
  endIndex: number;
}

interface ExtractionSection {
  heading: string;
  body: string;
  startIndex: number;
  endIndex: number;
}

interface MergeCandidate {
  canonical: PageRow;
  duplicate: PageRow;
  identitySignal: string;
}

interface MergeInboundPage {
  id: string;
  slug: string;
  relPath: string;
  role: string;
  dreamManagement: string;
  bodyHash: string;
  content: string;
}

const HYGIENE_SYSTEM = `You are a conservative Markdown page hygienist. Reply with JSON only:
{"body":"the complete revised Markdown body"}

You may fix formatting, Markdown, grammar, awkward language and minor local organization. Preserve
the page's meaning and semantically equivalent top-level structure. Do not add facts. Do not remove
anything except exact duplicates. Keep every <!-- akno:item ... --> marker immediately before the
knowledge it identifies. Do not add frontmatter.`;

export const HYGIENE_SCHEMA = z.object({ body: z.string() });

const SYNTHESIZE_SYSTEM = `You synthesize one canonical Markdown knowledge page from its current body
and linked evidence. Reply with JSON only:
{"body":"complete canonical Markdown body","splits":[{"suffix":"topic","title":"Title","body":"complete child body"}],"extracts":[{"slug":"allowed-folder/topic","title":"Title","source_heading":"## Exact heading from current body","bridge":"See [[allowed-folder/topic]]."}],"temporal":false}

You may fully rewrite and restructure the body. Accumulate knowledge by subject; link to evidence and
related pages in the sections they support instead of repeating whole source pages. A link or backlink
is only a relevance hint: use a linked fact only when it is directly about this canonical subject.
Do not copy cross-cutting trip, passport, accommodation, booking or itinerary boilerplate into every
place page. When such a page is genuinely useful, link it once without restating its general details.
Internal page links must use [[the/exact-supplied-slug]]. Never invent a URL, relative path or slug,
and never alter or remove an existing link target. Reorganize rather
than summarize: preserve every factual detail already in the canonical body, including dates, times,
prices, measurements, descriptions, access instructions and practical guidance. Numeric formatting and
sentence punctuation may change, but no value may disappear. Use ## Unresolved only when the supplied
conflict list contains a real unresolved conflict; do not manufacture one from compatible access rules
or descriptions of different areas. Do not choose a side without evidence. Keep every
<!-- akno:item ... --> marker exactly once, immediately before the knowledge it identifies. The
canonical page remains at its current slug. Suggest splits only for genuinely oversized, coherent
sections. Child suffixes are one lowercase hyphenated path segment. Do not add frontmatter.

An extraction is different from a split: move one coherent, reusable subject out while the source
retains its primary purpose. Propose at most one extraction, only into an exact allowed destination
folder supplied by the user message. Use a lowercase-hyphenated basename and never make the target a
child of the source page. Select one exact eligible Markdown heading supplied by the user message in
"source_heading". Akno—not you—will move that complete section verbatim, including its item markers,
provenance and links, and will insert the bridge at the same boundary. When proposing an extraction,
reproduce the complete current body byte for byte in "body"; do not remove, copy, summarize or rewrite
the selected section yourself. The short bridge must link to the exact proposed slug. Do not propose a
split and an extraction for the same page.

Always send "splits" and "extracts" — empty arrays when there is nothing to move.

When no temporal boundary is supplied but the user message lists explicit boundary candidates, set
"temporal" to {"kind":"event","start":"date or timestamp","until":"date or timestamp","timezone":"IANA zone"}
only when this whole page is a bounded event. Use only listed dates, use null for unknown fields and
false for evergreen or ambiguous pages. A date means the complete local day; never invent an
end-of-day time.`;

/**
 * Every field is required and `false`/`null` carry the "nothing here" cases, because strict
 * mode rejects an optional property — so the prompt above was reworded to match. Neither is a
 * behaviour change: `cleanSplits` already treats `[]` exactly as it treats an absent list, and
 * `cleanTemporal` already reads a null `start` or `timezone` as unset.
 *
 * The boundary this schema cannot enforce is the one that matters most: `cleanTemporalProposal`
 * still rejects any date the page did not itself supply. A grammar can require a date-shaped
 * string; only the caller knows which dates were on the page.
 */
export const SYNTHESIZE_SCHEMA = z.object({
  body: z.string(),
  splits: z.array(z.object({ suffix: z.string(), title: z.string(), body: z.string() })),
  extracts: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      source_heading: z.string(),
      bridge: z.string(),
    }),
  ),
  temporal: z.union([
    z.literal(false),
    z.object({
      kind: z.literal('event'),
      start: z.string().nullable(),
      until: z.string(),
      timezone: z.string().nullable(),
    }),
  ]),
});

const MERGE_SYSTEM = `You merge two Markdown pages that an explicit exact alias identifies as the same
durable subject. Reply with JSON only: {"body":"complete merged canonical Markdown body"}

The user message supplies a canonical body and a prepared duplicate body. Preserve every non-blank line from
both inputs verbatim. An exactly identical line repeated by both inputs may appear once, but otherwise do not
rewrite, summarize, combine, or omit lines. You may interleave complete sections to make one coherent page,
but preserve line order within each input. Do not add connective prose, headings, frontmatter, facts, links, or item markers. Keep each
<!-- akno:item ... --> marker immediately before the knowledge it identifies. The canonical page's first H1
must remain its first H1. The duplicate title is preserved separately as an alias, so its leading H1 may already
have been removed from the prepared duplicate body.`;

export const MERGE_SCHEMA = z.object({ body: z.string() });

const ARCHIVE_SYSTEM = `${SYNTHESIZE_SYSTEM}

This page describes an event that has ended. This is an archival synthesis, not another planning pass.
Integrate supported outcomes, later facts, direct links and resolutions, but never infer that a planned
activity happened merely because its date passed. Preserve plans as plans unless supplied evidence confirms
their outcome. Do not refresh operational advice or reorganize the page without a substantive archival gain.
If no meaningful post-event knowledge is supplied, reproduce the current body byte for byte.`;

const VERIFY_SYSTEM = `You verify an automatic Markdown rewrite. Reply with JSON only:
{"ok":true,"issues":[]}

Reject a hygiene rewrite if it changes meaning, loses non-duplicate knowledge, adds facts, or makes
more than minor structural changes. Reject a synthesis rewrite if it invents facts, loses supported
knowledge, hides a conflict, misattributes evidence, repeats unrelated cross-cutting logistics, changes
an existing link target, invents a URL, creates an incoherent split, or extracts content that is not a
coherent reusable subject. For an extraction, require every moved authored line to remain verbatim,
the source to retain its primary purpose, a useful source bridge, a source backlink, and an independent
destination rather than a disguised child split. A backlink is only a relevance
hint, not evidence that every fact on that page belongs here. Stable item markers are metadata, not
prose, and must remain attached to their knowledge. For an archival rewrite, reject any claim that
a plan happened merely because its date passed, and reject restructuring with no substantive
post-event knowledge.`;

const VERIFY_MERGE_SYSTEM = `${VERIFY_SYSTEM}

For a merge, require the exact alias signal to establish one durable identity. Reject the merge if the two
pages merely concern related subjects, if any unique authored detail or provenance marker is lost, if an
unrelated page is rewritten, if an inbound link is not redirected, or if deleting the duplicate would orphan
owned evidence. Exact duplicate lines may be deduplicated.`;

export const VERIFY_SCHEMA = z.object({ ok: z.boolean(), issues: z.array(z.string()) });

// Changing a prompt or a deterministic rule must invalidate the decisions made by its predecessor.
// 11: exact-alias, lossless merge candidates and their multi-page link updates are now part of curation.
// Decisions from the previous transformation surface must be reconsidered once.
const CURATE_FINGERPRINT_VERSION = 11;

export async function curatePages(
  ctx: AknoContext,
  options: {
    dryRun: boolean;
    recordState: boolean;
    /** A durable plan may supersede a legacy preview without changing the page first. */
    includePreviewed?: boolean;
    /** Classes the policy layer permits this pass to inspect and seal. */
    allowedKinds?: ReadonlySet<CurateTransformationKind>;
  },
): Promise<CurateResult> {
  const settings = ctx.config.maintenance.curate;
  const allowedKinds =
    options.allowedKinds ??
    new Set<CurateTransformationKind>(['hygiene', 'synthesis', 'split', 'extract', 'merge']);
  const result: CurateResult = { pages: [], files: [], changeId: null, warnings: [], drafts: [] };
  const rows = ctx.store.db
    .prepare(
      `SELECT id, slug, rel_path, title, role, dream_management, about, frontmatter, aliases, body_hash, bytes,
              curate_input_hash, curate_status
         FROM pages
        WHERE dream_management IN ('hygiene', 'synthesize') AND role = 'knowledge'
        ORDER BY updated_at DESC, slug`,
    )
    .all() as PageRow[];
  const knownSlugs = new Set(
    (ctx.store.db.prepare('SELECT slug FROM pages').all() as { slug: string }[]).map((row) =>
      row.slug.toLowerCase(),
    ),
  );
  const extractionFolders = allowedExtractionFolders(ctx);
  const extractionPolicyHash = extractionPolicyFingerprint(ctx, extractionFolders);
  const clock = temporalClock();

  const splitLimit = allowedKinds.has('split') ? settings.maxSplits : 0;
  const extractLimit = allowedKinds.has('extract') ? settings.maxExtracts : 0;
  let splitBudget = splitLimit;
  let extractBudget = extractLimit;
  let attempted = 0;
  const state = new Map<string, CurateState>();
  const staged: {
    row: PageRow;
    before: string;
    after: string;
    children: { relPath: string; content: string; slug: string }[];
    extractions: { relPath: string; content: string; slug: string }[];
    evidence: EvidencePage[];
    conflicts: ConflictEvidence[];
    inputHash: string;
    metadataOnly: boolean;
  }[] = [];
  const mergeDrafts: CurateDraft[] = [];
  const mergeReserved = new Set<string>();
  const mergeOperationPaths = new Set<string>();

  // Merge is available only through durable plans. The legacy `write` switch cannot represent
  // a separately decided deletion, while audit/review/auto all seal the exact multi-file item.
  if (options.includePreviewed && allowedKinds.has('merge') && settings.maxMerges > 0) {
    const candidates = discoverMergeCandidates(ctx, rows, settings.mergeFolders);
    for (const candidate of candidates) {
      mergeReserved.add(candidate.canonical.id);
      mergeReserved.add(candidate.duplicate.id);
    }
    let mergeAttempts = 0;
    for (const candidate of candidates) {
      if (mergeAttempts >= settings.maxMerges) break;
      if (attempted + 2 > settings.maxPages) break;
      const inspection = await inspectMergeCandidate(ctx, candidate);
      if (!inspection) {
        result.warnings.push(
          `${candidate.canonical.slug}: could not read the exact-alias merge candidate ${candidate.duplicate.slug}`,
        );
        continue;
      }
      for (const page of inspection.inbound) mergeReserved.add(page.id);
      if (!curationDue(candidate.canonical, inspection.inputHash, options.dryRun, true)) continue;
      mergeAttempts++;
      attempted += 2;
      const prepared = await prepareMergeDraft(ctx, inspection);
      const paths = prepared.draft
        ? [
            prepared.draft.relPath,
            ...prepared.draft.merge!.linkUpdates.map((update) => update.relPath),
            prepared.draft.merge!.sourceRelPath,
          ]
        : [];
      if (paths.some((relPath) => mergeOperationPaths.has(relPath))) {
        prepared.draft = null;
        prepared.issues = ['merge overlaps another planned merge operation in this run'];
        prepared.cacheable = true;
      }
      if (prepared.issues.length > 0 || !prepared.draft) {
        result.pages.push({
          slug: candidate.canonical.slug,
          mode: 'synthesize',
          action: 'rejected',
          splits: [],
          extractions: [],
          merges: [candidate.duplicate.slug],
          issues: prepared.issues.length > 0 ? prepared.issues : ['merge planner returned no exact draft'],
        });
        if (prepared.cacheable) {
          queueCurateState(state, candidate.canonical.id, prepared.inputHash, 'rejected');
        }
        continue;
      }
      mergeDrafts.push(prepared.draft);
      for (const relPath of paths) mergeOperationPaths.add(relPath);
      for (const update of prepared.draft.merge!.linkUpdates) {
        const row = rows.find((page) => page.slug === update.slug);
        if (row) mergeReserved.add(row.id);
      }
      result.pages.push({
        slug: candidate.canonical.slug,
        mode: 'synthesize',
        action: 'would-update',
        splits: [],
        extractions: [],
        merges: [candidate.duplicate.slug],
        issues: [],
      });
    }
  }

  for (const row of rows) {
    if (mergeReserved.has(row.id)) continue;
    const pathKind = row.dream_management === 'hygiene' ? 'hygiene' : 'synthesis';
    if (
      !pageAllowsMaintenanceTransform(
        ctx.config,
        { slug: row.slug, role: row.role, dreamManagement: row.dream_management },
        pathKind,
      )
    ) {
      continue;
    }
    if (row.dream_management === 'hygiene' && !allowedKinds.has('hygiene')) continue;
    if (
      row.dream_management === 'synthesize' &&
      !allowedKinds.has('synthesis') &&
      !allowedKinds.has('split') &&
      !allowedKinds.has('extract')
    ) {
      continue;
    }
    const before = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
    if (before === null) {
      result.warnings.push(`${row.slug}: could not read page`);
      continue;
    }
    const fm = parseFrontmatter(before);
    const body = before.slice(fm.bodyOffset);
    const inferenceInput = { slug: row.slug, title: row.title, frontmatter: fm.data, body };
    const declaration = readTemporalDeclaration(fm.data);
    if (declaration.invalid) {
      result.warnings.push(
        `${row.slug}: akno.temporal is malformed; automatic temporal handling was skipped`,
      );
    }
    let temporal = declaration.metadata;
    let temporalSource: 'declared' | 'inferred' | 'model' | null = temporal ? 'declared' : null;
    if (!temporal && !declaration.disabled && !declaration.invalid && row.dream_management === 'synthesize') {
      temporal = inferTemporalMetadata(inferenceInput);
      if (temporal) temporalSource = 'inferred';
    }
    let eventState = temporal ? temporalState(temporal, clock) : null;
    let archival = row.dream_management === 'synthesize' && eventState === 'past';
    const allEvidence = row.dream_management === 'synthesize' ? evidenceFor(ctx, row) : [];
    let evidence = archival ? archivalEvidence(allEvidence) : allEvidence;
    const conflicts = row.dream_management === 'synthesize' ? conflictsFor(ctx, row.id) : [];
    let inputHash = curateInputHash(
      row,
      evidence,
      conflicts,
      temporal,
      eventState,
      extractionPolicyHash,
      incomingLinkFingerprint(ctx, row.id),
    );
    if (!curationDue(row, inputHash, options.dryRun, options.includePreviewed ?? false)) continue;
    if (attempted >= settings.maxPages) break;
    attempted++;

    const candidates =
      row.dream_management === 'synthesize' && !temporal && !declaration.disabled && !declaration.invalid
        ? temporalBoundaryCandidates(inferenceInput)
        : [];
    const prompt =
      row.dream_management === 'hygiene' ? HYGIENE_SYSTEM : archival ? ARCHIVE_SYSTEM : SYNTHESIZE_SYSTEM;
    const sourceSections = extractionSections(body, settings.extractSectionBytes);
    const canRequestExtraction =
      row.dream_management === 'synthesize' &&
      !archival &&
      extractBudget > 0 &&
      Buffer.byteLength(before) >= settings.extractAfterBytes &&
      extractionFolders.length > 0 &&
      sourceSections.length > 0;
    const draftResult = await ctx.models.derive.chat(
      [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content:
            `${temporalPrompt(temporal, clock)}\n\nSlug: ${row.slug}\nTitle: ${row.title}` +
            (row.dream_management === 'synthesize'
              ? extractionPrompt(
                  canRequestExtraction ? extractionFolders : [],
                  canRequestExtraction ? sourceSections : [],
                )
              : '') +
            (candidates.length
              ? `\nTemporal boundary candidates explicitly present in this page: ${candidates.join(', ')}`
              : '') +
            `\n\nCurrent body:\n${body.slice(0, 40_000)}` +
            (evidence.length
              ? `\n\nEvidence graph:\n${renderEvidence(evidence).join('\n\n').slice(0, 40_000)}`
              : '') +
            (conflicts.length ? `\n\nUnresolved conflicts:\n${renderConflicts(conflicts).join('\n')}` : ''),
        },
      ],
      {
        schema: row.dream_management === 'hygiene' ? HYGIENE_SCHEMA : SYNTHESIZE_SCHEMA,
        maxTokens: 8_000,
      },
    );
    const parsed = draftResult.ok && draftResult.value ? parseJsonLoose<Draft>(draftResult.value) : null;
    let nextBody = typeof parsed?.body === 'string' ? endWithNewline(parsed.body) : null;
    if (!nextBody) {
      if (draftResult.ok) ctx.models.derive.reportInvalidResponse();
      const issue = draftResult.error ?? 'draft was not valid JSON with a body';
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: [issue],
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      // Provider/transport failures are retryable. A successful model call that returned an
      // unusable draft is a completed rejection and should not burn another call next night.
      if (draftResult.ok) queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    let metadataOnly = false;
    if (!temporal && row.dream_management === 'synthesize' && candidates.length > 0) {
      const proposed = cleanTemporalProposal(parsed?.temporal, candidates);
      if (proposed.issue) {
        result.pages.push({
          slug: row.slug,
          mode: row.dream_management,
          action: 'rejected',
          splits: [],
          extractions: [],
          merges: [],
          issues: [proposed.issue],
        });
        queueCurateState(state, row.id, inputHash, 'rejected');
        continue;
      }
      if (proposed.metadata) {
        temporal = proposed.metadata;
        temporalSource = 'model';
        eventState = temporalState(temporal, clock);
        archival = eventState === 'past';
        // The first call classified an unmarked page without the archival contract. Persist the
        // boundary alone and let the next fingerprinted pass assess the ended event correctly.
        if (archival) {
          nextBody = body;
          evidence = archivalEvidence(allEvidence);
          inputHash = curateInputHash(
            row,
            evidence,
            conflicts,
            temporal,
            eventState,
            extractionPolicyHash,
            incomingLinkFingerprint(ctx, row.id),
          );
          metadataOnly = true;
        }
      }
    }

    const temporalBase =
      temporal && temporalSource !== 'declared' ? withTemporalMetadata(before, temporal) : before;
    if (temporalBase === null) {
      const issue = 'could not add akno.temporal without reformatting existing frontmatter';
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: [issue],
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const archivalNoop = archival && archiveMeaningKey(body) === archiveMeaningKey(nextBody);
    if (archivalNoop) nextBody = body;

    const maySplit =
      !metadataOnly &&
      !archivalNoop &&
      row.dream_management === 'synthesize' &&
      Buffer.byteLength(before) >= settings.splitAfterBytes;
    const splits = maySplit
      ? cleanSplits(
          parsed?.splits,
          Math.min(settings.maxChildrenPerPage, splitBudget),
          settings.splitSectionBytes,
        )
      : [];
    const extractionResult = cleanExtractions(parsed?.extracts, {
      available: canRequestExtraction && !metadataOnly && !archivalNoop,
      limit: Math.min(1, extractBudget),
      minBytes: settings.extractSectionBytes,
      sourceSlug: row.slug,
      folders: extractionFolders,
      knownSlugs,
      rules: ctx.config.rules,
      sourceBody: body,
    });
    const extractions = extractionResult.extractions;
    if (extractionResult.issues.length > 0) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: extractionResult.issues,
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }
    if (extractions.length > 0) nextBody = withExtractionBridge(body, extractions[0]!);
    const incomingAnchors =
      extractions.length > 0 ? await incomingHeadingAnchors(ctx, row.id, row.slug) : new Set<string>();
    const deterministic = guardRewrite({
      mode: row.dream_management,
      before: body,
      after: nextBody,
      splits,
      extractions,
      conflicts,
      pageSlug: row.slug,
      knownSlugs,
      allowedLinkSlugs: new Set(evidence.map((entry) => entry.slug.toLowerCase())),
      incomingAnchors,
    });
    if (deterministic.length > 0) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: deterministic,
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const verified =
      metadataOnly || archivalNoop || (nextBody === body && splits.length === 0 && extractions.length === 0)
        ? { ok: true, issues: [], cacheable: true }
        : await verifyDraft(
            ctx,
            row,
            body,
            nextBody,
            splits,
            extractions,
            evidence,
            conflicts,
            temporal,
            clock,
            archival,
          );
    if (!verified.ok) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: verified.issues,
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      if (verified.cacheable) queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const children = splits.map((split) => {
      const slug = `${row.slug}/${split.suffix}`;
      return {
        slug,
        relPath: `${slug}.md`,
        content: childPage(split, row.slug),
      };
    });
    const extractedPages = extractions.map((extraction) => ({
      slug: extraction.slug,
      relPath: `${extraction.slug}.md`,
      content: extractionPage(extraction, row.slug),
    }));
    const temporalFm = parseFrontmatter(temporalBase);
    const after = temporalBase.slice(0, temporalFm.bodyOffset) + nextBody;
    if (after === before && children.length === 0 && extractedPages.length === 0) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'unchanged',
        splits: [],
        extractions: [],
        merges: [],
        issues: [],
        ...temporalResult(temporal, temporalSource, clock, archival),
      });
      queueCurateState(state, row.id, inputHash, 'unchanged');
      continue;
    }
    const transformationKind: CurateTransformationKind =
      row.dream_management === 'hygiene'
        ? 'hygiene'
        : extractedPages.length > 0
          ? 'extract'
          : children.length > 0
            ? 'split'
            : 'synthesis';
    if (!allowedKinds.has(transformationKind)) continue;
    staged.push({
      row,
      before,
      after,
      children,
      extractions: extractedPages,
      evidence,
      conflicts,
      inputHash,
      metadataOnly,
    });
    splitBudget -= children.length;
    extractBudget -= extractedPages.length;
    for (const created of [...children, ...extractedPages]) knownSlugs.add(created.slug.toLowerCase());
    result.pages.push({
      slug: row.slug,
      mode: row.dream_management,
      action: options.dryRun ? 'would-update' : 'updated',
      splits: children.map((child) => child.slug),
      extractions: extractedPages.map((page) => page.slug),
      merges: [],
      issues: [],
      ...temporalResult(temporal, temporalSource, clock, archival),
    });
  }

  result.drafts = [
    ...mergeDrafts,
    ...staged.map((stage) => ({
      slug: stage.row.slug,
      mode: stage.row.dream_management,
      relPath: stage.row.rel_path,
      inputHash: stage.inputHash,
      before: stage.before,
      after: stage.after,
      children: stage.children,
      extractions: stage.extractions,
      merge: null,
      evidence: stage.evidence.map((entry) => ({
        slug: entry.slug,
        relPath: entry.rel_path,
        relationship: entry.relationship,
        bodyHash: entry.body_hash,
        contentHash: entry.content_hash,
        summary: entry.relationship === 'about' ? entry.summary : null,
        claims: entry.facts.map((fact) => fact.claim),
        events: entry.events.map((event) => `${event.date}: ${event.summary}`),
      })),
      conflicts: stage.conflicts.map((entry) => ({
        slug: entry.slug,
        subject: entry.subject,
        attribute: entry.attribute,
        claim: entry.claim,
        value: entry.value,
      })),
    })),
  ];

  if (options.dryRun) {
    for (const draft of mergeDrafts) {
      const row = rows.find((candidate) => candidate.slug === draft.slug);
      if (row) queueCurateState(state, row.id, draft.inputHash, 'preview');
    }
    for (const stage of staged) {
      queueCurateState(state, stage.row.id, stage.inputHash, 'preview');
    }
    if (options.recordState) persistCurateState(ctx, state.values());
    return result;
  }
  if (staged.length === 0) {
    if (options.recordState) persistCurateState(ctx, state.values());
    return result;
  }

  for (const stage of staged) {
    const main = await writeFileAtomic(ctx.config.aknoPath, stage.row.rel_path, stage.after);
    result.files.push(fileEntry(main));
    for (const child of stage.children) {
      const written = await writeFileAtomic(ctx.config.aknoPath, child.relPath, child.content);
      result.files.push(fileEntry(written));
    }
    for (const extracted of stage.extractions) {
      const written = await writeFileAtomic(ctx.config.aknoPath, extracted.relPath, extracted.content);
      result.files.push(fileEntry(written));
    }
  }
  result.changeId = ctx.journal.record({
    actor: 'agent',
    op: 'curate',
    summary:
      `curate: ${staged.length} canonical page(s), ${splitLimit - splitBudget} split(s), ` +
      `${extractLimit - extractBudget} extraction(s)`,
    files: result.files,
  });
  const paths = result.files.map((file) => file.relPath);
  await ctx.indexer.run({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);
  const postExtractionPolicyHash = extractionPolicyFingerprint(ctx);
  // The rewrite changes the canonical page's own hash. Record the post-write fingerprint or the
  // curator would interpret its own work as new input on the next cycle. New split children are
  // marked too, so creating one does not immediately enqueue it for another synthesis.
  for (const stage of staged) {
    if (stage.metadataOnly) continue;
    for (const slug of [
      stage.row.slug,
      ...stage.children.map((child) => child.slug),
      ...stage.extractions.map((page) => page.slug),
    ]) {
      const refreshed = pageForSlug(ctx, slug);
      if (!refreshed) continue;
      const temporal = temporalForRow(refreshed);
      const eventState = temporal ? temporalState(temporal, clock) : null;
      const archival = refreshed.dream_management === 'synthesize' && eventState === 'past';
      const allEvidence = refreshed.dream_management === 'synthesize' ? evidenceFor(ctx, refreshed) : [];
      const evidence = archival ? archivalEvidence(allEvidence) : allEvidence;
      const conflicts = refreshed.dream_management === 'synthesize' ? conflictsFor(ctx, refreshed.id) : [];
      queueCurateState(
        state,
        refreshed.id,
        curateInputHash(
          refreshed,
          evidence,
          conflicts,
          temporal,
          eventState,
          postExtractionPolicyHash,
          incomingLinkFingerprint(ctx, refreshed.id),
        ),
        'applied',
      );
    }
  }
  if (options.recordState) persistCurateState(ctx, state.values());
  return result;
}

function discoverMergeCandidates(ctx: AknoContext, rows: PageRow[], folders: string[]): MergeCandidate[] {
  const eligible = rows.filter(
    (row) =>
      pageAllowsMaintenanceTransform(
        ctx.config,
        { slug: row.slug, role: row.role, dreamManagement: row.dream_management },
        'merge',
      ) && mergePathAllowed(row.slug, folders),
  );
  if (eligible.length < 2 || folders.length === 0) return [];
  const identities = new Map<string, PageRow[]>();
  for (const row of eligible) {
    for (const value of [row.slug, row.title]) {
      const key = exactIdentityKey(value);
      const found = identities.get(key) ?? [];
      found.push(row);
      identities.set(key, found);
    }
  }

  const pairs = new Map<string, MergeCandidate>();
  for (const canonical of eligible) {
    for (const alias of storedStrings(canonical.aliases)) {
      const matches = [
        ...new Map(
          (identities.get(exactIdentityKey(alias)) ?? [])
            .filter((row) => row.id !== canonical.id)
            .map((row) => [row.id, row]),
        ).values(),
      ];
      if (matches.length !== 1) continue;
      const duplicate = matches[0]!;
      const pairKey = [canonical.id, duplicate.id].sort().join('|');
      const proposed: MergeCandidate = {
        canonical,
        duplicate,
        identitySignal: `exact alias ${JSON.stringify(alias)} on ${canonical.slug} identifies ${duplicate.slug}`,
      };
      const prior = pairs.get(pairKey);
      if (!prior) {
        pairs.set(pairKey, proposed);
        continue;
      }
      // Reciprocal aliases are equally explicit. Prefer the page with more authored bytes,
      // then a stable slug tie-break, so two consecutive cycles cannot choose opposite sides.
      const preferred = [prior.canonical, proposed.canonical].sort(
        (left, right) => right.bytes - left.bytes || left.slug.localeCompare(right.slug),
      )[0]!;
      if (preferred.id === proposed.canonical.id) {
        pairs.set(pairKey, { ...proposed, identitySignal: `reciprocal exact aliases identify one subject` });
      } else {
        pairs.set(pairKey, { ...prior, identitySignal: `reciprocal exact aliases identify one subject` });
      }
    }
  }

  const selected: MergeCandidate[] = [];
  const occupied = new Set<string>();
  for (const candidate of [...pairs.values()].sort((left, right) =>
    left.canonical.slug.localeCompare(right.canonical.slug),
  )) {
    if (occupied.has(candidate.canonical.id) || occupied.has(candidate.duplicate.id)) continue;
    occupied.add(candidate.canonical.id);
    occupied.add(candidate.duplicate.id);
    selected.push(candidate);
  }
  return selected;
}

function exactIdentityKey(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.(?:md|markdown)$/i, '')
    .normalize('NFKC')
    .toLowerCase();
}

function storedStrings(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

interface PreparedMerge {
  inputHash: string;
  draft: CurateDraft | null;
  issues: string[];
  cacheable: boolean;
}

interface MergeInspection {
  candidate: MergeCandidate;
  canonicalBefore: string;
  duplicateBefore: string;
  canonical: ReturnType<typeof parsePage>;
  duplicate: ReturnType<typeof parsePage>;
  inbound: MergeInboundPage[];
  inputHash: string;
  canonicalWithAliases: string | null;
  issues: string[];
}

async function inspectMergeCandidate(
  ctx: AknoContext,
  candidate: MergeCandidate,
): Promise<MergeInspection | null> {
  const [canonicalBefore, duplicateBefore] = await Promise.all([
    fsp.readFile(path.join(ctx.config.aknoPath, candidate.canonical.rel_path), 'utf8').catch(() => null),
    fsp.readFile(path.join(ctx.config.aknoPath, candidate.duplicate.rel_path), 'utf8').catch(() => null),
  ]);
  if (canonicalBefore === null || duplicateBefore === null) return null;
  const canonical = parsePage(candidate.canonical.rel_path, canonicalBefore);
  const duplicate = parsePage(candidate.duplicate.rel_path, duplicateBefore);
  const conflicts = [
    ...conflictsFor(ctx, candidate.canonical.id),
    ...conflictsFor(ctx, candidate.duplicate.id),
  ];
  const inbound = await mergeInboundPages(ctx, candidate.duplicate);
  const inputHash = mergeInputHash(ctx, candidate, canonicalBefore, duplicateBefore, inbound, conflicts);
  const issues = mergeEligibilityIssues(ctx, candidate, canonical, duplicate, inbound, conflicts);
  if (Buffer.byteLength(canonical.body) + Buffer.byteLength(duplicate.body) > 80_000) {
    issues.push('merge inputs exceed the 80000-byte lossless planning limit');
  }

  const duplicateAliases = storedStrings(candidate.duplicate.aliases);
  const aliasCollision = mergeAliasCollision(ctx, candidate, [
    duplicate.slug,
    duplicate.title,
    ...duplicateAliases,
  ]);
  if (aliasCollision) issues.push(aliasCollision);
  const canonicalWithAliases = withAknoAliases(canonicalBefore, [
    duplicate.slug,
    duplicate.title,
    ...duplicateAliases,
  ]);
  if (canonicalWithAliases === null) {
    issues.push('canonical frontmatter cannot accept aliases without reformatting unknown YAML');
  }
  return {
    candidate,
    canonicalBefore,
    duplicateBefore,
    canonical,
    duplicate,
    inbound,
    inputHash,
    canonicalWithAliases,
    issues: [...new Set(issues)],
  };
}

async function prepareMergeDraft(ctx: AknoContext, inspection: MergeInspection): Promise<PreparedMerge> {
  const {
    candidate,
    canonicalBefore,
    duplicateBefore,
    canonical,
    duplicate,
    inbound,
    inputHash,
    canonicalWithAliases,
    issues,
  } = inspection;
  if (issues.length > 0 || canonicalWithAliases === null) {
    return { inputHash, draft: null, issues, cacheable: true };
  }
  const canonicalPrepared = rewritePageLinks(canonical.body, canonical.slug, duplicate.slug, canonical.slug);
  const duplicatePrepared = rewritePageLinks(
    withoutDuplicateTitle(duplicate.body, duplicate.title),
    duplicate.slug,
    duplicate.slug,
    canonical.slug,
  );
  const planned = await ctx.models.derive.chat(
    [
      { role: 'system', content: MERGE_SYSTEM },
      {
        role: 'user',
        content:
          `Identity signal: ${candidate.identitySignal}\nCanonical slug: ${canonical.slug}\n` +
          `Duplicate slug to retire: ${duplicate.slug}\n\nCanonical body:\n${canonicalPrepared}\n\n` +
          `Prepared duplicate body:\n${duplicatePrepared}`,
      },
    ],
    { schema: MERGE_SCHEMA, maxTokens: 8_000 },
  );
  const parsed = planned.ok && planned.value ? parseJsonLoose<{ body?: unknown }>(planned.value) : null;
  const nextBody = typeof parsed?.body === 'string' ? endWithNewline(parsed.body) : null;
  if (!nextBody) {
    if (planned.ok) ctx.models.derive.reportInvalidResponse();
    return {
      inputHash,
      draft: null,
      issues: [planned.error ?? 'merge planner returned invalid JSON without a body'],
      cacheable: planned.ok,
    };
  }

  const guarded = mergeAccountingIssues(canonicalPrepared, duplicatePrepared, nextBody);
  const incomingAnchors = await incomingHeadingAnchors(ctx, candidate.duplicate.id, duplicate.slug);
  const resultingHeadings = headingReferences(nextBody);
  if ([...incomingAnchors].some((anchor) => !resultingHeadings.has(anchor))) {
    guarded.push('the merge would remove a heading targeted by an incoming link');
  }
  if (guarded.length > 0) {
    return { inputHash, draft: null, issues: [...new Set(guarded)], cacheable: true };
  }

  const aliasFm = parseFrontmatter(canonicalWithAliases);
  const canonicalAfter = canonicalWithAliases.slice(0, aliasFm.bodyOffset) + nextBody;
  const linkUpdates = inbound
    .filter((page) => page.id !== candidate.canonical.id)
    .map((page) => ({
      slug: page.slug,
      relPath: page.relPath,
      before: page.content,
      after: rewritePageLinks(page.content, page.slug, duplicate.slug, canonical.slug),
    }));
  if (linkUpdates.some((update) => update.before === update.after)) {
    return {
      inputHash,
      draft: null,
      issues: ['an indexed inbound link could not be rewritten exactly'],
      cacheable: true,
    };
  }
  const verified = await verifyMergeDraft(
    ctx,
    candidate,
    canonicalPrepared,
    duplicatePrepared,
    canonicalAfter,
    linkUpdates,
  );
  if (!verified.ok) {
    return { inputHash, draft: null, issues: verified.issues, cacheable: verified.cacheable };
  }

  return {
    inputHash,
    issues: [],
    cacheable: true,
    draft: {
      slug: canonical.slug,
      mode: 'synthesize',
      relPath: canonical.relPath,
      inputHash,
      before: canonicalBefore,
      after: canonicalAfter,
      children: [],
      extractions: [],
      merge: {
        sourceSlug: duplicate.slug,
        sourceRelPath: duplicate.relPath,
        sourceBefore: duplicateBefore,
        sourceBodyHash: candidate.duplicate.body_hash,
        identitySignal: candidate.identitySignal,
        linkUpdates,
      },
      evidence: [],
      conflicts: [],
    },
  };
}

async function mergeInboundPages(ctx: AknoContext, duplicate: PageRow): Promise<MergeInboundPage[]> {
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.id, p.slug, p.rel_path, p.role, p.dream_management, p.body_hash
       FROM links l JOIN pages p ON p.id = l.from_page
       WHERE lower(l.to_slug) = lower(?) AND l.from_page != ? AND l.kind != 'embed'
       ORDER BY p.slug`,
    )
    .all(duplicate.slug, duplicate.id) as {
    id: string;
    slug: string;
    rel_path: string;
    role: string;
    dream_management: string;
    body_hash: string;
  }[];
  const pages: MergeInboundPage[] = [];
  for (const row of rows) {
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (content === null) continue;
    pages.push({
      id: row.id,
      slug: row.slug,
      relPath: row.rel_path,
      role: row.role,
      dreamManagement: row.dream_management,
      bodyHash: row.body_hash,
      content,
    });
  }
  return pages;
}

function mergeEligibilityIssues(
  ctx: AknoContext,
  candidate: MergeCandidate,
  canonical: ReturnType<typeof parsePage>,
  duplicate: ReturnType<typeof parsePage>,
  inbound: MergeInboundPage[],
  conflicts: ConflictEvidence[],
): string[] {
  const issues: string[] = [];
  if (
    canonical.declaredManagement.dream !== 'synthesize' ||
    duplicate.declaredManagement.dream !== 'synthesize'
  ) {
    issues.push('both merge pages must explicitly declare dream: synthesize');
  }
  if (canonical.declaredRole && canonical.declaredRole !== 'knowledge') {
    issues.push('the canonical merge page is not declared as knowledge');
  }
  if (duplicate.declaredRole && duplicate.declaredRole !== 'knowledge') {
    issues.push('the duplicate merge page is not declared as knowledge');
  }
  if (canonical.about.includes(duplicate.slug) || duplicate.about.includes(canonical.slug)) {
    issues.push('parent/child pages cannot be merged as duplicate identities');
  }
  if (conflicts.length > 0) issues.push('unresolved conflicts must be handled before these pages can merge');
  const documents = ctx.store.db
    .prepare('SELECT count(*) AS n FROM documents WHERE page_id = ?')
    .get(candidate.duplicate.id) as { n: number };
  if (documents.n > 0) issues.push('the duplicate owns documents whose canonical ownership is unresolved');
  for (const page of inbound) {
    if (page.id === candidate.canonical.id) continue;
    if (page.role !== 'knowledge' || page.dreamManagement !== 'synthesize') {
      issues.push(`inbound link page ${page.slug} is not opted in to synthesis link updates`);
      continue;
    }
    const parsed = parsePage(page.relPath, page.content);
    if (parsed.declaredManagement.dream !== 'synthesize') {
      issues.push(`inbound link page ${page.slug} does not explicitly permit synthesis writes`);
    }
  }
  issues.push(...mergeFrontmatterIssues(canonical.frontmatter.data, duplicate.frontmatter.data));
  return issues;
}

function mergeFrontmatterIssues(
  canonical: Record<string, unknown>,
  duplicate: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  for (const [key, value] of Object.entries(duplicate)) {
    if (key === 'title' || key === 'id' || key === 'akno') continue;
    if (JSON.stringify(canonical[key]) !== JSON.stringify(value)) {
      issues.push(`duplicate frontmatter key ${key} has no lossless canonical disposition`);
    }
  }
  const canonicalAkno = objectValue(canonical.akno);
  const duplicateAkno = objectValue(duplicate.akno);
  for (const [key, value] of Object.entries(duplicateAkno)) {
    if (key === 'aliases' || key === 'role') continue;
    if (key === 'about') {
      const canonicalAbout = new Set(stringArray(canonicalAkno.about));
      if (stringArray(value).some((entry) => !canonicalAbout.has(entry))) {
        issues.push('duplicate about relationships have no lossless canonical disposition');
      }
      continue;
    }
    if (JSON.stringify(canonicalAkno[key]) !== JSON.stringify(value)) {
      issues.push(`duplicate akno.${key} metadata differs from the canonical page`);
    }
  }
  return issues;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mergeAliasCollision(ctx: AknoContext, candidate: MergeCandidate, aliases: string[]): string | null {
  const other = ctx.store.db
    .prepare('SELECT slug, title FROM pages WHERE id NOT IN (?, ?)')
    .all(candidate.canonical.id, candidate.duplicate.id) as { slug: string; title: string }[];
  const occupied = new Set(other.flatMap((row) => [exactIdentityKey(row.slug), exactIdentityKey(row.title)]));
  const collision = aliases.find((alias) => occupied.has(exactIdentityKey(alias)));
  return collision ? `retired identity ${JSON.stringify(collision)} also identifies another page` : null;
}

function mergeInputHash(
  ctx: AknoContext,
  candidate: MergeCandidate,
  canonicalBefore: string,
  duplicateBefore: string,
  inbound: MergeInboundPage[],
  conflicts: ConflictEvidence[],
): string {
  const documents = ctx.store.db
    .prepare('SELECT rel_path, sha256 FROM documents WHERE page_id = ? ORDER BY rel_path')
    .all(candidate.duplicate.id);
  const retiredKeys = new Set(
    [candidate.duplicate.slug, candidate.duplicate.title, ...storedStrings(candidate.duplicate.aliases)].map(
      exactIdentityKey,
    ),
  );
  const identityCollisions = (
    ctx.store.db
      .prepare('SELECT id, slug, title FROM pages WHERE id NOT IN (?, ?) ORDER BY slug')
      .all(candidate.canonical.id, candidate.duplicate.id) as { id: string; slug: string; title: string }[]
  ).filter(
    (row) => retiredKeys.has(exactIdentityKey(row.slug)) || retiredKeys.has(exactIdentityKey(row.title)),
  );
  return sha256(
    JSON.stringify({
      version: CURATE_FINGERPRINT_VERSION,
      kind: 'merge',
      canonical: { slug: candidate.canonical.slug, hash: sha256(canonicalBefore) },
      duplicate: { slug: candidate.duplicate.slug, hash: sha256(duplicateBefore) },
      identitySignal: candidate.identitySignal,
      inbound: inbound.map((page) => ({
        slug: page.slug,
        hash: sha256(page.content),
        role: page.role,
        dreamManagement: page.dreamManagement,
      })),
      documents,
      identityCollisions,
      conflicts,
      policy: {
        maxMerges: ctx.config.maintenance.curate.maxMerges,
        mergeFolders: ctx.config.maintenance.curate.mergeFolders,
      },
    }),
  );
}

function withoutDuplicateTitle(body: string, title: string): string {
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  const index = lines.findIndex((line) => line.trim().length > 0);
  if (index < 0) return body;
  const heading = /^#\s+(.+?)\s*#*\s*$/.exec(lines[index]!);
  if (!heading || exactIdentityKey(heading[1]!) !== exactIdentityKey(title)) return body;
  lines.splice(index, 1);
  while (lines[0] === '') lines.shift();
  return endWithNewline(lines.join('\n'));
}

function rewritePageLinks(text: string, fromPage: string, retired: string, canonical: string): string {
  const wiki = text.replace(/\[\[([^\]|#]+)((?:#[^\]|]+)?(?:\|[^\]]+)?)\]\]/g, (whole, target, suffix) => {
    return normalizeLinkTarget(String(target), fromPage).toLowerCase() === retired.toLowerCase()
      ? `[[${canonical}${String(suffix)}]]`
      : whole;
  });
  return wiki.replace(
    /(?<!!)\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(\s+[^)]*)?\)/g,
    (whole, label, href, titlePart) => {
      const value = String(href);
      const hash = value.indexOf('#');
      const target = hash >= 0 ? value.slice(0, hash) : value;
      const fragment = hash >= 0 ? value.slice(hash) : '';
      if (normalizeLinkTarget(target, fromPage).toLowerCase() !== retired.toLowerCase()) return whole;
      return `[${String(label)}](${canonical}.md${fragment}${String(titlePart ?? '')})`;
    },
  );
}

function mergeAccountingIssues(canonical: string, duplicate: string, after: string): string[] {
  const expected = nonBlankLineCounts(canonical);
  for (const [line, count] of nonBlankLineCounts(duplicate)) {
    expected.set(line, Math.max(expected.get(line) ?? 0, count));
  }
  const actual = nonBlankLineCounts(after);
  const issues: string[] = [];
  for (const [line, count] of expected) {
    if ((actual.get(line) ?? 0) !== count) {
      issues.push('merge did not preserve every unique authored line exactly once');
      break;
    }
  }
  if ([...actual].some(([line, count]) => !expected.has(line) || count !== expected.get(line))) {
    issues.push('merge body contains text that was not present in either source page');
  }
  const afterLines = nonBlankLines(after);
  if (
    !lineSubsequence(nonBlankLines(canonical), afterLines) ||
    !lineSubsequence(nonBlankLines(duplicate), afterLines)
  ) {
    issues.push('merge changed the authored line order inside a source page');
  }
  for (const [marker, knowledge] of [...markerAttachments(canonical), ...markerAttachments(duplicate)]) {
    const markerIndex = afterLines.indexOf(marker);
    if (markerIndex < 0 || afterLines[markerIndex + 1] !== knowledge) {
      issues.push('merge detached a stable item marker from its authored knowledge');
      break;
    }
  }
  if (firstH1(after) !== firstH1(canonical)) {
    issues.push('merge changed the canonical page title heading');
  }
  return [...new Set(issues)];
}

function nonBlankLines(value: string): string[] {
  return value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function lineSubsequence(source: string[], combined: string[]): boolean {
  let at = 0;
  for (const line of source) {
    while (at < combined.length && combined[at] !== line) at++;
    if (at >= combined.length) return false;
    at++;
  }
  return true;
}

function markerAttachments(value: string): [string, string][] {
  const lines = nonBlankLines(value);
  const pairs: [string, string][] = [];
  for (let index = 0; index < lines.length - 1; index++) {
    if (AKNO_ITEM.test(lines[index]!)) pairs.push([lines[index]!, lines[index + 1]!]);
  }
  return pairs;
}

async function verifyMergeDraft(
  ctx: AknoContext,
  candidate: MergeCandidate,
  canonicalBody: string,
  duplicateBody: string,
  canonicalAfter: string,
  linkUpdates: { slug: string; relPath: string; before: string; after: string }[],
): Promise<{ ok: boolean; issues: string[]; cacheable: boolean }> {
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: VERIFY_MERGE_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          identity: candidate.identitySignal,
          canonical: { slug: candidate.canonical.slug, before: canonicalBody, after: canonicalAfter },
          duplicate: { slug: candidate.duplicate.slug, body: duplicateBody, operation: 'delete' },
          inboundLinkUpdates: linkUpdates,
        }).slice(0, 100_000),
      },
    ],
    { schema: VERIFY_SCHEMA, maxTokens: 1_200 },
  );
  const parsed =
    result.ok && result.value ? parseJsonLoose<{ ok?: unknown; issues?: unknown }>(result.value) : null;
  const validIssues =
    Array.isArray(parsed?.issues) && parsed.issues.every((issue) => typeof issue === 'string');
  if (parsed?.ok === true && validIssues) return { ok: true, issues: [], cacheable: true };
  if (parsed?.ok === false && validIssues) {
    const issues = parsed.issues as string[];
    return {
      ok: false,
      issues: issues.length > 0 ? issues : ['merge verifier rejected draft'],
      cacheable: true,
    };
  }
  if (result.ok) ctx.models.derive.reportInvalidResponse();
  return {
    ok: false,
    issues: [result.error ?? 'merge verifier returned invalid JSON'],
    cacheable: result.ok,
  };
}

function evidenceFor(ctx: AknoContext, page: PageRow): EvidencePage[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.id, p.slug, p.rel_path, p.summary, p.about, p.role, p.body_hash,
          indexed_file.sha256 AS content_hash,
          EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id) AS outbound,
          EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?) AS backlink
        FROM pages p JOIN files indexed_file ON indexed_file.rel_path = p.rel_path
        WHERE p.id != ? AND (
          EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?)
          OR EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id)
          OR p.about LIKE ?
        ) ORDER BY p.slug COLLATE NOCASE LIMIT 30`,
    )
    .all(page.id, page.id, page.id, page.id, page.id, `%${JSON.stringify(page.slug).slice(1, -1)}%`) as (Omit<
    EvidencePage,
    'facts' | 'relationship'
  > & { outbound: number; backlink: number })[];
  const facts = ctx.store.db.prepare(
    `SELECT claim, subject, attribute, value, item_id FROM facts
      WHERE page_id = ? AND valid_to IS NULL
      ORDER BY line_start, id LIMIT 50`,
  );
  const events = ctx.store.db.prepare(
    `SELECT date, summary FROM events
      WHERE source_page = ? AND target_slug = ?
      ORDER BY date DESC, line LIMIT 50`,
  );
  return rows.map((row) => {
    const relationship = pageRelationship(row, page.slug);
    const allFacts = facts.all(row.id) as EvidenceFact[];
    return {
      ...row,
      relationship,
      events: events.all(row.id, page.slug) as { date: string; summary: string }[],
      facts:
        relationship === 'about'
          ? allFacts
          : relationship === 'backlink'
            ? allFacts.filter((fact) => factMentionsPage(fact, page))
            : [],
    };
  });
}

/** Ended events wake only for evidence that explicitly contributes to or records the event. */
function archivalEvidence(evidence: EvidencePage[]): EvidencePage[] {
  return evidence.filter(
    (row) => row.relationship === 'about' || row.facts.length > 0 || row.events.length > 0,
  );
}

function pageRelationship(
  row: { about: string; outbound: number; backlink: number },
  canonicalSlug: string,
): EvidencePage['relationship'] {
  try {
    const about = JSON.parse(row.about) as unknown;
    if (
      Array.isArray(about) &&
      about.some((entry) => typeof entry === 'string' && normalizeLinkTarget(entry) === canonicalSlug)
    ) {
      return 'about';
    }
  } catch {
    // Indexed policy JSON is generated by Akno; an unparseable row degrades to link relevance.
  }
  return row.outbound ? 'outbound' : 'backlink';
}

function factMentionsPage(fact: EvidenceFact, page: PageRow): boolean {
  const keys = [page.title, page.slug.split('/').at(-1)?.replaceAll('-', ' ') ?? '']
    .map(searchIdentity)
    .filter((value) => value.length >= 4);
  const text = searchIdentity(
    [fact.subject, fact.attribute, fact.claim, fact.value].filter(Boolean).join(' '),
  );
  return keys.some((key) => text.includes(key));
}

function searchIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function conflictsFor(ctx: AknoContext, pageId: string): ConflictEvidence[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT f.subject, f.attribute, f.claim, f.value, p.slug FROM facts f
        JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL AND f.subject IS NOT NULL AND f.attribute IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM facts other
             WHERE other.valid_to IS NULL AND other.page_id != f.page_id
               AND lower(other.subject) = lower(f.subject)
               AND lower(other.attribute) = lower(f.attribute)
               AND other.value != f.value
          )
          AND (f.page_id = ? OR p.about LIKE (SELECT '%' || slug || '%' FROM pages WHERE id = ?))
        ORDER BY p.slug COLLATE NOCASE, f.subject COLLATE NOCASE, f.attribute COLLATE NOCASE, f.claim
        LIMIT 20`,
    )
    .all(pageId, pageId) as ConflictEvidence[];
  return rows;
}

async function verifyDraft(
  ctx: AknoContext,
  page: PageRow,
  before: string,
  after: string,
  splits: SplitDraft[],
  extractions: ExtractionDraft[],
  evidence: EvidencePage[],
  conflicts: ConflictEvidence[],
  temporal: TemporalMetadata | null,
  clock: TemporalClock,
  archival: boolean,
): Promise<{ ok: boolean; issues: string[]; cacheable: boolean }> {
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: VERIFY_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          mode: page.dream_management,
          before,
          after,
          splits,
          extracts: extractions.map((extraction) => ({
            slug: extraction.slug,
            title: extraction.title,
            sourceHeading: extraction.sourceHeading,
            bridge: extraction.bridge,
            body: extractionPageBody(extraction, page.slug),
          })),
          evidence,
          conflicts,
          time: temporalPrompt(temporal, clock),
          archival,
        }).slice(0, 100_000),
      },
    ],
    { schema: VERIFY_SCHEMA, maxTokens: 1_200 },
  );
  if (!result.ok || !result.value) {
    return { ok: false, issues: [result.error ?? 'verification failed'], cacheable: false };
  }
  const parsed = parseJsonLoose<{ ok?: unknown; issues?: unknown }>(result.value);
  if (
    !parsed ||
    typeof parsed.ok !== 'boolean' ||
    !Array.isArray(parsed.issues) ||
    !parsed.issues.every((issue) => typeof issue === 'string')
  ) {
    ctx.models.derive.reportInvalidResponse();
    return { ok: false, issues: ['verifier returned invalid JSON'], cacheable: true };
  }
  const issues = (parsed.issues as string[]).slice(0, 12);
  return {
    ok: parsed?.ok === true && issues.length === 0,
    issues: issues.length ? issues : ['verifier rejected rewrite'],
    cacheable: true,
  };
}

function guardRewrite(input: {
  mode: 'hygiene' | 'synthesize';
  before: string;
  after: string;
  splits: SplitDraft[];
  extractions: ExtractionDraft[];
  conflicts: ConflictEvidence[];
  pageSlug: string;
  knownSlugs: Set<string>;
  allowedLinkSlugs: Set<string>;
  incomingAnchors: Set<string>;
}): string[] {
  const issues: string[] = [];
  const combined = [
    input.after,
    ...input.splits.map((split) => split.body),
    ...input.extractions.map((extraction) => extractionPageBody(extraction, input.pageSlug)),
  ].join('\n');
  const beforeItems = itemIds(input.before);
  const afterItems = itemIds(combined);
  if (beforeItems.size !== afterItems.size || [...beforeItems].some((id) => !afterItems.has(id))) {
    issues.push('stable item markers were lost, duplicated or changed');
  }
  const missingValues = missingNumericValues(input.before, combined);
  if (missingValues.length > 0) {
    const shown = missingValues.slice(0, 12).map((value) => JSON.stringify(value));
    const remainder = missingValues.length - shown.length;
    issues.push(
      `numeric/date/value tokens missing from rewrite: ${shown.join(', ')}` +
        (remainder > 0 ? ` (+${remainder} more)` : ''),
    );
    issues.push(...missingValueContexts(input.before, missingValues));
  }
  issues.push(
    ...linkIssues(
      input.before,
      combined,
      input.pageSlug,
      input.splits,
      input.extractions,
      input.knownSlugs,
      input.allowedLinkSlugs,
    ),
  );
  if (input.mode === 'hygiene') {
    const beforeH1 = firstH1(input.before);
    const afterH1 = firstH1(input.after);
    if (beforeH1 !== afterH1) issues.push('the page title/top-level heading changed');
    const ratio = input.after.length / Math.max(1, input.before.length);
    if (ratio < 0.6 || ratio > 1.4) issues.push('the hygiene rewrite changed the page size too drastically');
    if (input.splits.length > 0) issues.push('hygiene pages cannot split');
    if (input.extractions.length > 0) issues.push('hygiene pages cannot extract');
  }
  if (input.splits.length > 0 && input.extractions.length > 0) {
    issues.push('one curation item cannot split and extract at the same time');
  }
  if (input.extractions.length > 0) {
    issues.push(
      ...extractionAccountingIssues(input.before, input.after, input.extractions, input.incomingAnchors),
    );
  }
  if (
    input.mode === 'synthesize' &&
    input.after !== input.before &&
    input.splits.length === 0 &&
    input.extractions.length === 0 &&
    !hasMaterialSynthesisChange(input.before, input.after, input.pageSlug)
  ) {
    issues.push('synthesis rewrite is cosmetic or organizational; no material knowledge was added');
  }
  if (input.mode === 'synthesize' && input.conflicts.length > 0 && !/^##\s+Unresolved\s*$/im.test(combined)) {
    issues.push('known conflicts are not preserved under an Unresolved section');
  }
  for (const split of input.splits) {
    const target = `${input.pageSlug}/${split.suffix}`.toLowerCase();
    if (input.knownSlugs.has(target)) issues.push(`split target already exists: ${target}`);
  }
  for (const extraction of input.extractions) {
    if (input.knownSlugs.has(extraction.slug.toLowerCase())) {
      issues.push(`extraction target already exists: ${extraction.slug}`);
    }
  }
  if (
    input.mode === 'synthesize' &&
    input.conflicts.length === 0 &&
    !/^##\s+Unresolved\s*$/im.test(input.before) &&
    /^##\s+Unresolved\s*$/im.test(combined)
  ) {
    issues.push('an Unresolved section was added even though no unresolved conflict was supplied');
  }
  return issues;
}

/**
 * Synthesis exists to integrate knowledge, not to spend a high-risk transaction on prose churn.
 * Headings and Markdown decoration are deliberately ignored: changing "Highlights" to "History
 * and highlights" must not count as new knowledge. A new evidence-backed wikilink is material by
 * itself; otherwise the rewrite needs at least two new content terms. The model verifier and
 * independent curator still decide whether those terms are actually supported and useful.
 */
function hasMaterialSynthesisChange(before: string, after: string, pageSlug: string): boolean {
  const priorLinks = linkTargets(before, pageSlug).wiki;
  const nextLinks = linkTargets(after, pageSlug).wiki;
  if ([...nextLinks].some((target) => !priorLinks.has(target))) return true;

  const priorTerms = synthesisTerms(before);
  const nextTerms = synthesisTerms(after);
  let added = 0;
  for (const term of nextTerms) {
    if (!priorTerms.has(term) && ++added >= 2) return true;
  }
  return false;
}

function synthesisTerms(body: string): Set<string> {
  const prose = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split('\n')
    .filter((line) => !/^\s{0,3}#{1,6}\s+/.test(line))
    .join('\n')
    // Link targets are evaluated separately. Keeping them here would let a path rename masquerade
    // as a factual addition; visible Markdown-link labels remain ordinary prose.
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .normalize('NFKC')
    .toLowerCase();
  return new Set(prose.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? []);
}

function missingValueContexts(body: string, values: string[]): string[] {
  const lines = body.split('\n');
  const contexts: string[] = [];
  for (const value of values.slice(0, 6)) {
    const index = lines.findIndex((line) => line.includes(value));
    if (index < 0) continue;
    const source = lines[index]!.trim().replace(/\s+/g, ' ');
    contexts.push(
      `source body line ${index + 1} for ${JSON.stringify(value)}: ${source.length > 240 ? `${source.slice(0, 237)}...` : source}`,
    );
  }
  return contexts;
}

/** Blank-line cleanup is useful hygiene, but it is not a substantive post-event discovery. */
function archiveMeaningKey(body: string): string {
  return body
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .join('\n');
}

interface LinkTargets {
  wiki: Set<string>;
  markdown: Set<string>;
}

function linkIssues(
  before: string,
  after: string,
  pageSlug: string,
  splits: SplitDraft[],
  extractions: ExtractionDraft[],
  knownSlugs: Set<string>,
  allowedLinkSlugs: Set<string>,
): string[] {
  const issues: string[] = [];
  const prior = linkTargets(before, pageSlug);
  const next = linkTargets(after, pageSlug);
  for (const target of prior.wiki) {
    if (!next.wiki.has(target)) issues.push(`existing wikilink target was removed or changed: [[${target}]]`);
  }
  for (const target of prior.markdown) {
    if (!next.markdown.has(target))
      issues.push(`existing Markdown link target was removed or changed: ${target}`);
  }
  for (const target of next.markdown) {
    if (prior.markdown.has(target)) continue;
    issues.push(
      externalLink(target)
        ? `new external URL was invented instead of supplied by evidence: ${target}`
        : `new internal Markdown link target is not allowed; use an exact wikilink slug: ${target}`,
    );
  }
  const proposed = new Set([
    ...splits.map((split) => `${pageSlug}/${split.suffix}`.toLowerCase()),
    ...extractions.map((extraction) => extraction.slug.toLowerCase()),
  ]);
  for (const target of next.wiki) {
    if (prior.wiki.has(target)) continue;
    if (!knownSlugs.has(target) && !proposed.has(target)) {
      issues.push(`new wikilink does not resolve to an existing or proposed page: [[${target}]]`);
    } else if (!allowedLinkSlugs.has(target) && !proposed.has(target) && target !== pageSlug.toLowerCase()) {
      issues.push(`new wikilink target was not supplied by the evidence graph: [[${target}]]`);
    }
  }
  return issues;
}

function linkTargets(body: string, pageSlug: string): LinkTargets {
  const wiki = new Set<string>();
  const markdown = new Set<string>();
  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    wiki.add(normalizeLinkTarget(match[1]!).toLowerCase());
  }
  for (const match of body.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+[^)]*)?\)/g)) {
    const target = match[1]!;
    markdown.add(
      externalLink(target) || target.startsWith('#') ? target : normalizeLinkTarget(target, pageSlug),
    );
  }
  return { wiki, markdown };
}

function externalLink(target: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

export function linkIssuesForTesting(
  before: string,
  after: string,
  pageSlug: string,
  knownSlugs: string[],
): string[] {
  const known = new Set(knownSlugs.map((slug) => slug.toLowerCase()));
  return linkIssues(before, after, pageSlug, [], [], known, known);
}

function renderEvidence(evidence: EvidencePage[]): string[] {
  return evidence.map((row) => {
    const summary = row.relationship === 'about' && row.summary ? ` — ${row.summary}` : '';
    const heading = `[[${row.slug}]] (${row.relationship})${summary}`;
    const details = [
      ...row.facts.map((fact) => `- ${fact.claim}`),
      ...row.events.map((event) => `- ${event.date}: ${event.summary}`),
    ];
    return details.length ? `${heading}\n${details.join('\n')}` : heading;
  });
}

function renderConflicts(conflicts: ConflictEvidence[]): string[] {
  return conflicts.map((row) => `${row.subject} / ${row.attribute}: ${row.claim} [[${row.slug}]]`);
}

function temporalForRow(page: PageRow): TemporalMetadata | null {
  try {
    const frontmatter = JSON.parse(page.frontmatter) as unknown;
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) return null;
    return readTemporalDeclaration(frontmatter as Record<string, unknown>).metadata;
  } catch {
    return null;
  }
}

function temporalResult(
  metadata: TemporalMetadata | null,
  source: 'declared' | 'inferred' | 'model' | null,
  clock: TemporalClock,
  archival: boolean,
): Pick<CuratedPage, 'temporal'> | Record<string, never> {
  return metadata && source
    ? {
        temporal: {
          source,
          state: temporalState(metadata, clock),
          until: metadata.until,
          archival,
        },
      }
    : {};
}

function curateInputHash(
  page: PageRow,
  evidence: EvidencePage[],
  conflicts: ConflictEvidence[],
  temporal: TemporalMetadata | null,
  eventState: 'active' | 'past' | null,
  extractionPolicyHash: string,
  incomingLinksFingerprint: string,
): string {
  return sha256(
    JSON.stringify({
      version: CURATE_FINGERPRINT_VERSION,
      page: {
        slug: page.slug,
        title: page.title,
        role: page.role,
        mode: page.dream_management,
        about: page.about,
        frontmatter: page.frontmatter,
        bodyHash: page.body_hash,
      },
      // Hygiene deliberately has empty arrays here: its authority is confined to this page.
      evidence: evidence.map((row) => ({
        slug: row.slug,
        summary: row.relationship === 'about' ? row.summary : null,
        about: row.about,
        role: row.role,
        bodyHash: row.body_hash,
        relationship: row.relationship,
        facts: row.facts,
        events: row.events,
      })),
      conflicts,
      temporal,
      // Unlike the current date, this changes only once for a bounded event. It schedules one
      // archival assessment without making every page stale every day.
      eventState,
      extractionPolicyHash: page.dream_management === 'synthesize' ? extractionPolicyHash : null,
      incomingLinksFingerprint: page.dream_management === 'synthesize' ? incomingLinksFingerprint : null,
    }),
  );
}

function incomingLinkFingerprint(ctx: AknoContext, pageId: string): string {
  const rows = ctx.store.db
    .prepare(
      `SELECT p.slug, p.body_hash, l.kind, l.line FROM links l
       JOIN pages p ON p.id = l.from_page
       WHERE l.to_page = ? AND l.from_page != ?
       ORDER BY p.slug, l.kind, l.line`,
    )
    .all(pageId, pageId);
  return sha256(JSON.stringify(rows));
}

function curationDue(page: PageRow, inputHash: string, dryRun: boolean, includePreviewed: boolean): boolean {
  if (page.curate_input_hash !== inputHash) return true;
  if (includePreviewed && page.curate_status === 'preview') return true;
  // A write-enabled pass must rerun a previously accepted preview once. Rejected and unchanged
  // inputs are already complete decisions, and applied input is current by definition.
  return !dryRun && page.curate_status === 'preview';
}

/** Mark successfully plan-applied pages against their post-write fingerprints. */
export function markCurateApplied(ctx: AknoContext, slugs: Iterable<string>): void {
  const state = new Map<string, CurateState>();
  const clock = temporalClock();
  const extractionPolicyHash = extractionPolicyFingerprint(ctx);
  for (const slug of slugs) {
    const refreshed = pageForSlug(ctx, slug);
    if (!refreshed) continue;
    const temporal = temporalForRow(refreshed);
    const eventState = temporal ? temporalState(temporal, clock) : null;
    const archival = refreshed.dream_management === 'synthesize' && eventState === 'past';
    const allEvidence = refreshed.dream_management === 'synthesize' ? evidenceFor(ctx, refreshed) : [];
    const evidence = archival ? archivalEvidence(allEvidence) : allEvidence;
    const conflicts = refreshed.dream_management === 'synthesize' ? conflictsFor(ctx, refreshed.id) : [];
    queueCurateState(
      state,
      refreshed.id,
      curateInputHash(
        refreshed,
        evidence,
        conflicts,
        temporal,
        eventState,
        extractionPolicyHash,
        incomingLinkFingerprint(ctx, refreshed.id),
      ),
      'applied',
    );
  }
  persistCurateState(ctx, state.values());
}

/** Cache a completed plan decision so the same rejected input is not proposed every cycle. */
export function markCurateRejected(
  ctx: AknoContext,
  pages: Iterable<{ slug: string; inputHash: string }>,
): void {
  const state = new Map<string, CurateState>();
  for (const page of pages) {
    const row = pageForSlug(ctx, page.slug);
    if (row) queueCurateState(state, row.id, page.inputHash, 'rejected');
  }
  persistCurateState(ctx, state.values());
}

function queueCurateState(
  state: Map<string, CurateState>,
  pageId: string,
  inputHash: string,
  status: CurateStatus,
): void {
  state.set(pageId, { pageId, inputHash, status });
}

function persistCurateState(ctx: AknoContext, values: Iterable<CurateState>): void {
  const rows = [...values];
  if (rows.length === 0) return;
  const update = ctx.store.db.prepare(
    `UPDATE pages SET curate_input_hash = ?, curate_status = ?, curated_at = ? WHERE id = ?`,
  );
  const now = new Date().toISOString();
  ctx.store.transaction(() => {
    for (const row of rows) update.run(row.inputHash, row.status, now, row.pageId);
  });
}

function pageForSlug(ctx: AknoContext, slug: string): PageRow | null {
  return (
    (ctx.store.db
      .prepare(
        `SELECT id, slug, rel_path, title, role, dream_management, about, frontmatter, aliases, body_hash, bytes,
                curate_input_hash, curate_status
           FROM pages WHERE slug = ? AND role = 'knowledge'
             AND dream_management IN ('hygiene', 'synthesize')`,
      )
      .get(slug) as PageRow | undefined) ?? null
  );
}

function itemIds(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of text.split('\n')) {
    const match = AKNO_ITEM.exec(line);
    if (match) {
      const id = match[1]!.trim().split(/\s+/)[0]!;
      if (out.has(id)) out.add(`duplicate:${id}`);
      else out.add(id);
    }
  }
  return out;
}

function firstH1(body: string): string | null {
  return (
    body
      .split('\n')
      .map((line) => /^#\s+(.+?)\s*$/.exec(line)?.[1] ?? null)
      .find(Boolean) ?? null
  );
}

function cleanSplits(value: unknown, limit: number, minBytes: number): SplitDraft[] {
  if (!Array.isArray(value) || limit <= 0) return [];
  const out: SplitDraft[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const suffix = typeof row.suffix === 'string' ? row.suffix.trim().toLowerCase() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const body = typeof row.body === 'string' ? endWithNewline(row.body) : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix) || !title || Buffer.byteLength(body) < minBytes) continue;
    out.push({ suffix, title, body });
    if (out.length >= limit) break;
  }
  return out;
}

function allowedExtractionFolders(ctx: AknoContext): FolderCatalogEntry[] {
  return (
    folderCatalog(ctx.config, ctx.store)
      .filter(
        (entry) =>
          entry.eligible &&
          entry.role === 'knowledge' &&
          entry.remember === 'integrate' &&
          entry.path.length > 0,
      )
      // A bounded taxonomy keeps a large knowledge base from crowding the page and evidence out of
      // the model context. The same exact list is used by the deterministic destination guard.
      .slice(0, 120)
  );
}

function extractionPolicyFingerprint(ctx: AknoContext, folders = allowedExtractionFolders(ctx)): string {
  const settings = ctx.config.maintenance.curate;
  return sha256(
    JSON.stringify({
      folders,
      maxExtracts: settings.maxExtracts,
      extractAfterBytes: settings.extractAfterBytes,
      extractSectionBytes: settings.extractSectionBytes,
      policies: ctx.config.maintenance.policies,
    }),
  );
}

/** Re-check a sealed extraction against the current user-owned taxonomy before any write. */
export function extractionDestinationIssues(
  ctx: AknoContext,
  sourceSlug: string,
  targetSlug: string,
): string[] {
  const slash = targetSlug.lastIndexOf('/');
  const parent = slash > 0 ? targetSlug.slice(0, slash) : '';
  const allowed = allowedExtractionFolders(ctx).some(
    (entry) => entry.path.toLowerCase() === parent.toLowerCase(),
  );
  const issues = allowed
    ? destinationRuleIssues(targetSlug, ctx.config.rules)
    : [`extraction destination is no longer an allowed knowledge folder: ${parent || '(root)'}`];
  if (targetSlug.toLowerCase().startsWith(`${sourceSlug.toLowerCase()}/`)) {
    issues.push('extraction destination became a child of the source; use a split instead');
  }
  return issues;
}

function extractionPrompt(folders: FolderCatalogEntry[], sections: ExtractionSection[]): string {
  if (folders.length === 0 || sections.length === 0) {
    return '\n\nNo exact extraction section and destination are available for this item. Return "extracts": [].';
  }
  return (
    '\n\nAllowed extraction destination folders (use one exact path as the parent):\n' +
    JSON.stringify(
      folders.map((entry) => ({
        path: entry.path,
        ...(entry.description ? { purpose: entry.description } : {}),
      })),
    ) +
    '\nEligible extraction sections (copy one exact heading into source_heading):\n' +
    JSON.stringify(
      sections.map((section) => ({
        source_heading: section.heading,
        bytes: Buffer.byteLength(section.body),
      })),
    )
  );
}

function extractionSections(sourceBody: string, minBytes: number): ExtractionSection[] {
  const newline = sourceBody.includes('\r\n') ? '\r\n' : '\n';
  const lines = sourceBody.split(newline);
  const headings = lines.flatMap((line, index) => {
    const match = /^(\s{0,3})(#{2,6})\s+(.+?)\s*#*\s*$/.exec(line);
    return match ? [{ heading: line.trimEnd(), level: match[2]!.length, index }] : [];
  });
  const counts = new Map<string, number>();
  for (const heading of headings) counts.set(heading.heading, (counts.get(heading.heading) ?? 0) + 1);

  const sections: ExtractionSection[] = [];
  for (const [position, heading] of headings.entries()) {
    if (counts.get(heading.heading) !== 1) continue;
    const next = headings.slice(position + 1).find((candidate) => candidate.level <= heading.level);
    const endIndex = next?.index ?? lines.length;
    const body = `${lines.slice(heading.index, endIndex).join(newline).trimEnd()}${newline}`;
    if (Buffer.byteLength(body) < minBytes) continue;
    sections.push({
      heading: heading.heading,
      body,
      startIndex: heading.index,
      endIndex,
    });
  }
  return sections;
}

function cleanExtractions(
  value: unknown,
  options: {
    available: boolean;
    limit: number;
    minBytes: number;
    sourceSlug: string;
    folders: FolderCatalogEntry[];
    knownSlugs: Set<string>;
    rules: AknoContext['config']['rules'];
    sourceBody: string;
  },
): { extractions: ExtractionDraft[]; issues: string[] } {
  if (!Array.isArray(value) || value.length === 0) return { extractions: [], issues: [] };
  if (!options.available || options.limit <= 0) {
    return { extractions: [], issues: ['an extraction was proposed when no extraction slot was available'] };
  }
  if (value.length > options.limit) {
    return { extractions: [], issues: ['a page may propose at most one extraction'] };
  }

  const entry = value[0];
  if (!entry || typeof entry !== 'object') {
    return { extractions: [], issues: ['the extraction proposal is malformed'] };
  }
  const row = entry as Record<string, unknown>;
  const proposedSlug = typeof row.slug === 'string' ? row.slug.trim().replace(/^\/+|\/+$/g, '') : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const sourceHeading = typeof row.source_heading === 'string' ? row.source_heading.trimEnd() : '';
  const section = extractionSections(options.sourceBody, options.minBytes).find(
    (candidate) => candidate.heading === sourceHeading,
  );
  const bridge = typeof row.bridge === 'string' ? row.bridge.trim() : '';
  const slash = proposedSlug.lastIndexOf('/');
  const proposedFolder = slash > 0 ? proposedSlug.slice(0, slash) : '';
  const basename = slash > 0 ? proposedSlug.slice(slash + 1) : '';
  const folder = options.folders.find(
    (candidate) => candidate.path.toLowerCase() === proposedFolder.toLowerCase(),
  );
  const slug = folder ? `${folder.path}/${basename}` : proposedSlug;
  const issues: string[] = [];

  if (!folder)
    issues.push(`extraction destination is not an allowed knowledge folder: ${proposedFolder || '(root)'}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(basename)) {
    issues.push('extraction destination basename must be lowercase and hyphenated');
  }
  if (!title) issues.push('extraction title is empty');
  if (!section) issues.push('extraction source_heading is not one exact eligible source section');
  if (!bridge || bridge.includes('\n') || bridge.includes('<!--') || bridge.includes('-->')) {
    issues.push('extraction bridge must be one short plain Markdown paragraph');
  } else if (Buffer.byteLength(bridge) > 400) {
    issues.push('extraction bridge is too long');
  }
  if (slug.toLowerCase().startsWith(`${options.sourceSlug.toLowerCase()}/`)) {
    issues.push('extraction destination is a child of the source; use a split instead');
  }
  if (options.knownSlugs.has(slug.toLowerCase())) issues.push(`extraction target already exists: ${slug}`);
  if (folder && basename) issues.push(...destinationRuleIssues(slug, options.rules));

  return issues.length > 0
    ? { extractions: [], issues }
    : {
        extractions: [
          {
            slug,
            title,
            body: section!.body,
            bridge,
            sourceHeading,
            startIndex: section!.startIndex,
            endIndex: section!.endIndex,
          },
        ],
        issues: [],
      };
}

function destinationRuleIssues(slug: string, rules: AknoContext['config']['rules']): string[] {
  const issues: string[] = [];
  const rule = effectiveRule(slug, rules);
  const role = rule.role ?? 'knowledge';
  const remember = rule.remember ?? (role === 'knowledge' ? 'integrate' : 'deny');
  if (role !== 'knowledge' || remember !== 'integrate') {
    issues.push(`extraction destination is not opted-in integrated knowledge: ${slug}`);
  }
  const basename = slug.slice(slug.lastIndexOf('/') + 1);
  if (rule.slug_pattern) {
    try {
      if (!new RegExp(rule.slug_pattern).test(basename)) {
        issues.push(`extraction destination does not satisfy its folder slug pattern: ${slug}`);
      }
    } catch {
      issues.push(`extraction destination folder has an invalid slug pattern: ${slug}`);
    }
  }
  const depthRule = rules.find(
    (candidate) => candidate.max_depth !== undefined && matchesGlob(slug, candidate.glob),
  );
  if (depthRule?.max_depth !== undefined) {
    const baseDepth = depthRule.glob
      .replace(/\/\*\*?$/, '')
      .split('/')
      .filter(Boolean).length;
    const depth = slug.split('/').length - baseDepth;
    if (depth > depthRule.max_depth) {
      issues.push(`extraction destination exceeds its folder depth limit: ${slug}`);
    }
  }
  return issues;
}

function withExtractionBridge(body: string, extraction: ExtractionDraft): string {
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  const lines = body.split(newline);
  const managed =
    `<!-- akno:extract target=${JSON.stringify(extraction.slug)} -->${newline}` +
    `${extraction.bridge}${newline}` +
    `<!-- /akno:extract -->${newline}`;
  return [...lines.slice(0, extraction.startIndex), managed, ...lines.slice(extraction.endIndex)].join(
    newline,
  );
}

function extractionAccountingIssues(
  before: string,
  after: string,
  extractions: ExtractionDraft[],
  incomingAnchors: Set<string>,
): string[] {
  const issues: string[] = [];
  const prior = nonBlankLineCounts(before);
  const retained = nonBlankLineCounts(after);
  const moved = nonBlankLineCounts(extractions.map((entry) => entry.body).join('\n'));
  const combined = nonBlankLineCounts([after, ...extractions.map((entry) => entry.body)].join('\n'));

  for (const [line, count] of prior) {
    if ((combined.get(line) ?? 0) !== count) {
      issues.push('extraction did not account for every source line exactly once');
      break;
    }
  }
  for (const [line, count] of moved) {
    if ((prior.get(line) ?? 0) < count) {
      issues.push('extraction body contains authored text that was not copied verbatim from the source');
      break;
    }
  }

  const priorCount = [...prior.values()].reduce((total, count) => total + count, 0);
  const retainedCount = [...prior].reduce(
    (total, [line, count]) => total + Math.min(count, retained.get(line) ?? 0),
    0,
  );
  if (moved.size === 0 || retainedCount === priorCount) {
    issues.push('extraction did not move any authored source lines');
  }
  if (retainedCount < 2 || retainedCount / Math.max(1, priorCount) < 0.25) {
    issues.push('source page does not retain enough of its original purpose after extraction');
  }
  if (firstH1(before) !== firstH1(after)) {
    issues.push('source page heading changed during extraction');
  }

  const movedHeadings = headingReferences(extractions.map((entry) => entry.body).join('\n'));
  if ([...incomingAnchors].some((anchor) => movedHeadings.has(anchor))) {
    issues.push('an incoming link targets a heading that the extraction would move');
  }

  for (const extraction of extractions) {
    const occurrences = after.split(extraction.bridge).length - 1;
    if (occurrences !== 1) issues.push('extraction bridge must appear exactly once in the source');
    if (!linkTargets(extraction.bridge, '').wiki.has(extraction.slug.toLowerCase())) {
      issues.push(`extraction bridge does not link to its exact destination: [[${extraction.slug}]]`);
    }
  }
  return [...new Set(issues)];
}

function nonBlankLineCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.replaceAll('\r\n', '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

async function incomingHeadingAnchors(
  ctx: AknoContext,
  sourcePageId: string,
  sourceSlug: string,
): Promise<Set<string>> {
  const rows = ctx.store.db
    .prepare(
      `SELECT p.slug, p.rel_path, l.line FROM links l
       JOIN pages p ON p.id = l.from_page
       WHERE (l.to_page = ? OR lower(l.to_slug) = lower(?)) AND l.from_page != ?
       ORDER BY p.slug, l.line`,
    )
    .all(sourcePageId, sourceSlug, sourcePageId) as { slug: string; rel_path: string; line: number }[];
  const anchors = new Set<string>();
  for (const row of rows) {
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (content === null) continue;
    const line = content.replaceAll('\r\n', '\n').split('\n')[row.line - 1] ?? '';
    for (const match of line.matchAll(/\[\[([^\]|#]+)#([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      if (normalizeLinkTarget(match[1]!).toLowerCase() === sourceSlug.toLowerCase()) {
        anchors.add(normalizeHeadingReference(match[2]!));
      }
    }
    for (const match of line.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)) {
      const href = match[1]!;
      const hash = href.indexOf('#');
      if (hash < 0) continue;
      const target = href.slice(0, hash);
      if (normalizeLinkTarget(target, row.slug).toLowerCase() === sourceSlug.toLowerCase()) {
        anchors.add(normalizeHeadingReference(href.slice(hash + 1)));
      }
    }
  }
  return anchors;
}

/** Re-check heading-fragment safety against current backlinks at plan apply and verification time. */
export async function extractionIncomingHeadingIssues(
  ctx: AknoContext,
  sourceSlug: string,
  extractedBody: string,
): Promise<string[]> {
  const source = ctx.store.db.prepare('SELECT id FROM pages WHERE slug = ?').get(sourceSlug) as
    { id: string } | undefined;
  if (!source) return [`the extraction source is missing from the structural index: ${sourceSlug}`];
  const incoming = await incomingHeadingAnchors(ctx, source.id, sourceSlug);
  const moved = headingReferences(extractedBody);
  return [...incoming].some((anchor) => moved.has(anchor))
    ? ['an incoming link targets a heading that the extraction would move']
    : [];
}

function headingReferences(body: string): Set<string> {
  return new Set(
    body
      .split('\n')
      .map((line) => /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1] ?? null)
      .filter((heading): heading is string => heading !== null)
      .map(normalizeHeadingReference),
  );
}

function normalizeHeadingReference(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // A malformed escape should not take maintenance down; compare its literal form instead.
  }
  return decoded
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function childPage(split: SplitDraft, canonicalSlug: string): string {
  return `---\ntitle: ${JSON.stringify(split.title)}\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n    dream: synthesize\n  about:\n    - ${JSON.stringify(canonicalSlug)}\n---\n\n${split.body}`;
}

function extractionPage(extraction: ExtractionDraft, sourceSlug: string): string {
  return `---\ntitle: ${JSON.stringify(extraction.title)}\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n    dream: synthesize\n---\n\n${extractionPageBody(extraction, sourceSlug)}`;
}

function extractionPageBody(extraction: ExtractionDraft, sourceSlug: string): string {
  return (
    `${extraction.body.trimEnd()}\n\n` +
    `<!-- akno:extracted-from source=${JSON.stringify(sourceSlug)} -->\n` +
    `Extracted from [[${sourceSlug}]].\n` +
    '<!-- /akno:extracted-from -->\n'
  );
}

function endWithNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}
