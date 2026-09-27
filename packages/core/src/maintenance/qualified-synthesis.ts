import { fromMarkdown } from 'mdast-util-from-markdown';
import { hasNonfactualProse, proseQualifications } from '../kb/prose.ts';

interface Section {
  firstLine: number;
  lastLine: number;
  heading: string;
  text: string;
}

export interface QualifiedSynthesisScope {
  /** Body-relative, inclusive lines, including the section's deciding heading. */
  protectedSections: { bodyLineStart: number; bodyLineEnd: number }[];
  editableSections: number;
}

function sections(body: string): Section[] {
  // Only root headings divide independent sections. A heading inside a quote, list or code
  // block belongs to that container and must never open a writable hole in its context.
  const headings = fromMarkdown(body).children.filter((node) => node.type === 'heading');
  const headingStarts = headings.map((node) => node.position!.start.offset!);
  const firstHeading = headingStarts[0];
  // An empty frontmatter/body separator has no ownership. Models commonly normalize it;
  // treating it as an extra section would reject an otherwise exact protected body.
  const starts =
    firstHeading !== undefined && !body.slice(0, firstHeading).trim()
      ? headingStarts
      : [0, ...headingStarts.filter((n) => n > 0)];
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? body.length;
    const heading = headings.find((node) => node.position!.start.offset === start);
    const text = body.slice(start, end);
    return {
      firstLine: body.slice(0, start).split('\n').length,
      lastLine: body.slice(0, end).split('\n').length - (text.endsWith('\n') ? 1 : 0),
      heading: heading ? body.slice(start, heading.position!.end.offset!) : '',
      text,
    };
  });
}

function inspect(body: string) {
  const parts = sections(body);
  const qualifications = proseQualifications(body.split('\n'));
  const protectedIndexes = new Set<number>();
  const owner = (line: number) => parts.findIndex((part) => line >= part.firstLine && line <= part.lastLine);
  for (const [line, qualification] of qualifications) {
    if (qualification.answer_eligible || qualification.reason === 'heading') continue;
    protectedIndexes.add(owner(line));
    for (const frame of qualification.frame) protectedIndexes.add(owner(frame.n));
  }
  // Definitions can change the meaning of a reference in another section. Owned items have
  // their own semantics rather than ordinary prose qualifications; preserve their containers.
  for (const [i, part] of parts.entries()) {
    if (/<!--\s*(?:akno:(?:item|observation)\b|source\s*-->)/.test(part.text)) protectedIndexes.add(i);
  }
  const definitions: { firstLine: number; text: string }[] = [];
  const pending = [...fromMarkdown(body).children];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'definition')
      definitions.push({
        firstLine: node.position!.start.line,
        text: body.slice(node.position!.start.offset, node.position!.end.offset),
      });
    if ('children' in node) pending.push(...node.children);
  }
  for (const definition of definitions) protectedIndexes.add(owner(definition.firstLine));
  protectedIndexes.delete(-1);
  return { parts, qualifications, protectedIndexes, definitions };
}

/** A bounded alternative to a whole-page hold; no independent section means no draft call. */
export function qualifiedSynthesisScope(body: string): QualifiedSynthesisScope | null {
  if (!hasNonfactualProse(body)) return null;
  const { parts, protectedIndexes } = inspect(body);
  return {
    protectedSections: [...protectedIndexes]
      .sort((a, b) => a - b)
      .map((i) => ({
        bodyLineStart: parts[i]!.firstLine,
        bodyLineEnd: parts[i]!.lastLine,
      })),
    editableSections: parts.filter((part, i) => !protectedIndexes.has(i) && part.text.trim()).length,
  };
}

/** Repeated at plan revision/apply, so a later proposal cannot bypass the draft guard. */
export function qualifiedSynthesisIssue(before: string, after: string): string | null {
  if (!hasNonfactualProse(before)) return null;
  const prior = inspect(before);
  const next = inspect(after);
  if (
    prior.parts.length !== next.parts.length ||
    prior.parts.some((part, i) => part.heading !== next.parts[i]!.heading)
  )
    return 'Qualified synthesis must preserve every heading and its section order.';
  for (const i of prior.protectedIndexes) {
    if (prior.parts[i]!.text !== next.parts[i]!.text)
      return 'Qualified synthesis changed a protected section or its deciding context.';
  }
  if (next.definitions.length !== prior.definitions.length)
    return 'Qualified synthesis cannot add or remove global reference definitions.';
  if ([...next.protectedIndexes].some((i) => !prior.protectedIndexes.has(i)))
    return 'Qualified synthesis introduced protected context or owned content into an independent section.';
  // Reproject the complete result. Keeping literal text alone is insufficient: a new frame
  // before it could silently change a report into an assertion, or qualify an independent fact.
  const signature = (inspection: ReturnType<typeof inspect>) => {
    const locate = (line: number) => {
      const i = inspection.parts.findIndex((part) => line >= part.firstLine && line <= part.lastLine);
      return [i, line - (inspection.parts[i]?.firstLine ?? 0)];
    };
    return [...inspection.qualifications]
      .filter(([, q]) => !q.answer_eligible && q.reason !== 'heading')
      .map(([line, q]) => ({
        location: locate(line),
        status: q.status,
        view: q.view,
        reason: q.reason,
        frame: q.frame.map((entry) => ({ location: locate(entry.n), text: entry.text })),
      }));
  };
  if (JSON.stringify(signature(prior)) !== JSON.stringify(signature(next)))
    return 'Qualified synthesis changed discourse ownership or introduced a new qualified span.';
  const proseKey = (text: string) =>
    text
      .replace(/^(?:\s*>)+\s*/, '')
      .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const qualifiedClaims = new Set(
    [...prior.qualifications]
      .filter(([, q]) => !q.answer_eligible && q.reason !== 'heading' && q.reason !== 'comment')
      .map(([line]) => proseKey(beforeLines[line - 1]!))
      .filter(Boolean),
  );
  const assertedCopies = (inspection: ReturnType<typeof inspect>, lines: string[], text: string) =>
    [...inspection.qualifications].filter(
      ([line, q]) => q.answer_eligible && proseKey(lines[line - 1]!) === text,
    ).length;
  for (const text of qualifiedClaims) {
    if (assertedCopies(next, afterLines, text) > assertedCopies(prior, beforeLines, text))
      return 'Qualified synthesis copied qualified text into an asserted section.';
  }
  return null;
}
