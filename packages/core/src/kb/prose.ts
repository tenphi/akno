import type { Line, MemoryView, ProseQualification } from '@tenphi/akno-protocol';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseFrontmatter } from './frontmatter.ts';
import { sha256 } from '../store/ids.ts';

export const PROSE_PROJECTION_VERSION = 'prose-v4';
type Meaning = Pick<ProseQualification, 'view' | 'reason'>;
const FACTUAL: Meaning = { view: 'factual', reason: 'asserted' };
const CONDITIONAL =
  /\b(?:if|suppose|assuming|hypothetical|counterfactual|what if|would have)\b|(?:^|[^\p{L}])(?:если|предположим|допустим|гипотез\p{L}*|гипотетическ\p{L}*|контрфактическ\p{L}*)(?=$|[^\p{L}])/iu;
const TENTATIVE =
  /\b(?:might|maybe|perhaps|possibly|probably|suspect|uncertain|tentative|would|could)\b|(?:^|[^\p{L}])(?:возможно|вероятно|может быть|подозрева\p{L}*|не уверен\p{L}*)(?=$|[^\p{L}])/iu;
const REPORT =
  /\b(?:said|says|reported|reports|according to|quoted|quotation)\b|(?:^|[^\p{L}])(?:сказал\p{L}*|сообщил\p{L}*|по словам|цитат\p{L}*)(?=$|[^\p{L}])/iu;
const REJECTED =
  /\b(?:rejected|cancelled|canceled|not decided|not accepted|did not choose)\b|(?:отклон\p{L}*|отмен\p{L}*|не решено|не выбрал\p{L}*|решение не принято)/iu;
const PLANNED =
  /\b(?:plan(?:s|ned|ning)? to|propos(?:e|ed|al)|intend(?:s)? to)\b|(?:планиру\p{L}*|намерева\p{L}*|предлага\p{L}*)/iu;
const SPEAKER =
  /^\s*(?:[-*]\s*)?(?:\*\*)?(?:user|assistant|system|external|пользователь|ассистент|система)(?:\*\*)?\s*:/iu;
// The paragraph boundary and heading reader must agree, including empty sibling headings.
// Otherwise a recognized boundary can be skipped without opening or closing its scope.
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)\r?$/;

interface SyntaxNode {
  type: string;
  children?: SyntaxNode[];
  position?: { start: { line: number }; end: { line: number } };
}
interface ListHeadingScope {
  content: string[];
  lastParagraph: number[];
}

function expandTabs(text: string): string {
  let column = 0;
  return [...text]
    .map((char) => {
      const value = char === '\t' ? ' '.repeat(4 - (column % 4)) : char;
      column += value.length;
      return value;
    })
    .join('');
}

