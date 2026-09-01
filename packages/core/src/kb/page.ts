import path from 'node:path';
import type { DreamManagement, ObserveManagement, PageRole, RememberManagement } from '@tenphi/akno-protocol';
import { parseFrontmatter, readString, readTags, type Frontmatter } from './frontmatter.ts';
import { sha256 } from '../store/ids.ts';

/**
 * Reserved markers inside a page. This is the complete list — everything
 * else in a body is prose Akno does not interpret.
 */
const SOURCE_FENCE = /^<!--\s*source\s*-->\s*$/i;
export const AKNO_ITEM = /^\s*<!--\s*akno:item\s+(.+?)\s*-->\s*$/i;
export function aknoItemId(line: string): string | null {
  const match = AKNO_ITEM.exec(line);
  const id = match?.[1]?.trim().split(/\s+/)[0] ?? null;
  return id && /^[A-Za-z0-9_-]{4,80}$/.test(id) ? id : null;
}
/** `- **2026-06-02** | Renewed the apartment lease. [[home/lease]]` */
const EVENT_LINE = /^\s*[-*]\s+\*\*(\d{4}-\d{2}-\d{2})\*\*\s*\|\s*(.+?)\s*$/;
const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g;
/** `<page-basename>-<8 hex>.<ext>` is read as an attachment of that page. */
export const ATTACHMENT_NAME = /^(.+)-([0-9a-f]{8})\.([A-Za-z0-9]+)$/;

interface ParsedEvent {
  date: string;
  summary: string;
  /** The first wikilink on the line, if any. Plenty of events never have one. */
  targetSlug: string | null;
  line: number;
}

interface ParsedLink {
  toSlug: string;
  /**
   * `embed` is `[[receipt-3f8c1a2b.pdf]]` — a pointer at a *file*, not at a page.
   *
   * Worth its own kind for two reasons: an embed can never be a broken page link, and it is
   * the page's author saying which file belongs to this page, which is a better statement of
   * ownership than any filename convention can be.
   */
  kind: 'wikilink' | 'markdown' | 'embed';
  line: number;
}

export interface ParsedPage {
  slug: string;
  relPath: string;
  frontmatter: Frontmatter;
  title: string;
  type: string | null;
  tags: string[];
  /** Declared in frontmatter. Rules and defaults fill in when absent. */
  declaredRole: PageRole | null;
  declaredManagement: {
    remember?: RememberManagement;
    observe?: ObserveManagement;
    dream?: DreamManagement;
  };
  about: string[];
  aliases: string[];
  /** The whole file, unchanged. */
  content: string;
  /** Body only, after the frontmatter. */
  body: string;
  /** Every body line, 1-indexed by `bodyLine + i`. */
  lines: string[];
  /** Absolute (file-relative) line number of the first body line. */
  bodyLine: number;
  bodyHash: string;
  /**
   * Where `<!-- source -->` switches a knowledge page to source material. Above the
   * fence: canonical, mined, quotable in full. Below: indexed for search, never
   * mined, never returned whole. Null when the page has no fence.
   */
  sourceFenceLine: number | null;
  events: ParsedEvent[];
  links: ParsedLink[];
  frontmatterId: string | null;
}

