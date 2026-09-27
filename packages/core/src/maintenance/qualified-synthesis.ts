import { fromMarkdown } from 'mdast-util-from-markdown';
import { hasNonfactualProse, proseQualifications } from '../kb/prose.ts';

interface Section {
  startOffset: number;
  endOffset: number;
  firstLine: number;
  lastLine: number;
  heading: string;
  text: string;
}

export interface QualifiedSynthesisScope {
  /** Body-relative, inclusive protected ranges, including deciding heading/context lines. */
  protectedSections: { bodyLineStart: number; bodyLineEnd: number }[];
  editableSections: number;
  /** Sections with existing factual lead prose that can change without moving protected lines. */
  editableLeads: number;
  /** Sections with an eligible factual tail after their last protected block. */
  editableTails: number;
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
      startOffset: start,
      endOffset: end,
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
  const contentQualified = new Set<number>();
  const contentStarts = new Map<number, number>();
  const protectedEnds = new Map<number, number>();
  const fullLocked = new Set<number>();
  const blocks = fromMarkdown(body).children;
  const owner = (line: number) => parts.findIndex((part) => line >= part.firstLine && line <= part.lastLine);
  const rootBlock = (line: number) =>
    blocks.find((block) => block.position!.start.line <= line && line <= block.position!.end.line);
  const protect = (line: number) => {
    const index = owner(line);
    if (index < 0) return;
    protectedIndexes.add(index);
    const block = rootBlock(line);
    const blockIndex = block ? blocks.indexOf(block) : -1;
    if (blockIndex < 0) {
      fullLocked.add(index);
      return;
    }
    // Preserve the complete root Markdown block and its separating whitespace. A nested
    // quote/list/code line cannot be detached from the syntax that gives it meaning.
    const next = blocks[blockIndex + 1]?.position!.start.offset ?? parts[index]!.endOffset;
    const end = Math.min(next, parts[index]!.endOffset);
    protectedEnds.set(index, Math.max(protectedEnds.get(index) ?? 0, end));
  };
  for (const [line, qualification] of qualifications) {
    if (qualification.answer_eligible || qualification.reason === 'heading') continue;
    protect(line);
    const index = owner(line);
    contentQualified.add(index);
    if (qualification.status === 'unresolved') fullLocked.add(index);
    const blockStart = rootBlock(line)?.position!.start.offset;
    if (index >= 0 && blockStart !== undefined) {
      const lineStart = body.lastIndexOf('\n', blockStart - 1) + 1;
      contentStarts.set(index, Math.min(contentStarts.get(index) ?? lineStart, lineStart));
    }
    for (const frame of qualification.frame) protect(frame.n);
  }
  // An ancestor heading is a deciding frame, not a content block that can open an
  // edit window of its own. Its whole section remains stable.
  for (const index of protectedIndexes) if (!contentQualified.has(index)) fullLocked.add(index);
  // Definitions can change the meaning of a reference in another section. Owned items have
  // their own semantics rather than ordinary prose qualifications; preserve their containers.
  for (const [i, part] of parts.entries()) {
    if (/<!--\s*(?:akno:(?:item|observation)\b|source\s*-->)/.test(part.text)) {
      protectedIndexes.add(i);
      fullLocked.add(i);
    }
  }
  const definitions: { firstLine: number; text: string }[] = [];
  const pending = [...blocks];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'definition')
      definitions.push({
        firstLine: node.position!.start.line,
        text: body.slice(node.position!.start.offset, node.position!.end.offset),
      });
    if ('children' in node) pending.push(...node.children);
  }
  for (const definition of definitions) {
    const index = owner(definition.firstLine);
    if (index >= 0) {
      protectedIndexes.add(index);
      fullLocked.add(index);
    }
  }
  protectedIndexes.delete(-1);
  const protectedPrefixes = new Map(
    [...protectedIndexes].map((index) => {
      const part = parts[index]!;
      const end = fullLocked.has(index) ? part.endOffset : (protectedEnds.get(index) ?? part.endOffset);
      return [index, part.text.slice(0, end - part.startOffset)] as const;
    }),
  );
  const eligibleLeads = new Set(
    [...protectedIndexes].filter((index) => {
      const start = contentStarts.get(index);
      const startLine = start === undefined ? -1 : body.slice(0, start).split('\n').length;
      return (
        !fullLocked.has(index) &&
        start !== undefined &&
        [...qualifications].some(
          ([line, q]) => q.answer_eligible && owner(line) === index && line < startLine,
        )
      );
    }),
  );
  const protectedMiddles = new Map(
    [...eligibleLeads].map((index) => [
      index,
      body.slice(contentStarts.get(index)!, protectedEnds.get(index) ?? parts[index]!.endOffset),
    ]),
  );
  return {
    parts,
    qualifications,
    protectedIndexes,
    protectedPrefixes,
    protectedMiddles,
    contentStarts,
    eligibleLeads,
    fullLocked,
    definitions,
  };
}