/** CommonMark determines item boundaries: only paragraphs admit lazy continuation. */
function listHeadingScopes(lines: string[], first: number): Map<number, ListHeadingScope> {
  const scopes = new Map<number, ListHeadingScope>();
  if (!lines.some((line) => /^(?:[ \t]+| {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+)#{1,6}(?:[ \t]|$)/.test(line)))
    return scopes;
  const root = fromMarkdown(lines.map((line, i) => (i < first ? '' : line)).join('\n'));
  const items: { start: number; end: number; heading: boolean; paragraph: SyntaxNode | null }[] = [];
  const pending: { node: SyntaxNode; parents: typeof items }[] = [{ node: root, parents: [] }];
  while (pending.length) {
    const { node, parents } = pending.pop()!;
    let owners = parents;
    if (node.type === 'listItem' && node.position) {
      const item = {
        start: node.position.start.line - 1,
        end: node.position.end.line,
        heading: false,
        paragraph: null,
      };
      items.push(item);
      owners = [...parents, item];
    }
    if (node.type === 'heading') for (const owner of owners) owner.heading = true;
    if (node.type === 'paragraph') for (const owner of owners) owner.paragraph = node;
    for (const child of [...(node.children ?? [])].reverse()) pending.push({ node: child, parents: owners });
  }
  for (const item of items) {
    if (scopes.has(item.start)) continue;
    const text = expandTabs(lines[item.start]!);
    const prefix = /^( *(?:[-+*]|\d{1,9}[.)]))( *)/.exec(text);
    if (!prefix) continue;
    const padding = prefix[2]!.length;
    const indent = prefix[1]!.length + (padding >= 1 && padding <= 4 ? padding : 1);
    const content = lines.slice(item.start, item.end).map((line, i) => {
      const expanded = expandTabs(line);
      return i === 0 || /^ */.exec(expanded)![0].length >= indent ? expanded.slice(indent) : expanded;
    });
    // Heading-looking text in a list-contained code/comment block also needs container isolation.
    if (!item.heading && !content.some((line) => ATX_HEADING.test(line))) continue;
    // Removing the bullet must not turn an unchecked task into an asserted statement.
    if (/^\[ \](?:\s|$)/.test(content[0]!)) content[0] = `- ${content[0]}`;
    const paragraph = item.paragraph?.position;
    const lastParagraph =
      paragraph?.end.line === item.end
        ? Array.from(
            { length: paragraph.end.line - paragraph.start.line + 1 },
            (_, i) => paragraph.start.line - 1 + i,
          )
        : [];
    scopes.set(item.start, { content, lastParagraph });
  }
  return scopes;
}

function categoryHeading(text: string): Meaning | null {
  const title = text
    .trim()
    .replace(/\s+#+\s*$/, '')
    .replace(/^(\*{1,2}|_{1,2})(.+)\1$/u, '$2')
    .replace(/[:：]\s*$/, '')
    .trim();
  // Category titles establish scope; a token inside a document's descriptive title does not.
  // For example, a report number is ordinary data, whereas an assistant report is attribution.
  if (
    /^(?:(?:assistant|user|system|external|nested|attributed)\s+)?(?:reports?|retellings?)$/iu.test(title) ||
    /^(?:(?:вложенный|внешний)\s+)?(?:пересказ|сообщение|сообщения)(?:\s+(?:ассистента|пользователя|системы))?$/iu.test(
      title,
    )
  )
    return { view: 'reports', reason: 'heading_scope' };
  if (
    /^(?:preliminary|tentative|possible|competing)\s+(?:versions?|explanations?|causes?|hypothes[ei]s)$/iu.test(
      title,
    ) ||
    /^(?:предварительн\p{L}*|возможн\p{L}*)\s+(?:верси\p{L}*|объяснени\p{L}*|причин\p{L}*|гипотез\p{L}*)$/iu.test(
      title,
    )
  )
    return { view: 'discussion', reason: 'heading_scope' };
  return null;
}

function meaning(text: string, heading = false): Meaning {
  if (heading) text = text.replace(/\s+#+\s*$/, '').trim();
  const category = heading ? categoryHeading(text) : null;
  if (category) return category;
  if (CONDITIONAL.test(text)) return { view: 'discussion', reason: 'conditional' };
  if (REJECTED.test(text)) return { view: 'history', reason: 'rejected' };
  if (TENTATIVE.test(text)) return { view: 'discussion', reason: 'tentative' };
  if (heading && /^(?:user|assistant|system|external|пользователь|ассистент|система)$/iu.test(text.trim()))
    return { view: 'reports', reason: 'speaker' };
  if (
    heading &&
    /\b(?:scenario|alternatives?|discussion|hypothes[ei]s|assumptions?)\b|сценари\p{L}*|обсуждени\p{L}*|предположени\p{L}*/iu.test(
      text,
    )
  )
    return { view: 'discussion', reason: 'heading_scope' };
  if (
    heading &&
    /\b(?:examples?|samples?|transcript|conversation|dialogue)\b|пример\p{L}*|переписк\p{L}*|диалог\p{L}*/iu.test(
      text,
    )
  )
    return { view: 'reports', reason: 'heading_scope' };
  if (heading && /\b(?:plans?|proposals?|intentions?)\b|план\p{L}*|предложени\p{L}*/iu.test(text))
    return { view: 'planning', reason: 'heading_scope' };
  if (heading && /\bquestions?\b|вопрос\p{L}*/iu.test(text))
    return { view: 'questions', reason: 'heading_scope' };
  if (
    SPEAKER.test(text) ||
    /^\s*(?:>\s*)?(?:\*\*)?\p{Lu}[\p{L}’\x27-]+(?:[ \t]+\p{Lu}[\p{L}’\x27-]+){1,3}(?:\*\*)?:[ \t]+/u.test(
      text,
    )
  )
    return { view: 'reports', reason: 'speaker' };
  if (REPORT.test(text) || /^\s*(?:>|["“«])/.test(text)) return { view: 'reports', reason: 'quotation' };
  if (PLANNED.test(text) || /^\s*[-*]\s*\[ \]/.test(text)) return { view: 'planning', reason: 'plan' };
  if (/\?\s*$/.test(text)) return { view: 'questions', reason: 'question' };
  return FACTUAL;
}

/**
 * Interpret structural scope from the complete current file before selecting any line window.
 * This bounded deterministic projection does not claim to understand arbitrary implicit discourse.
 * Unresolved frames remain inspectable, but cannot acquire factual eligibility from truncation.
 */
export function proseQualifications(fileLines: string[]): Map<number, ProseQualification> {
  return projectProse(fileLines, fileLines, 0);
}

function projectProse(
  fileLines: string[],
  authoredLines: string[],
  listDepth: number,
  inherited?: Meaning,
  sourceScope = false,
): Map<number, ProseQualification> {
  const content = fileLines.join('\n');
  const first = parseFrontmatter(content).bodyLine - 1;
  const hash = sha256(content);
  const listScopes = listHeadingScopes(fileLines, first);
  const result = new Map<number, ProseQualification>();
  const headings: { depth: number; index: number; meaning: Meaning }[] = [];
  let carried: { index: number; meaning: Meaning } | null = null;
  let source = sourceScope;
  let commentStart: number | null = null;
  let fenced: { char: string; length: number; start: number } | null = null;
  let ownedPayload = false;
  let previousParagraph: number[] = [];

  const qualify = (indexes: number[], selected: Meaning, context: number[], unresolved = false): void => {
    const frameIndexes = [...new Set(context)].sort((a, b) => a - b);
    const tooLarge =
      frameIndexes.length > 12 || frameIndexes.reduce((sum, i) => sum + fileLines[i]!.length, 0) > 2400;
    const status = unresolved || tooLarge ? 'unresolved' : 'qualified';
    const frame = tooLarge ? [] : frameIndexes.map((i) => ({ n: i + 1, text: fileLines[i]! }));
    for (const index of indexes)
      result.set(index + 1, {
        status,
        view: selected.view,
        reason: tooLarge ? 'context_limit' : selected.reason,
        answer_eligible: status === 'qualified' && selected.view === 'factual',
        source_hash: hash,
        frame,
      });
  };

  for (let i = first; i < fileLines.length;) {
    const text = fileLines[i]!;
    if (commentStart !== null) {
      qualify([i], { view: 'discussion', reason: 'comment' }, [commentStart]);
      if (text.includes('-->')) commentStart = null;
      i++;
      continue;
    }
    const fence = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fenced) {
      qualify([i], { view: 'discussion', reason: 'example' }, [fenced.start]);
      if (
        fence &&
        fence[1]![0] === fenced.char &&
        fence[1]!.length >= fenced.length &&
        /^\s*(?:`+|~+)\s*$/.test(text)
      )
        fenced = null;
      i++;
      continue;
    }
    if (fence) {
      fenced = { char: fence[1]![0]!, length: fence[1]!.length, start: i };
      qualify([i], { view: 'discussion', reason: 'example' }, [i]);
      i++;
      continue;
    }
    // Normalizing a list marker cannot manufacture server-owned syntax from literal prose.
    if (/^\s*<!--\s*source\s*-->\s*$/.test(authoredLines[i]!)) source = true;
    if (/^\s*<!--\s*akno:(?:item|observation)\b/.test(authoredLines[i]!)) {
      ownedPayload = true;
      i++;
      continue;
    }
    if (!text.trim()) {
      i++;
      continue;
    }
    if (ownedPayload) {
      ownedPayload = false;
      i++;
      continue;
    }
    if (/^\s*<!--/.test(text)) {
      qualify([i], { view: 'discussion', reason: 'comment' }, [i]);
      if (!text.includes('-->')) commentStart = i;
      i++;
      continue;
    }
    const listScope = listScopes.get(i);
    if (listScope) {
      if (listDepth >= 12) {
        qualify(
          Array.from({ length: listScope.content.length }, (_, n) => i + n),
          { view: 'discussion', reason: 'context_limit' },
          [],
          true,
        );
        i += listScope.content.length;
        previousParagraph = [];
        continue;
      }
      const outer = source
        ? { view: 'reports' as const, reason: 'quotation' as const }
        : ([...headings].reverse().find((entry) => entry.meaning.view !== 'factual')?.meaning ??
          inherited ??
          carried?.meaning);
      const outerFrame = [...headings.map((entry) => entry.index), ...(carried ? [carried.index] : [])];
      // The leading blank prevents list content from being mistaken for document frontmatter.
      for (const [line, qualification] of projectProse(
        ['', ...listScope.content],
        ['', ...authoredLines.slice(i, i + listScope.content.length)],
        listDepth + 1,
        outer,
        source,
      )) {
        const index = i + line - 2;
        const selected = qualification;
        qualify(
          [index],
          selected,
          selected.view === 'factual'
            ? []
            : [...outerFrame, i, index, ...qualification.frame.map((entry) => i + entry.n - 2)],
          qualification.status === 'unresolved',
        );
      }
      previousParagraph = listScope.lastParagraph;
      i += listScope.content.length;
      continue;
    }
    const setext = /^\s{0,3}(=+|-+)\s*$/.exec(fileLines[i + 1] ?? '');
    const heading =
      ATX_HEADING.exec(text) ?? (setext ? ['', setext[1]![0] === '=' ? '#' : '##', text] : null);
    if (heading) {
      while (headings.length && headings.at(-1)!.depth >= heading[1]!.length) headings.pop();
      headings.push({ depth: heading[1]!.length, index: i, meaning: meaning(heading[2] ?? '', true) });
      carried = null;
      previousParagraph = [];
      // Headings supply context; by themselves they establish no proposition.
      qualify(setext ? [i, i + 1] : [i], { view: 'discussion', reason: 'heading' }, [i]);
      i += setext ? 2 : 1;
      continue;
    }
    const start = i;
    while (
      i < fileLines.length &&
      fileLines[i]!.trim() &&
      (i === start || !listScopes.has(i)) &&
      !ATX_HEADING.test(fileLines[i]!) &&
      !/^\s*(?:<!--|`{3,}|~{3,})/.test(fileLines[i]!)
    )
      i++;
    if (i === start) {
      i++;
      continue;
    }
    const indexes = Array.from({ length: i - start }, (_, j) => start + j);
    const explicit = indexes.map((index) => ({ index, meaning: meaning(fileLines[index]!) }));
    const scoped = [...headings].reverse().find((entry) => entry.meaning.view !== 'factual');
    // One later qualifier can reverse an earlier sentence within the same paragraph.
    const decisive =
      explicit.find((entry) => entry.meaning.reason === 'conditional') ??
      explicit.find((entry) => entry.meaning.reason === 'rejected') ??
      explicit.find((entry) => entry.meaning.view !== 'factual');
    if (decisive?.meaning.reason === 'conditional' || decisive?.meaning.reason === 'speaker')
      carried = decisive;
    const selected = source
      ? { view: 'reports' as const, reason: 'quotation' as const }
      : (scoped?.meaning ?? inherited ?? carried?.meaning ?? decisive?.meaning ?? FACTUAL);
    const context =
      selected.view === 'factual'
        ? []
        : [...headings.map((entry) => entry.index), ...(carried ? [carried.index] : []), ...indexes];
    // A following correction/qualification can refer back across a paragraph break.
    // Keep both paragraphs in the deciding frame instead of making the first look independent.
    if (
      selected.view !== 'factual' &&
      previousParagraph.length > 0 &&
      /(?:^|[.!?]\s*)(?:but |however,? )?(?:this|that|the above|the preceding|correction|actually|это|выше|исправление|однако)(?=$|[^\p{L}])/iu.test(
        fileLines[start]!,
      )
    ) {
      qualify(previousParagraph, selected, [
        ...previousParagraph,
        ...previousParagraph.flatMap((index) => result.get(index + 1)?.frame.map((line) => line.n - 1) ?? []),
        ...context,
      ]);
    }
    qualify(indexes, selected, context);
    previousParagraph = indexes;
  }
  return result;
}

export function qualifyProseLines<T extends Line>(lines: T[], fileLines: string[]): T[] {
  const qualifications = proseQualifications(fileLines);
  return lines.map((line) => {
    if (line.memory || line.observation) return line;
    const prose = qualifications.get(line.n);
    return prose
      ? { ...line, prose, ...(prose.answer_eligible ? {} : { fact: undefined, confidence: undefined }) }
      : line;
  });
}

export function proseEligibleForView(prose: ProseQualification, view: MemoryView): boolean {
  if (view === 'all') return true;
  if (prose.status !== 'qualified') return false;
  return prose.answer_eligible || (view !== 'factual' && prose.view === view);
}

export function hasNonfactualProse(content: string): boolean {
  const lines = content.split('\n');
  return [...proseQualifications(lines)].some(
    ([, q]) => !q.answer_eligible && q.reason !== 'heading' && q.reason !== 'comment',
  );
}
