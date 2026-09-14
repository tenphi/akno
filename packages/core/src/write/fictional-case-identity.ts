import type { RetainSourceItem, RetainSourceSpan } from '@tenphi/akno-protocol';
import { AFFIRMATIVE_NAMED_ACTOR } from '../memory/named-actor.ts';

/** Identifier tokens survive translation; prose attachment still needs source verification. */
export function subjectIdentifiers(text: string): string[] {
  return (text.normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}._:/+-]*/gu) ?? [])
    .filter((token) => /\p{L}/u.test(token) && /\d/u.test(token))
    .map((token) => token.toLowerCase().replace(/[.:]+$/u, ''));
}

const name = AFFIRMATIVE_NAMED_ACTOR;
const subject = String.raw`[\p{Lu}\p{N}][\p{L}\p{N}._:/+-]*(?:[ \t]+[\p{Lu}\p{N}][\p{L}\p{N}._:/+-]*){0,5}`;
const introduction = new RegExp(
  String.raw`^(?:(?:${name}[ \t]+(?:proposes|proposed|suggests|suggested)[ \t]+(?:discussing|to[ \t]+discuss)|I,[ \t]+${name},[ \t]+propose[ \t]+discussing)[ \t]+(?:a|an|the)[ \t]+(?:fictional|invented|made-up)[ \t]+(?:case|example|scenario)[ \t]+(?:about|concerning)|(?:${name}[ \t]+(?:предлагает|предложил[а]?)[ \t]+обсудить|Я,[ \t]+${name},[ \t]+предлагаю[ \t]+обсудить)[ \t]+(?:вымышленный|придуманный)[ \t]+(?:случай|пример|сценарий)[ \t]+(?:про|о))[ \t]+${subject}[.!]?$`,
  'u',
);
const anaphor =
  /^(?:[Ii]n (?:this|the|that)(?: same)? (?:fictional|invented|made-up) (?:case|example|scenario),|[Вв] (?:этом|том)(?: же)? (?:вымышленном|придуманном) (?:случае|примере|сценарии)[ ,])\s*\p{Lu}/u;
const caseMention =
  /\b(?:fictional|invented|made-up)\s+(?:case|example|scenario)\b|(?<![\p{L}])(?:вымышленн|придуманн)[\p{L}]*\s+(?:случа|пример|сценари)[\p{L}]*/iu;
const retraction =
  /\b(?:retract\w*|withdraw\w*|false|not true|but|however|actually)\b|(?<![\p{L}])(?:отзыва[\p{L}]*|отозва[\p{L}]*|неверно|неправда|но|однако|на самом деле)(?![\p{L}])/iu;

/** A rejection witness, never a page or semantic verdict. Only a unique, affirmative named-case
 * introduction and this candidate's own direct same-case support can supply the missing identity. */
export function fictionalCaseSubjectIdentifier(
  support: readonly RetainSourceSpan[],
  frame: readonly RetainSourceSpan[],
  source: { sourceItems?: readonly RetainSourceItem[]; sourceText?: string },
): string | undefined {
  const items = source.sourceItems
    ? source.sourceItems.map(({ item_id, text, speaker }) => ({ item_id, text, speaker }))
    : source.sourceText === undefined
      ? []
      : [{ item_id: undefined, text: source.sourceText, speaker: undefined }];
  if (new Set(items.map((item) => item.item_id)).size !== items.length) return;

  const sentences = items.flatMap((item, order) => {
    // Mask complete quotations before segmentation without moving source coordinates. A selected
    // substring must not hide the quote, conditional prefix or retraction surrounding it.
    const unquoted = item.text.replace(
      /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
      (quote) => ' '.repeat(quote.length),
    );
    return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(unquoted)].map(
      ({ segment, index }) => ({
        item,
        order,
        start: index + segment.length - segment.trimStart().length,
        end: index + segment.trimEnd().length,
        text: segment.trim(),
      }),
    );
  });
  const owns = (spans: readonly RetainSourceSpan[], sentence: (typeof sentences)[number]) =>
    spans.some((span) => {
      if (span.item_id !== sentence.item.item_id) return false;
      const offset = sentence.item.text.indexOf(span.quote);
      return (
        offset >= 0 &&
        sentence.item.text.indexOf(span.quote, offset + 1) < 0 &&
        offset <= sentence.start &&
        offset + span.quote.length >= sentence.end
      );
    });
  const selected = sentences.filter(
    (sentence) =>
      anaphor.test(sentence.text) &&
      !sentence.text.includes('?') &&
      owns(support, sentence) &&
      owns(frame, sentence),
  );
  if (selected.length !== 1) return;
  const target = selected[0]!;
  const before = sentences.filter(
    (sentence) =>
      sentence.order < target.order || (sentence.order === target.order && sentence.end <= target.start),
  );
  // An omitted or differently introduced case is ambiguity, not permission to pick the only
  // identifier the model put in its frame. Earlier source context can only veto this witness.
  const mentions = before.filter((sentence) => caseMention.test(sentence.text));
  if (mentions.length !== 1) return;
  const intro = mentions[0]!;
  if (!introduction.test(intro.text) || !owns(frame, intro)) return;
  const actor = new RegExp(String.raw`^(?:(?:I|Я),[ \t]+)?(${name})`, 'u').exec(intro.text)?.[1];
  const normalizeName = (text: string) =>
    text
      .normalize('NFKC')
      .replace(/[ \t]+/gu, ' ')
      .trim();
  // For a structured conversation, an apparent actor prefix must also be the supplied speaker.
  // A third-party or ambiguous introduction remains available to the semantic path, not this floor.
  if (intro.item.speaker && (!actor || normalizeName(actor) !== normalizeName(intro.item.speaker))) return;
  const identifiers = subjectIdentifiers(intro.text);
  if (identifiers.length !== 1) return;
  const interval = [...before.slice(before.indexOf(intro) + 1), target];
  if (interval.some((sentence) => retraction.test(sentence.text))) return;
  // Immediate following corrections can invalidate the anaphor even when omitted from its quote.
  const following = sentences
    .slice(sentences.indexOf(target) + 1)
    .filter((sentence) => sentence.order === target.order);
  if (following.some((sentence) => retraction.test(sentence.text))) return;
  return identifiers[0];
}
