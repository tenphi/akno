import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DegradedReason, TimelineDescriptor } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { hasInlineMergeConflict, quarantineReasonsForPath } from '../index/page-quarantine.ts';
import { parsePage, resolvePagePolicy } from '../kb/page.ts';
import { effectiveRule } from '../rules/compile.ts';
import { isReserved } from '../reserved.ts';
import { sha256 } from '../store/ids.ts';
import { owningTimeline, timelineCatalog } from '../timeline/boundaries.ts';
import { routeLegacyEvent } from '../timeline/route-event.ts';
import { formatEventLine, insertEvent, newLedger } from '../write/ledger.ts';
import { runRetain, type RetainCandidate } from '../write/retain.ts';
import type { MaintenanceEvidence, MaintenanceOperation, ReplaceOperation } from './plans.ts';

type HistoryAction =
  | { kind: 'extract'; destination: string; line: string; source: string; candidate: RetainCandidate }
  | { kind: 'relocate'; destination: string; source: string; line: string };

interface HistorySource {
  relPath: string;
  hash: string;
  /** Full bounded evidence, kept only with the ordinary private maintenance-plan payload. */
  content?: string;
}

export interface TimelineHistoryProof {
  boundaries: string;
  sources: HistorySource[];
  actions: HistoryAction[];
  catalog: TimelineDescriptor[];
  scans: { key: string; fingerprint: string }[];
}

export interface TimelineHistoryDraft {
  slug: string;
  inputHash: string;
  operations: ReplaceOperation[];
  proof: TimelineHistoryProof;
}

export interface TimelineHistoryReport {
  inspected: number;
  cached: number;
  additions: number;
  relocations: number;
  held: Partial<
    Record<
      | 'source_unavailable'
      | 'source_ineligible'
      | 'unqualified_event'
      | 'ownership_uncertain'
      | 'destination_unavailable'
      | 'model_unavailable'
      | 'model_failed'
      | 'limit',
      number
    >
  >;
}

export function emptyTimelineHistoryReport(): TimelineHistoryReport {
  return { inspected: 0, cached: 0, additions: 0, relocations: 0, held: {} };
}