function canAppendFactual(body: string, offset: number): boolean {
  const prefix = body.slice(0, offset);
  const probe = '\n\nThe gate is blue.\n\n';
  const line = prefix.split('\n').length + 2;
  return (
    proseQualifications((prefix + probe + body.slice(offset)).split('\n')).get(line)?.answer_eligible ?? false
  );
}

/** A bounded alternative to a whole-page hold; no independent factual area means no draft call. */
export function qualifiedSynthesisScope(body: string): QualifiedSynthesisScope | null {
  if (!hasNonfactualProse(body)) return null;
  const { parts, protectedIndexes, protectedPrefixes, contentStarts, eligibleLeads, fullLocked } =
    inspect(body);
  const lineAt = (offset: number) => body.slice(0, offset).split('\n').length;
  const endLineAt = (offset: number) => lineAt(offset) - (body[offset - 1] === '\n' ? 1 : 0);
  return {
    protectedSections: [...protectedIndexes]
      .sort((a, b) => a - b)
      .flatMap((i) => {
        const part = parts[i]!;
        if (eligibleLeads.has(i)) {
          const heading = part.heading
            ? [
                {
                  bodyLineStart: part.firstLine,
                  bodyLineEnd: endLineAt(part.startOffset + part.heading.length),
                },
              ]
            : [];
          return [
            ...heading,
            {
              bodyLineStart: lineAt(contentStarts.get(i)!),
              bodyLineEnd: endLineAt(part.startOffset + protectedPrefixes.get(i)!.length),
            },
          ];
        }
        return [
          {
            bodyLineStart: part.firstLine,
            bodyLineEnd: endLineAt(part.startOffset + protectedPrefixes.get(i)!.length),
          },
        ];
      }),
    editableSections: parts.filter((part, i) => !protectedIndexes.has(i) && !!part.text.trim()).length,
    editableLeads: eligibleLeads.size,
    editableTails: parts.filter(
      (part, i) => protectedIndexes.has(i) && !fullLocked.has(i) && canAppendFactual(body, part.endOffset),
    ).length,
  };
}

/** Repeated at plan revision/apply, so a later proposal cannot bypass the draft guard. */
export function qualifiedSynthesisIssue(
  before: string,
  after: string,
  allowTemporalHeadings = false,
): string | null {
  if (!hasNonfactualProse(before)) return null;
  const prior = inspect(before);
  const next = inspect(after);
  if (
    prior.parts.length !== next.parts.length ||
    prior.parts.some(
      (part, i) =>
        part.heading !== next.parts[i]!.heading &&
        (!allowTemporalHeadings || prior.protectedIndexes.has(i) || next.protectedIndexes.has(i)),
    )
  )
    return 'Qualified synthesis must preserve every heading and its section order.';
  for (const i of prior.protectedIndexes) {
    const middleAtOriginalLine = () => {
      const part = prior.parts[i]!;
      const lineIndex =
        part.text.slice(0, prior.contentStarts.get(i)! - part.startOffset).split('\n').length - 1;
      const text = next.parts[i]!.text;
      let offset = 0;
      for (let n = 0; n < lineIndex; n++) {
        const newline = text.indexOf('\n', offset);
        if (newline < 0) return false;
        offset = newline + 1;
      }
      // Keep the same root block kinds and count before the quotation. This permits an in-place
      // factual rewrite while refusing a new paragraph, list, or container at that boundary.
      const leadShape = (value: string) => fromMarkdown(value).children.map((node) => node.type);
      if (
        JSON.stringify(leadShape(part.text.slice(0, prior.contentStarts.get(i)! - part.startOffset))) !==
        JSON.stringify(leadShape(text.slice(0, offset)))
      )
        return false;
      return text.slice(offset).startsWith(prior.protectedMiddles.get(i)!);
    };
    if (
      prior.fullLocked.has(i)
        ? next.parts[i]!.text !== prior.parts[i]!.text
        : !next.parts[i]!.text.startsWith(prior.protectedPrefixes.get(i)!) &&
          !(prior.eligibleLeads.has(i) && middleAtOriginalLine())
    )
      return 'Qualified synthesis changed a protected range or its deciding context.';
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
