import { z } from 'zod';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { parseJsonLoose, type ModelClient } from '../models/client.ts';

export interface ManagedItem {
  id: string;
  text: string;
  source: string;
  origin: 'user' | 'assistant' | 'unknown';
}

export interface PlacementResult {
  content: string;
  unsorted: string[];
  error: string | null;
}

const SYSTEM = `You place durable knowledge into one Markdown page.

Reply with JSON only:
{"placements":[{"id":"exact supplied id","heading":"exact existing ## heading, or a concise new heading"}]}

Choose the most specific semantically correct section for every item. Reuse an existing ## heading
when one fits. A new heading is allowed when it materially improves the page. Do not rewrite,
rephrase, merge or omit items. Do not use the title as a heading. Never return "Unsorted"; the
caller owns that fallback.`;

/** `id` is checked against the supplied set afterwards — a grammar can require a string
 *  there, not that it is one of the ids the model was actually given. */
export const PLACEMENT_SCHEMA = z.object({
  placements: z.array(z.object({ id: z.string(), heading: z.string() })),
});

/**
 * One model call places all managed items bound for a page. The model chooses only section names;
 * deterministic code performs the edit and preserves every existing byte outside the insertion.
 */
export async function placeManagedItems(
  content: string,
  items: ManagedItem[],
  model: ModelClient,
): Promise<PlacementResult> {
  if (items.length === 0) return { content, unsorted: [], error: null };

  const frontmatter = parseFrontmatter(content);
  const body = content.slice(frontmatter.bodyOffset);
  const existing = secondLevelHeadings(body);
  let chosen = new Map<string, string>();
  let error: string | null = null;

  if (model.available) {
    const result = await model.chat(
      [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content:
            `Page:\n${body.slice(0, 24_000)}\n\nExisting ## headings: ${JSON.stringify(existing)}\n\n` +
            `Items:\n${JSON.stringify(items.map(({ id, text }) => ({ id, text })))}`,
        },
      ],
      { schema: PLACEMENT_SCHEMA, maxTokens: Math.min(1600, 200 + items.length * 100) },
    );
    if (result.ok && result.value) {
      const parsed = parseJsonLoose<{ placements?: unknown }>(result.value);
      chosen = cleanPlacements(parsed?.placements, new Set(items.map((item) => item.id)));
      if (chosen.size !== items.length) error = 'placement omitted or invalidated one or more items';
    } else {
      error = result.error ?? 'placement failed';
    }
  } else {
    error = model.unavailableReason ?? 'placement model unavailable';
  }

  let nextBody = body;
  const unsorted: string[] = [];
  for (const item of items) {
    const heading = chosen.get(item.id) ?? 'Unsorted';
    if (heading === 'Unsorted') unsorted.push(item.id);
    nextBody = appendManagedBlock(nextBody, heading, managedBlock(item));
  }

  return {
    content: content.slice(0, frontmatter.bodyOffset) + nextBody,
    unsorted,
    error,
  };
}

function cleanPlacements(value: unknown, itemIds: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(value)) return out;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== 'string' || !itemIds.has(record.id) || out.has(record.id)) continue;
    if (typeof record.heading !== 'string') continue;
    const heading = cleanHeading(record.heading);
    if (heading) out.set(record.id, heading);
  }
  return out;
}

function cleanHeading(raw: string): string | null {
  const heading = raw
    .replace(/^#+\s*/, '')
    .replace(/[\r\n[\]<>]/g, '')
    .trim();
  if (heading.length === 0 || heading.length > 80 || heading.toLowerCase() === 'unsorted') return null;
  return heading;
}

function secondLevelHeadings(body: string): string[] {
  return body
    .split('\n')
    .map((line) => /^##\s+(.+?)\s*$/.exec(line)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function managedBlock(item: ManagedItem): string {
  return `<!-- akno:item ${item.id} source=${encodeMarker(item.source)} origin=${item.origin} -->\n${item.text.trim()}`;
}

function encodeMarker(value: string): string {
  return encodeURIComponent(managedSourceReference(value));
}

/** Return the exact source label that survives the bounded marker encoding. */
export function managedSourceReference(value: string): string {
  const cleaned = value.replace(/-->/g, '') || 'remember';
  let bounded = '';
  for (const character of cleaned) {
    const candidate = bounded + character;
    if (encodeURIComponent(candidate).length > 300) break;
    bounded = candidate;
  }
  return bounded || 'remember';
}

function appendManagedBlock(body: string, heading: string, block: string): string {
  const lines = body.replace(/\s+$/, '').split('\n');
  const wanted = heading.toLowerCase();
  const matches = lines
    .map((line, index) => ({ index, match: /^##\s+(.+?)\s*$/.exec(line) }))
    .filter((entry) => entry.match?.[1]?.trim().toLowerCase() === wanted);

  if (matches.length !== 1) {
    const gap = lines.length === 1 && lines[0] === '' ? [] : ['', ''];
    return `${[...lines, ...gap, `## ${heading}`, '', block].join('\n').replace(/^\n+/, '')}\n`;
  }

  const start = matches[0]!.index;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^#{1,2}\s+/.test(lines[index]!)) {
      end = index;
      break;
    }
  }
  while (end > start + 1 && lines[end - 1]!.trim() === '') end--;
  lines.splice(end, 0, '', block);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}