/** A declaration admits bounded history work, never a whole-page rewrite or an index-time write. */
export async function planTimelineHistory(
  ctx: AknoContext,
  options: { recordState?: boolean; protectedPaths?: ReadonlySet<string> } = {},
): Promise<{ drafts: TimelineHistoryDraft[]; report: TimelineHistoryReport; degraded: DegradedReason[] }> {
  const report = emptyTimelineHistoryReport();
  const degraded = new Set<DegradedReason>();
  const result = () => ({ drafts: [] as TimelineHistoryDraft[], report, degraded: [...degraded] });
  const hold = (reason: keyof TimelineHistoryReport['held']) => {
    report.held[reason] = (report.held[reason] ?? 0) + 1;
  };
  const limit = ctx.config.maintenance.curate.maxTimelineEvents;
  if (limit === 0) return result();
  const catalog = timelineCatalog(ctx.config, ctx.store);
  const ledgers = catalog.filter((entry) => entry.status === 'ready' && entry.writable);
  if (!ledgers.length) return result();
  const sources = new Map<string, HistorySource>();
  // Every declaration participates in routing. Changing an untouched description must also stale a plan.
  for (const entry of catalog) {
    if (entry.status !== 'ready') continue;
    const content = await readHistorySource(ctx, entry.path);
    if (content === null) {
      hold('source_unavailable');
      return result();
    }
    sources.set(entry.path, { relPath: entry.path, content, hash: sha256(content) });
  }
  if ([...sources.keys()].some((file) => options.protectedPaths?.has(file))) {
    hold('limit');
    return result();
  }
  const before = new Map(ledgers.map((entry) => [entry.path, sources.get(entry.path)!.content!]));
  const after = new Map(before);
  const actions: HistoryAction[] = [];
  const scans: TimelineHistoryProof['scans'] = [];
  const boundaries = boundaryFingerprint(catalog);
  const routingInput = sha256(
    JSON.stringify([
      boundaries,
      [...sources.values()].map(({ relPath, hash }) => [relPath, hash]),
      ctx.config.rules,
      ctx.models.derive.endpointFingerprint,
      'timeline-history-v1',
    ]),
  );
  let calls = 0;
  const cache = (key: string, fingerprint: string) => {
    if (options.recordState && ctx.writable) ctx.store.setMeta(key, fingerprint);
  };
  const proofFor = (planned: HistoryAction[], extra?: HistorySource): TimelineHistoryProof => ({
    boundaries,
    catalog,
    actions: planned,
    scans,
    sources: [...sources.values(), ...(extra && !sources.has(extra.relPath) ? [extra] : [])].map((source) =>
      catalog.some((entry) => entry.path === source.relPath)
        ? { relPath: source.relPath, hash: source.hash }
        : source,
    ),
  });
  const operationsFor = (planned: Map<string, string>): ReplaceOperation[] =>
    [...planned].flatMap(([relPath, content]) =>
      content === before.get(relPath)
        ? []
        : [
            {
              type: 'replace' as const,
              relPath,
              before: before.get(relPath)!,
              beforeHash: sha256(before.get(relPath)!),
              after: content,
              afterHash: sha256(content),
            },
          ],
    );
  const append = (action: HistoryAction, source?: HistorySource): boolean => {
    if (
      options.protectedPaths?.has(action.destination) ||
      (action.kind === 'relocate' && options.protectedPaths?.has(action.source))
    ) {
      hold('limit');
      return false;
    }
    const proposed = applyHistoryActions(before, [...actions, action]);
    if (
      !proposed ||
      [...proposed.values()].some((content) => Buffer.byteLength(content) > ctx.config.maxPageBytes)
    ) {
      hold('limit');
      return false;
    }
    // The curator must receive complete evidence. Its transport has a 100k-character envelope;
    // leave room for plan metadata instead of silently slicing a larger historical batch.
    if (
      JSON.stringify({
        operations: operationsFor(proposed),
        evidence: timelineHistoryEvidence(proofFor([...actions, action], source)),
      }).length > 80_000
    ) {
      hold('limit');
      return false;
    }
    if (source) sources.set(source.relPath, source);
    for (const [file, content] of proposed) after.set(file, content);
    actions.push(action);
    if (action.kind === 'extract') report.additions++;
    else report.relocations++;
    return true;
  };

  // Move only down an existing boundary tree. This cannot oscillate between sibling ledgers.
  for (const ledger of ledgers) {
    if (!catalog.some((entry) => isDescendant(ledger, entry))) continue;
    const content = before.get(ledger.path)!;
    for (const event of parsePage(ledger.path, content).events) {
      if (actions.length >= limit || calls >= limit) {
        hold('limit');
        break;
      }
      const line = content.split('\n')[event.line - 1]!;
      if (!standaloneEventLine(content, line)) {
        hold('source_ineligible');
        continue;
      }
      const key = `timeline-history:move:${sha256(ledger.path + '\0' + line)}`;
      const fingerprint = sha256(routingInput + line);
      if (ctx.store.meta(key) === fingerprint) {
        report.cached++;
        continue;
      }
      if (!ctx.models.derive.available) {
        hold('model_unavailable');
        degraded.add('no_derive_model');
        continue;
      }
      report.inspected++;
      calls++;
      const routed = await routeLegacyEvent({ date: event.date, summary: line }, catalog, ctx.models.derive);
      if (routed.degraded) degraded.add(routed.degraded);
      if (!routed.timeline) {
        hold(routed.degraded ? 'model_failed' : 'ownership_uncertain');
        if (!routed.degraded) cache(key, fingerprint);
        continue;
      }
      const target = routed.timeline;
      if (target.slug === ledger.slug) {
        cache(key, fingerprint);
        continue;
      }
      if (!isDescendant(ledger, target) || !after.has(target.path)) {
        hold('destination_unavailable');
        continue;
      }
      // A similar sentence is not an exact duplicate: never delete its provenance by fuzzy matching.
      if (append({ kind: 'relocate', source: ledger.path, destination: target.path, line }))
        scans.push({ key, fingerprint });
      else if (!actions.length) cache(key, fingerprint);
    }
  }

  const rows = ctx.store.db.prepare('SELECT slug, rel_path FROM pages ORDER BY rel_path').all() as {
    slug: string;
    rel_path: string;
  }[];
  let inspectedPages = 0;
  for (const row of rows) {
    if (sources.has(row.rel_path) || isReserved(row.slug, ctx.config)) continue;
    if (actions.length >= limit || inspectedPages >= ctx.config.maintenance.curate.maxPages) {
      hold('limit');
      break;
    }
    const owner = owningTimeline(catalog, row.slug);
    if (!after.has(owner.path) || options.protectedPaths?.has(row.rel_path)) continue;
    const content = await readHistorySource(ctx, row.rel_path);
    if (content === null) {
      hold('source_unavailable');
      continue;
    }
    const page = parsePage(row.rel_path, content);
    // No file timestamp is an event date. Undated notes need foreground retention with a source clock.
    if (!/\b\d{4}\b/u.test(page.body)) continue;
    if (!eligibleHistoryPage(ctx, row.rel_path, content)) {
      hold('source_ineligible');
      continue;
    }
    const key = `timeline-history:extract:${sha256(row.rel_path)}`;
    const fingerprint = sha256(routingInput + sha256(content));
    if (ctx.store.meta(key) === fingerprint) {
      report.cached++;
      continue;
    }
    if (!ctx.models.derive.available) {
      hold('model_unavailable');
      degraded.add('no_derive_model');
      continue;
    }
    if (JSON.stringify({ content, catalog }).length > 60_000) {
      hold('limit');
      continue;
    }
    inspectedPages++;
    report.inspected++;
    const retained = await runRetain(page.body, ctx.models.derive, {
      mission:
        'Extract only actual dated events explicitly recorded in this authored knowledge note for its folder timeline. Do not invent an event date from a file timestamp or today. Preserve attribution and uncertainty. Existing Akno-managed memory is already projected; never extract it again.',
    });
    if (retained.degradedReason) degraded.add(retained.degradedReason);
    if (retained.sourceHold) {
      hold(retained.sourceHold.reason_code === 'context_too_large' ? 'limit' : 'unqualified_event');
      continue;
    }
    if (retained.error) {
      hold('model_failed');
      continue;
    }
    if (retained.held.length || retained.events.length) hold('unqualified_event');
    const start = actions.length;
    let deferred = false;
    for (const candidate of retained.candidates) {
      if (!qualifiedHistoricalEvent(candidate, page.body)) {
        hold('unqualified_event');
        continue;
      }
      if (actions.length >= limit) {
        hold('limit');
        deferred = true;
        break;
      }
      const eventKey = `timeline-history:event:${sha256(row.rel_path + '\0' + candidate.time!.start + '\0' + candidate.text)}`;
      if (ctx.store.meta(eventKey) === fingerprint) {
        report.cached++;
        continue;
      }
      const event = { date: candidate.time!.start!, summary: candidate.text, slug: page.slug };
      const current = after.get(owner.path)!;
      // Use the ordinary writer's same-day duplicate check, including entries predating this feature.
      if (current.trim() && insertEvent(current, event).content === current) continue;
      const line = formatEventLine(event);
      if (
        !append(
          { kind: 'extract', source: row.rel_path, destination: owner.path, line, candidate },
          { relPath: row.rel_path, content, hash: sha256(content) },
        )
      ) {
        deferred = true;
        continue;
      }
      scans.push({ key: eventKey, fingerprint });
    }
    if (deferred && actions.length === 0) cache(key, fingerprint);
    if (!deferred) {
      if (actions.length === start) cache(key, fingerprint);
      else scans.push({ key, fingerprint });
    }
  }
  if (!actions.length) return result();
  const operations = operationsFor(after);
  const proof = proofFor(actions);
  const inputHash = sha256(
    JSON.stringify([proof.boundaries, proof.sources.map(({ relPath, hash }) => [relPath, hash]), actions]),
  );
  return {
    drafts: [
      {
        slug: parsePage(operations[0]!.relPath, operations[0]!.after).slug,
        inputHash,
        operations,
        proof,
      },
    ],
    report,
    degraded: [...degraded],
  };
}

