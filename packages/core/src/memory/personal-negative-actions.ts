const name = String.raw`(?!(?:The|This|That|A|An)\b)\p{Lu}[\p{L}’'-]*(?:\s+\p{Lu}[\p{L}’'-]*){1,3}`;
const actor = String.raw`(?:${name}|I|[Hh]e|[Ss]he|[Яя]|[Оо]на?)`;
const agent = String.raw`(?:${name}|her|him|me|[Ее]ю|[Ии]м|[Мм]ной)`;
const adoption = String.raw`(?:adopted|accepted|approved)`;
const arrangement = String.raw`(?:arranged|booked|scheduled)`;
const personalStart = String.raw`(?<![\p{L}])${actor}(?:,\s*${name},)?\s+`;
const negative = String.raw`(?:(?:has|have|had)\s+not|(?:hasn|haven|hadn)['’]t)\s+(?:yet\s+)?`;
const planObject = String.raw`(?:\s+(?:the|this|that|a|her|his))?\s+(?:proposal|plan)|\s+[^.!?;,]{0,60}\bas\s+(?:a\s+)?plan`;
const meetingObject = String.raw`\s+(?:a|the|any|her|his)?\s*meeting`;
const ruAdoption = String.raw`не\s+(?:принял[аи]?|принимал[аи]?|утвердил[аи]?|утверждал[аи]?)\s+[^.!?;,]{0,60}(?:как|в качестве)\s+план\p{L}*`;
const ruArrangement = String.raw`не\s+(?:назначал[аи]?|назначил[аи]?|организовал[аи]?|организовывал[аи]?)\s+встреч\p{L}*`;

const actions = [
  {
    personal: String.raw`${personalStart}(?:${negative}${adoption}(?:${planObject})|${ruAdoption})`,
    passive: String.raw`(?:\b(?:not|never)\s+(?:(?:yet|been)\s+){0,2}${adoption}(?:\s+by\s+${agent})?\s+(?:as|in the capacity of)\s+(?:a\s+)?plan\b|(?<![\p{L}])[Нн]е\s+(?:был[ао]?\s+)?(?:принят|утвержд[её]н)\p{L}*(?:\s+${agent})?\s+(?:(?:как|в качестве)\s+)?план\p{L}*|(?<![\p{L}])[Пп]лан\s+не\s+(?:был\s+)?(?:принят|утвержд[её]н)\p{L}*)`,
  },
  {
    personal: String.raw`${personalStart}(?:${negative}${arrangement}${meetingObject}|${ruArrangement}|${negative}${adoption}(?:${planObject})\s+(?:or|and)\s+(?:${negative})?${arrangement}${meetingObject}|${ruAdoption}\s+и\s+${ruArrangement})`,
    passive: String.raw`(?:\b[Nn]o\s+meeting\s+(?:has|had)\s+(?:yet\s+)?been\s+${arrangement}\b|\b(?:[Nn]o|[Ww]ithout (?:an? )?)\s*(?:${arrangement}\s+)?meeting\b|\bmeeting\s+(?:(?:has|had)\s+not\s+(?:yet\s+)?been|(?:is|was)\s+not)\s+${arrangement}\b|(?<=\bnot\s+[^.!?;,]{0,90}\s+or\s+)used\s+to\s+arrange\s+a\s+meeting\b|(?<![\p{L}])[Вв]стреч\p{L}*\s+не\s+(?:был[ао]?\s+)?(?:назначен|организован)\p{L}*|(?<![\p{L}])без\s+(?:(?:назначенн|организованн)\p{L}*\s+встреч\p{L}*|организации\s+встреч\p{L}*)|(?<![\p{L}])[Нн]е\s+сопровождаем\p{L}*\s+организацией\s+встреч\p{L}*)`,
  },
];

function readable(value: string): string {
  return value.replace(/```[\s\S]*?```|«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`\n]*`/gu, ' ');
}

function hasAgent(text: string, match: RegExpMatchArray, support: string): boolean {
  // Bind only this predicate's explicit agent. An actor in a preceding proposal/adoption clause
  // cannot supply the actor of a following anonymous meeting clause.
  const body = match[0];
  const after = text.slice(match.index! + body.length).match(/^[^.!?;,]*/u)?.[0] ?? '';
  const sourceAgent = (identity: string) =>
    /^(?:her|him|me|ею|им|мной)$/iu.test(identity) || support.includes(identity);
  // Russian also permits an instrumental agent immediately after the complete complement
  // ("не принято как план ею"). Do not search past intervening words or a clause boundary.
  if (/[а-яё]/iu.test(body)) {
    const suffix = after.match(new RegExp(String.raw`^\s+(${agent})(?![\p{L}])`, 'u'))?.[1];
    if (suffix && sourceAgent(suffix)) return true;
    // An instrumental pronoun may precede this action's subject too. Limit this to explicit
    // pronoun + optional plan/proposal: an earlier reporting verb must not supply the agent.
    const before = text.slice(0, match.index);
    if (/(?<![\p{L}])(?:[Ее]ю|[Ии]м|[Мм]ной)\s+(?:(?:предложени\p{L}*|план\p{L}*)\s+)?$/u.test(before))
      return true;
  }
  const bound = (body + after).match(
    new RegExp(
      String.raw`(?:\bby\s+(${agent})(?![\p{L}])|(?<![\p{L}])(?:принят|утвержд[её]н|назначен|организован)\p{L}*\s+(${agent})(?![\p{L}]))`,
      'u',
    ),
  );
  if (!bound) return false;
  // Only an agent inside this match or immediately following it belongs to this action.
  if (bound.index! >= body.length && !/^\s*(?:by\s+)?$/u.test(after.slice(0, bound.index! - body.length)))
    return false;
  const identity = bound[1] ?? bound[2]!;
  return sourceAgent(identity);
}

/** A generated-only floor for personal plan adoption and meeting arrangement, not semantic approval. */
export function personalNegativeActionsSupported(text: string, support: string): boolean {
  const source = readable(support);
  const candidate = readable(text);
  return actions.every(({ personal, passive }) => {
    const sourcePassives = [...source.matchAll(new RegExp(passive, 'gu'))];
    if (!new RegExp(personal, 'u').test(source) && !sourcePassives.some((m) => hasAgent(source, m, source)))
      return true;
    // An independently anonymous source state defers only this action to full semantic pairing.
    // The floor neither requires unrelated omitted actions nor verifies actor identity or object scope.
    if (sourcePassives.some((m) => !hasAgent(source, m, source))) return true;
    return [...candidate.matchAll(new RegExp(passive, 'gu'))].every((m) => hasAgent(candidate, m, source));
  });
}
