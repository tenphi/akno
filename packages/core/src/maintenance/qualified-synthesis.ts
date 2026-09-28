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
  /** Sections with existing factual lead prose before a protected block. */
  editableLeads: number;
  /** Existing factual spans between protected blocks. */
  editableMiddles: number;
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
  const protectedBlocks = new Map<number, Map<number, { start: number; end: number; type: string }>>();
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
    if (!block || blockIndex < 0) {
      fullLocked.add(index);
      return;
    }
    // Preserve the complete root Markdown block and its separating whitespace. A nested
    // quote/list/code line cannot be detached from the syntax that gives it meaning.
    const next = blocks[blockIndex + 1]?.position!.start.offset ?? parts[index]!.endOffset;
    const end = Math.min(next, parts[index]!.endOffset);
    protectedEnds.set(index, Math.max(protectedEnds.get(index) ?? 0, end));
    if (block.type !== 'heading') {
      const start = body.lastIndexOf('\n', block.position!.start.offset! - 1) + 1;
      const nextStart = blocks[blockIndex + 1]?.position!.start.offset;
      const blockEnd =
        nextStart === undefined
          ? parts[index]!.endOffset
          : Math.min(body.lastIndexOf('\n', nextStart - 1) + 1, parts[index]!.endOffset);
      const ranges = protectedBlocks.get(index) ?? new Map();
      ranges.set(start, { start, end: blockEnd, type: block.type });
      protectedBlocks.set(index, ranges);
    }
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
  const middleWindows = new Map(
    [...protectedIndexes].map((index) => {
      const ranges = [...(protectedBlocks.get(index)?.values() ?? [])].sort((a, b) => a.start - b.start);
      const windows = ranges.slice(1).flatMap((range, position) => {
        const start = ranges[position]!.end;
        const end = range.start;
        const startLine = body.slice(0, start).split('\n').length;
        const endLine = body.slice(0, end).split('\n').length;
        return !fullLocked.has(index) &&
          end > start &&
          [...qualifications].some(
            ([line, q]) => q.answer_eligible && owner(line) === index && line >= startLine && line < endLine,
          )
          ? [{ start, end }]
          : [];
      });
      return [index, windows] as const;
    }),
  );
  return {
    parts,
    qualifications,
    protectedIndexes,
    protectedPrefixes,
    protectedBlocks,
    middleWindows,
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
  const {
    parts,
    protectedIndexes,
    protectedPrefixes,
    contentStarts,
    eligibleLeads,
    middleWindows,
    fullLocked,
  } = inspect(body);
  const lineAt = (offset: number) => body.slice(0, offset).split('\n').length;
  const endLineAt = (offset: number) => lineAt(offset) - (body[offset - 1] === '\n' ? 1 : 0);
  return {
    protectedSections: [...protectedIndexes]
      .sort((a, b) => a - b)
      .flatMap((i) => {
        const part = parts[i]!;
        const ranges = [];
        if (eligibleLeads.has(i) && part.heading)
          ranges.push({
            bodyLineStart: part.firstLine,
            bodyLineEnd: endLineAt(part.startOffset + part.heading.length),
          });
        let cursor = eligibleLeads.has(i) ? contentStarts.get(i)! : part.startOffset;
        for (const window of middleWindows.get(i) ?? []) {
          if (window.start > cursor)
            ranges.push({ bodyLineStart: lineAt(cursor), bodyLineEnd: endLineAt(window.start) });
          cursor = window.end;
        }
        const end = part.startOffset + protectedPrefixes.get(i)!.length;
        if (end > cursor) ranges.push({ bodyLineStart: lineAt(cursor), bodyLineEnd: endLineAt(end) });
        return ranges;
      }),
    editableSections: parts.filter((part, i) => !protectedIndexes.has(i) && !!part.text.trim()).length,
    editableLeads: eligibleLeads.size,
    editableMiddles: [...middleWindows.values()].reduce((sum, windows) => sum + windows.length, 0),
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
    const middles = prior.middleWindows.get(i) ?? [];
    const blocks = [...(prior.protectedBlocks.get(i)?.values() ?? [])].sort((a, b) => a.start - b.start);
    const anchoredBlocksAndGaps = () => {
      const oldPart = prior.parts[i]!;
      const newPart = next.parts[i]!;
      const newBlocks = [...(next.protectedBlocks.get(i)?.values() ?? [])].sort((a, b) => a.start - b.start);
      if (blocks.length !== newBlocks.length) return false;
      const shape = (value: string) => fromMarkdown(value).children.map((node) => node.type);
      const sameFactualLayout = (oldGap: string, newGap: string, lead: boolean) => {
        const oldKinds = shape(oldGap);
        const newKinds = shape(newGap);
        if (JSON.stringify(oldKinds) === JSON.stringify(newKinds)) return true;
        // A curator may add or remove whole factual paragraphs. Keep a leading section
        // heading in its original position, and never let a list, quote, code block or
        // other container change its ownership at this boundary.
        const heading = lead && oldKinds[0] === 'heading' ? 1 : 0;
        return (
          JSON.stringify(oldKinds.slice(0, heading)) === JSON.stringify(newKinds.slice(0, heading)) &&
          oldKinds.length > heading &&
          newKinds.length > heading &&
          oldKinds.slice(heading).every((kind) => kind === 'paragraph') &&
          newKinds.slice(heading).every((kind) => kind === 'paragraph')
        );
      };
      let oldGapStart = oldPart.startOffset;
      let newGapStart = newPart.startOffset;
      for (const [position, block] of blocks.entries()) {
        const newBlock = newBlocks[position]!;
        if (block.type !== newBlock.type) return false;
        const oldGap = before.slice(oldGapStart, block.start);
        const newGap = after.slice(newGapStart, newBlock.start);
        const editable =
          (position === 0 && prior.eligibleLeads.has(i)) ||
          middles.some((window) => window.start === oldGapStart && window.end === block.start);
        if (editable ? !sameFactualLayout(oldGap, newGap, position === 0) : oldGap !== newGap) return false;
        const protectedText = before.slice(block.start, block.end);
        const newProtectedText = after.slice(newBlock.start, newBlock.end);
        if (block.end === oldPart.endOffset) {
          if (!newProtectedText.startsWith(protectedText)) return false;
          const separator = newProtectedText.slice(protectedText.length);
          if (separator.trim() || (separator && !protectedText.endsWith('\n') && !separator.startsWith('\n')))
            return false;
        } else if (newProtectedText !== protectedText) {
          return false;
        }
        oldGapStart = block.end;
        newGapStart = newBlock.end;
      }
      return true;
    };
    if (
      prior.fullLocked.has(i)
        ? next.parts[i]!.text !== prior.parts[i]!.text
        : middles.length || prior.eligibleLeads.has(i)
          ? !anchoredBlocksAndGaps()
          : !next.parts[i]!.text.startsWith(prior.protectedPrefixes.get(i)!)
    )
      return 'Qualified synthesis changed a protected range or its deciding context.';
  }
  if (next.definitions.length !== prior.definitions.length)
    return 'Qualified synthesis cannot add or remove global reference definitions.';
  if ([...next.fullLocked].some((i) => prior.protectedIndexes.has(i) && !prior.fullLocked.has(i)))
    return 'Qualified synthesis introduced owned or unresolved content into an editable section.';
  if ([...next.protectedIndexes].some((i) => !prior.protectedIndexes.has(i)))
    return 'Qualified synthesis introduced protected context or owned content into an independent section.';
  // Reproject the complete result. Keeping literal text alone is insufficient: a new frame
  // before it could silently change a report into an assertion, or qualify an independent fact.
  const signature = (inspection: ReturnType<typeof inspect>, source: string) => {
    const blockLines = new Map(
      [...inspection.protectedBlocks].map(([section, ranges]) => [
        section,
        [...ranges.values()]
          .sort((a, b) => a.start - b.start)
          .map((block) => ({
            first: source.slice(0, block.start).split('\n').length,
            last: source.slice(0, block.end).split('\n').length - (source[block.end - 1] === '\n' ? 1 : 0),
          })),
      ]),
    );
    const locate = (line: number) => {
      const i = inspection.parts.findIndex((part) => line >= part.firstLine && line <= part.lastLine);
      const blocks = blockLines.get(i) ?? [];
      const blockIndex = blocks.findIndex((block) => line >= block.first && line <= block.last);
      return blockIndex < 0
        ? [i, 'section', line - (inspection.parts[i]?.firstLine ?? 0)]
        : [i, 'block', blockIndex, line - blocks[blockIndex]!.first];
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
  if (JSON.stringify(signature(prior, before)) !== JSON.stringify(signature(next, after)))
    return 'Qualified synthesis changed discourse ownership or introduced a new qualified span.';
  const proseKey = (text: string) =>
    text
      .replace(/^(?:\s*>)+\s*/, '')
      .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
      .replace(/^\s*\[\s\]\s+/, '')
      .replace(/[*_`]/g, '')
      .trim()
      // Quotation marks and an unchecked task marker are attribution/intent syntax.
      // Removing them only for comparison catches a verbatim promotion to asserted prose;
      // the original protected bytes and their qualification remain untouched.
      .replace(/^["“”«»'‘’]+/, '')
      .replace(/["“”«»'‘’]+([.!?])$/, '$1')
      .replace(/["“”«»'‘’]+$/, '')
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