/** Only terminal decisions suppress rediscovery; pending work must survive mode changes. */
export function recordTimelineHistoryScans(ctx: AknoContext, proof: TimelineHistoryProof | undefined): void {
  for (const scan of proof?.scans ?? []) ctx.store.setMeta(scan.key, scan.fingerprint);
}

export function timelineHistoryEvidence(proof: TimelineHistoryProof): MaintenanceEvidence[] {
  return proof.sources.map((source, index) => ({
    type: 'page',
    source: source.relPath,
    fingerprint: source.hash,
    relationship: 'ownership',
    sourceRelPath: source.relPath,
    sourceHash: source.hash,
    details: ['Exact source sealed for historical timeline population.'],
    ...(index === 0 ? { timelineHistory: proof } : {}),
  }));
}

export async function timelineHistoryIssue(
  ctx: AknoContext,
  proof: TimelineHistoryProof | undefined,
  operations: MaintenanceOperation[],
  stage: 'before' | 'after',
): Promise<string | null> {
  if (!proof?.actions.length || !operations.length || operations.some((op) => op.type !== 'replace'))
    return 'timeline history requires sealed existing-ledger replacements';
  const catalog = timelineCatalog(ctx.config, ctx.store);
  if (boundaryFingerprint(catalog) !== proof.boundaries)
    return 'timeline boundaries or their write policies changed';
  const replacements = operations as ReplaceOperation[];
  const before = new Map<string, string>();
  for (const source of proof.sources) {
    const op = replacements.find((entry) => entry.relPath === source.relPath);
    const current = await readHistorySource(ctx, source.relPath);
    if (
      (source.content !== undefined && sha256(source.content) !== source.hash) ||
      current === null ||
      sha256(current) !== (stage === 'after' && op ? op.afterHash : source.hash)
    )
      return 'timeline history evidence changed or became unavailable';
    const ledger = catalog.find((entry) => entry.path === source.relPath);
    if (ledger) before.set(source.relPath, op?.before ?? current);
  }
  for (const action of proof.actions) {
    const target = catalog.find((entry) => entry.path === action.destination);
    if (!target || target.status !== 'ready' || !target.writable)
      return 'timeline history destination is unavailable or read-only';
    if (action.kind === 'relocate') {
      const source = catalog.find((entry) => entry.path === action.source);
      if (!source?.writable || !isDescendant(source, target))
        return 'timeline relocation is not a writable ancestor-to-descendant transfer';
    } else {
      const source = proof.sources.find((entry) => entry.relPath === action.source);
      if (!source?.content || !eligibleHistoryPage(ctx, source.relPath, source.content))
        return 'timeline extraction source is not eligible authored knowledge';
      const page = parsePage(source.relPath, source.content);
      if (
        !qualifiedHistoricalEvent(action.candidate, page.body) ||
        owningTimeline(catalog, page.slug).slug !== target.slug ||
        action.line !==
          formatEventLine({
            date: action.candidate.time!.start!,
            summary: action.candidate.text,
            slug: page.slug,
          })
      )
        return 'timeline extraction lost its exact source, date, or folder ownership';
    }
  }
  const expected = applyHistoryActions(before, proof.actions);
  if (!expected) return 'timeline actions do not preserve exact event lines';
  const changed = [...expected].filter(([file, content]) => content !== before.get(file));
  if (
    changed.length !== replacements.length ||
    changed.some(
      ([file, content]) =>
        !replacements.some(
          (op) => op.relPath === file && op.before === before.get(file) && op.after === content,
        ),
    )
  )
    return 'timeline operation exceeds its sealed additions and relocations';
  return null;
}