export function parsePage(relPath: string, content: string): ParsedPage {
  const frontmatter = parseFrontmatter(content);
  const body = content.slice(frontmatter.bodyOffset);
  const lines = body.split('\n');
  const bodyLine = frontmatter.bodyLine;
  const slug = relPathToSlug(relPath);

  let sourceFenceLine: number | null = null;
  const events: ParsedEvent[] = [];
  const links: ParsedLink[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const absoluteLine = bodyLine + i;

    if (sourceFenceLine === null && SOURCE_FENCE.test(raw)) {
      sourceFenceLine = absoluteLine;
    }

    const event = EVENT_LINE.exec(raw);
    if (event) {
      const summary = event[2]!;
      events.push({
        date: event[1]!,
        // The link is part of the line's syntax, not part of what happened.
        summary: summary
          .replace(WIKILINK, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
        targetSlug: firstWikilink(summary),
        line: absoluteLine,
      });
    }

    for (const match of raw.matchAll(WIKILINK)) {
      const target = normalizeLinkTarget(match[1]!);
      links.push({
        toSlug: target,
        kind: isFileTarget(target) ? 'embed' : 'wikilink',
        line: absoluteLine,
      });
    }
    for (const match of raw.matchAll(MARKDOWN_LINK)) {
      links.push({
        toSlug: normalizeLinkTarget(match[1]!, slug),
        kind: 'markdown',
        line: absoluteLine,
      });
    }
  }

  const akno = readAknoData(frontmatter.data);
  const declaredRole = readPageRole(akno.role);
  const title = readString(frontmatter.data, 'title') ?? deriveTitle(lines, relPath);
  const rawAbout = readStringArray(akno.about);
  const rawAliases = readStringArray(akno.aliases);
  const identityKeys = new Set([title, slug, slug.split('/').pop() ?? slug].map(identityKey));

  return {
    slug,
    relPath,
    frontmatter,
    title,
    type: readString(frontmatter.data, 'type'),
    tags: readTags(frontmatter.data),
    declaredRole,
    declaredManagement: readManagement(akno.management),
    about: rawAbout.filter((entry) => normalizeLinkTarget(entry) !== slug),
    aliases: rawAliases.filter((entry) => !identityKeys.has(identityKey(entry))),
    content,
    body,
    lines,
    bodyLine,
    bodyHash: sha256(body),
    sourceFenceLine,
    events: dedupeEvents(events),
    links: dedupeLinks(links),
    frontmatterId: readString(frontmatter.data, 'id'),
  };
}

function readAknoData(data: Record<string, unknown>): Record<string, unknown> {
  const value = data.akno;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPageRole(value: unknown): PageRole | null {
  return value === 'knowledge' || value === 'source' || value === 'inference' || value === 'ignored'
    ? value
    : null;
}

function readManagement(value: unknown): {
  remember?: RememberManagement;
  observe?: ObserveManagement;
  dream?: DreamManagement;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const remember = record.remember === 'deny' || record.remember === 'integrate' ? record.remember : null;
  const observe = record.observe === 'deny' || record.observe === 'integrate' ? record.observe : null;
  const dream =
    record.dream === 'none' || record.dream === 'hygiene' || record.dream === 'synthesize'
      ? record.dream
      : null;
  return {
    ...(remember ? { remember } : {}),
    ...(observe ? { observe } : {}),
    ...(dream ? { dream } : {}),
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function identityKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Frontmatter `title:` wins; then the first `#` heading; then the filename
 * un-slugified. A page with no title at all is common and should not read as
 * `untitled` in a card.
 */
function deriveTitle(lines: string[], relPath: string): string {
  for (const line of lines) {
    const heading = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (heading) return heading[1]!.replace(/[#*`]/g, '').trim();
  }
  const base = path.basename(relPath).replace(/\.(md|markdown)$/i, '');
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function relPathToSlug(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/\.(md|markdown)$/i, '');
}

function firstWikilink(text: string): string | null {
  const match = WIKILINK.exec(text);
  WIKILINK.lastIndex = 0;
  return match ? normalizeLinkTarget(match[1]!) : null;
}

/**
 * A link target may be written a dozen ways: `[[home/lease]]`, `[[Home/Lease]]`,
 * `[[lease.md]]`, `[../home/lease.md]`. They all mean one page, and resolving
 * that here is the difference between a working backlink graph and a wall of
 * false "broken link" reports.
 */
/**
 * True for a target that names a file rather than a page.
 *
 * `normalizeLinkTarget` has already stripped `.md`, so anything with an extension left is
 * not a page: `[[receipt-3f8c1a2b.pdf]]`, `[[scan.jpg]]`. Counting those as page links made
 * every embedded attachment show up in `doctor` as a wikilink pointing at a page that does
 * not exist — noise that buries the real broken links.
 */
function isFileTarget(target: string): boolean {
  return /\.[A-Za-z0-9]{1,8}$/.test(target);
}

export function normalizeLinkTarget(target: string, fromSlug?: string): string {
  let cleaned = target
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.(md|markdown)$/i, '');
  if (cleaned.startsWith('./')) cleaned = cleaned.slice(2);

  if (fromSlug && (cleaned.startsWith('../') || !cleaned.includes('/'))) {
    const fromDir = fromSlug.includes('/') ? fromSlug.slice(0, fromSlug.lastIndexOf('/')) : '';
    cleaned = path.posix.normalize(path.posix.join(fromDir, cleaned));
  }
  // A target that resolves above the knowledge base root is clamped to it rather
  // than kept with its `..` intact. These strings are only ever compared against
  // `pages.slug`, never used as a path — but a slug that can express "outside the
  // knowledge base" is one refactor away from being used as one.
  return cleaned.replace(/^(?:\.\.\/)+/, '').replace(/^\/+/, '');
}

/** The same event written twice in one file is one event. */
function dedupeEvents(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.date}|${event.targetSlug ?? ''}|${event.summary.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeLinks(links: ParsedLink[]): ParsedLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (link.toSlug.length === 0) return false;
    const key = `${link.toSlug}|${link.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Resolution order, most specific first: **page frontmatter → rules file →
 * provenance → default.** `akno rules <path>` prints which one won and why.
 */
export interface RoleResolution {
  role: PageRole;
  source: 'frontmatter' | 'rule' | 'provenance' | 'default';
  /** The glob, when a rule won. */
  via?: string;
}

export function resolveRole(
  page: Pick<ParsedPage, 'declaredRole' | 'slug'>,
  rule: { role?: PageRole; glob?: string } | null,
  observationsPath: string,
): RoleResolution {
  if (page.declaredRole) return { role: page.declaredRole, source: 'frontmatter' };
  if (rule?.role) return { role: rule.role, source: 'rule', via: rule.glob };
  // Provenance: pages the observe tier authored are inferences, not authored
  // claims, and must never be admissible evidence for another observation.
  if (page.slug === observationsPath || page.slug.startsWith(`${observationsPath}/`)) {
    return { role: 'inference', source: 'provenance' };
  }
  return { role: 'knowledge', source: 'default' };
}

export interface ResolvedPagePolicy {
  role: PageRole;
  remember: RememberManagement;
  observe: ObserveManagement;
  dream: DreamManagement;
  about: string[];
  aliases: string[];
}

export function resolvePagePolicy(
  page: Pick<ParsedPage, 'declaredRole' | 'declaredManagement' | 'about' | 'aliases' | 'slug'>,
  rule: {
    role?: PageRole;
    remember?: RememberManagement;
    observe?: ObserveManagement;
    about?: string[];
    glob?: string;
  } | null,
  observationsPath: string,
): ResolvedPagePolicy {
  const role = resolveRole(page, rule, observationsPath).role;
  return {
    role,
    // Searchability is not write consent. A plain Markdown page remains useful knowledge,
    // but `remember` may change it only when the page or its folder says so explicitly.
    remember: page.declaredManagement.remember ?? rule?.remember ?? 'deny',
    // Observation placement is a separate, narrower grant. Existing remember/dream
    // settings never acquire this authority during an upgrade.
    observe: page.declaredManagement.observe ?? rule?.observe ?? 'deny',
    // Whole-page automatic authority must be visible on the page itself. Folder rules cannot
    // make an existing page rewritable merely because it was moved under another path.
    dream: page.declaredManagement.dream ?? 'none',
    about: page.about.length > 0 ? page.about : (rule?.about ?? []).filter((slug) => slug !== page.slug),
    aliases: page.aliases,
  };
}

/** True for a page written by the observe tier — ranked below authored pages. */
export function isObservation(slug: string, observationsPath: string): boolean {
  return slug === observationsPath || slug.startsWith(`${observationsPath}/`);
}
