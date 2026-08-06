import path from 'node:path';
import type { PageClass } from '@akno/protocol';
import { parseFrontmatter, readString, readTags, type Frontmatter } from './frontmatter.ts';
import { sha256 } from '../store/ids.ts';

/**
 * §4. Reserved markers inside a page. This is the complete list — everything
 * else in a body is prose Akno does not interpret.
 */
const REFERENCE_FENCE = /^<!--\s*reference\s*-->\s*$/i;
/** `- **2026-06-02** | Renewed the apartment lease. [[home/lease]]` */
const EVENT_LINE = /^\s*[-*]\s+\*\*(\d{4}-\d{2}-\d{2})\*\*\s*\|\s*(.+?)\s*$/;
const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g;
/** `<page-basename>-<8 hex>.<ext>` is read as an attachment of that page (§11). */
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
  kind: 'wikilink' | 'markdown';
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
  declaredClass: PageClass | null;
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
   * §5. Where `<!-- reference -->` switches the page's class mid-body. Above the
   * fence: normal, mined, quotable in full. Below: indexed for search, never
   * mined, never returned whole. Null when the page has no fence.
   */
  referenceFenceLine: number | null;
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

  let referenceFenceLine: number | null = null;
  const events: ParsedEvent[] = [];
  const links: ParsedLink[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const absoluteLine = bodyLine + i;

    if (referenceFenceLine === null && REFERENCE_FENCE.test(raw)) {
      referenceFenceLine = absoluteLine;
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
      links.push({ toSlug: normalizeLinkTarget(match[1]!), kind: 'wikilink', line: absoluteLine });
    }
    for (const match of raw.matchAll(MARKDOWN_LINK)) {
      links.push({
        toSlug: normalizeLinkTarget(match[1]!, slug),
        kind: 'markdown',
        line: absoluteLine,
      });
    }
  }

  const declared = readString(frontmatter.data, 'class');
  const declaredClass =
    declared === 'full' || declared === 'reference' || declared === 'excluded' ? declared : null;

  return {
    slug,
    relPath,
    frontmatter,
    title: readString(frontmatter.data, 'title') ?? deriveTitle(lines, relPath),
    type: readString(frontmatter.data, 'type'),
    tags: readTags(frontmatter.data),
    declaredClass,
    content,
    body,
    lines,
    bodyLine,
    bodyHash: sha256(body),
    referenceFenceLine,
    events: dedupeEvents(events),
    links: dedupeLinks(links),
    frontmatterId: readString(frontmatter.data, 'id'),
  };
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
 * §5. Resolution order, most specific first: **page frontmatter → rules file →
 * provenance → default.** `akno rules <path>` prints which one won and why.
 */
export interface ClassResolution {
  class: PageClass;
  source: 'frontmatter' | 'rule' | 'provenance' | 'default';
  /** The glob, when a rule won. */
  via?: string;
}

export function resolveClass(
  page: Pick<ParsedPage, 'declaredClass' | 'slug'>,
  rule: { class?: PageClass; glob?: string } | null,
  observationsPath: string,
): ClassResolution {
  if (page.declaredClass) return { class: page.declaredClass, source: 'frontmatter' };
  if (rule?.class) return { class: rule.class, source: 'rule', via: rule.glob };
  // Provenance: pages the observe tier authored are inferences, not authored
  // claims, and must never be admissible evidence for another observation (§13).
  if (page.slug === observationsPath || page.slug.startsWith(`${observationsPath}/`)) {
    return { class: 'full', source: 'provenance' };
  }
  return { class: 'full', source: 'default' };
}

/** True for a page written by the observe tier — ranked below authored pages. */
export function isObservation(slug: string, observationsPath: string): boolean {
  return slug === observationsPath || slug.startsWith(`${observationsPath}/`);
}