function boundaryFingerprint(catalog: TimelineDescriptor[]): string {
  return sha256(
    JSON.stringify(
      catalog.map(({ slug, path: file, folder, default: root, status, writable }) => [
        slug,
        file,
        folder,
        root,
        status,
        writable,
      ]),
    ),
  );
}

function isDescendant(parent: TimelineDescriptor, child: TimelineDescriptor): boolean {
  return (
    !child.default &&
    parent.slug !== child.slug &&
    (parent.default || child.folder.startsWith(parent.folder + '/'))
  );
}

async function readHistorySource(ctx: AknoContext, relPath: string): Promise<string | null> {
  if (
    path.isAbsolute(relPath) ||
    relPath.split(/[\\/]/u).some((part) => !part || part === '.' || part === '..') ||
    quarantineReasonsForPath(ctx.store, relPath).length
  )
    return null;
  try {
    let current = ctx.config.aknoPath;
    const segments = relPath.split('/');
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stat = await fsp.lstat(current);
      if (
        stat.isSymbolicLink() ||
        (index < segments.length - 1
          ? !stat.isDirectory()
          : !stat.isFile() || stat.size > ctx.config.maxPageBytes)
      )
        return null;
    }
    const content = await fsp.readFile(current, 'utf8');
    return hasInlineMergeConflict(content) ? null : content;
  } catch {
    return null;
  }
}

