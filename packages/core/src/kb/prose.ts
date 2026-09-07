import type { Line, MemoryView, ProseQualification } from '@tenphi/akno-protocol';
import { parseFrontmatter } from './frontmatter.ts';
import { sha256 } from '../store/ids.ts';

export const PROSE_PROJECTION_VERSION = 'prose-v1';
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

function meaning(text: string, heading = false): Meaning {
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
  const content = fileLines.join('\n');
  const first = parseFrontmatter(content).bodyLine - 1;
  const hash = sha256(content);
  const result = new Map<number, ProseQualification>();
  const headings: { depth: number; index: number; meaning: Meaning }[] = [];
  let carried: { index: number; meaning: Meaning } | null = null;
  let source = false;
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
        ...selected,
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
    if (/^\s*<!--\s*source\s*-->\s*$/.test(text)) source = true;
    if (/^\s*<!--\s*akno:(?:item|observation)\b/.test(text)) {
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
    const setext = /^\s{0,3}(=+|-+)\s*$/.exec(fileLines[i + 1] ?? '');
    const heading =
      /^(#{1,6})\s+(.+)$/.exec(text) ?? (setext ? ['', setext[1]![0] === '=' ? '#' : '##', text] : null);
    if (heading) {
      while (headings.length && headings.at(-1)!.depth >= heading[1]!.length) headings.pop();
      headings.push({ depth: heading[1]!.length, index: i, meaning: meaning(heading[2]!, true) });
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
      !/^\s*(?:#{1,6}\s|<!--|`{3,}|~{3,})/.test(fileLines[i]!)
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
      : (scoped?.meaning ?? carried?.meaning ?? decisive?.meaning ?? FACTUAL);
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
      qualify(previousParagraph, selected, [...previousParagraph, ...context]);
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