function eligibleHistoryPage(ctx: AknoContext, relPath: string, content: string): boolean {
  const page = parsePage(relPath, content);
  const policy = resolvePagePolicy(
    page,
    effectiveRule(page.slug, ctx.config.rules),
    ctx.config.paths.observations,
  );
  // Managed records and document renditions already retain stronger temporal and epistemic identity.
  // Copying their prose into an unqualified authored event would destroy that identity.
  return (
    policy.role === 'knowledge' &&
    policy.remember !== 'deny' &&
    !isReserved(page.slug, ctx.config) &&
    !/[\r\n[\]|#]/u.test(page.slug) &&
    !/<!--\s*akno:|<!--\s*source\b/iu.test(content)
  );
}

function qualifiedHistoricalEvent(candidate: RetainCandidate, body: string): boolean {
  const time = candidate.time;
  return (
    candidate.kind === 'event' &&
    !/\[|<[a-z!]/iu.test(candidate.text) &&
    candidate.discourse.commitment === 'asserted' &&
    candidate.discourse.disposition === 'active' &&
    candidate.epistemic.basis === 'self_attested' &&
    candidate.attribution.source_role === 'user' &&
    !candidate.attribution.chain?.length &&
    candidate.polarity !== 'negated' &&
    !candidate.relations?.length &&
    time?.relation === 'occurred' &&
    time.status === 'actual' &&
    time.precision === 'day' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(time.start ?? '') &&
    !time.until &&
    !time.recurrence &&
    candidate.support.every((span) => body.includes(span.quote)) &&
    candidate.discourse_frame.every((span) => body.includes(span.quote))
  );
}

function standaloneEventLine(content: string, line: string): boolean {
  const lines = content.split('\n');
  const index = lines.indexOf(line);
  // Continuations, managed records, code blocks, and repeated identical lines require inspection.
  return (
    index >= 0 &&
    lines.lastIndexOf(line) === index &&
    /^- \*\*\d{4}-\d{2}-\d{2}\*\*\s*\|/u.test(line) &&
    // Byte-identical relative addresses can point elsewhere after a folder transfer.
    !/\[\[(?:\.{1,2}\/|#)/u.test(line) &&
    !/\[|<[a-z!]/iu.test(line.replace(/\[\[[^\]]+\]\]/gu, '')) &&
    !/<!--\s*akno:|```|~~~/iu.test(content) &&
    !/^\s+\S/u.test(lines[index + 1] ?? '')
  );
}

function applyHistoryActions(
  before: Map<string, string>,
  actions: HistoryAction[],
): Map<string, string> | null {
  const after = new Map(before);
  for (const action of actions) {
    let destination = after.get(action.destination);
    if (destination === undefined) return null;
    if (action.kind === 'relocate') {
      const source = after.get(action.source);
      if (source === undefined || !standaloneEventLine(source, action.line)) return null;
      const lines = source.split('\n');
      lines.splice(lines.indexOf(action.line), 1);
      after.set(action.source, lines.join('\n'));
    }
    if (!destination.split('\n').includes(action.line)) {
      const date = /^- \*\*(\d{4}-\d{2}-\d{2})\*\*/u.exec(action.line)?.[1];
      if (!date) return null;
      if (!destination.trim()) destination = newLedger(date.slice(0, 4));
      // The ordinary insertion algorithm chooses the year/date position. The exact original line,
      // including every citation and qualifier, replaces only our unique temporary placeholder.
      const event = { date, summary: `akno-history-${sha256(action.line)}` };
      destination = insertEvent(destination, event).content.replace(
        formatEventLine(event),
        () => action.line,
      );
      after.set(action.destination, destination);
    }
  }
  return after;
}
