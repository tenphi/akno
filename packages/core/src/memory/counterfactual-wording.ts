import { hasUnretractedClauseEnd } from './clause-ending.ts';
import { AFFIRMATIVE_NAMED_ACTOR } from './named-actor.ts';

/** A nominal unrealized alternative can express the conditional without the words "если бы".
 * This presence floor never establishes the antecedent, consequence or actual-world qualification. */
export function hasNominalCounterfactual(text: string): boolean {
  const unquoted = text.replace(
    /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    '⟦quotation⟧',
  );
  if (
    hasCompleteRussianCounterfactualUnit(unquoted) ||
    hasNamedAcquisitionCounterfactual(unquoted) ||
    hasNamedPurchaseRelative(unquoted)
  )
    return true;
  const clauses = unquoted.split(
    /[.!?;:\n]|,[ \t]*(?:а|но|и|однако|хотя|пока|but|and|although|however)(?![\p{L}])/iu,
  );
  // Bound the noun phrase to one relative clause. Another finite actor, quotation or clause
  // cannot lend an unrealized label to an independent conditional statement.
  const word = String.raw`(?!(?:она|он|они|я|мы|вы|ты|бы|был[аои]?|есть|будет|при|если|но|а|и|сказал[аои]?|сообщил[аои]?|подтвердил[аои]?)(?![\p{L}]))[\p{L}\p{N}-]+`;
  const nounPhrase = String.raw`(?=[^,⟦.!?;:\n]{1,160}?(?:[\p{Ll}]+л[аои]?[ \t]+бы|был[аои]?[ \t]+бы))(?:${word}[ \t]+){1,14}`;
  const conditional = String.raw`(?:[\p{Ll}]+л[аои]?[ \t]+бы|был[аои]?[ \t]+бы)`;
  const englishWord = String.raw`(?!(?:I|[Hh]e|[Ss]he|[Ww]e|[Tt]hey|[Yy]ou|would|will|is|was|are|were|has|had|if|but|and|said|reported|confirmed|denied|asked)(?![\p{L}]))[\p{L}\p{N}-]+`;
  const englishRelative = String.raw`(?:${englishWord}[ \t]+){1,14}`;
  const englishConsequence = String.raw`(?:${englishWord}[ \t]+){0,13}${englishWord}(?=[ \t]*(?:$|[.;!]))`;
  const englishActor = String.raw`(?:I|[Hh]e|[Ss]he|[Ww]e|[Tt]hey|(?!(?:The|This|That|If|Unless|When|Suppose|Example|Not)\b)\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){0,3})`;
  const englishIntroduction = String.raw`(?:^|[.;!])[ \t]*(?:(?:${englishActor}[ \t]+(?:described|describes|outlined|outlines)[ \t]+|[Tt]his[ \t]+(?:is|was)[ \t]+)?(?:[Aa]n?|[Tt]he)[ \t]+)?`;

  // Preserve the left scope when recognizing English: splitting at a colon would turn
  // "Example: ..." or "The note rejects this: ..." into an affirmative scenario.
  const english = new RegExp(
    String.raw`${englishIntroduction}(?:[Uu]nrealized|[Cc]ounterfactual)[ \t]+(?:option|alternative|scenario)[ \t]+in[ \t]+which[ \t]+${englishRelative}would[ \t]+(?:have|be)[ \t]+${englishConsequence}`,
    'u',
  );
  if (english.test(unquoted)) return true;

  // The unrealized noun and conditional must belong to one bounded relative clause;
  // an independent prediction or quoted example cannot provide either half.
  const shapes = [
    String.raw`нереализованной[ \t]+альтернативой[ \t]+было[ \t]+(?:${word}[ \t]+){0,9}${word},[ \t]+которое[ \t]+в[ \t]+случае[ \t]+покупки[ \t]+${conditional}`,
    String.raw`нереализованный[ \t]+вариант,[ \t]+при[ \t]+котором[ \t]+${nounPhrase}${conditional}`,
  ];
  return clauses.some((clause) =>
    shapes.some((shape) => new RegExp(`(?<![\\p{L}])${shape}(?![\\p{L}])`, 'iu').test(clause)),
  );
}

/** The adjacent actual-world closure is required for this purchase-relative form. Allowing `при`
 * in the shorter noun grammar would let a partial scenario bypass that closure entirely. */
function hasNamedPurchaseRelative(unquoted: string): boolean {
  const name = AFFIRMATIVE_NAMED_ACTOR;
  const word = String.raw`(?!(?:она|он|они|я|мы|вы|ты|бы|был[аои]?|есть|будет|при|если|но|а|и|не|что|чтобы|якобы|сказал[аои]?|сообщил[аои]?|подтвердил[аои]?|покрыл[аои]?|приобр[её]л[аи]?)(?![\p{L}]))[\p{Ll}\p{N}][\p{Ll}\p{N}'’-]*`;
  const product = String.raw`\p{Lu}[\p{L}'’-]*[ \t]+(?=[\p{L}\p{N}-]*\d)\p{Lu}[\p{L}\p{N}-]*`;
  const acquisition = String.raw`${word}(?:[ \t]+${word}){0,9}(?:[ \t]+для[ \t]+${product})?`;
  const repair = String.raw`ремонт(?:[ \t]+${word}){1,10}[ \t]+покрывался`;
  const referent = String.raw`(?:его|это[ \t]+(?:продление|расширение))`;
  // The described actor, adjacent pronoun and possessive must agree. Another named actor or
  // sentence cannot silently supply the actual-world nonpurchase for this conditional.
  return [
    { described: 'описала', pronoun: '[Оо]на', purchased: 'приобрела', possessive: 'е[её]' },
    { described: 'описал', pronoun: '[Оо]н', purchased: 'приобр[её]л', possessive: 'его' },
  ].some(({ described, pronoun, purchased, possessive }) => {
    const pattern = new RegExp(
      String.raw`(?:^|[.!])[ \t]*${name}[ \t]+${described}[ \t]+нереализованный[ \t]+вариант,[ \t]+при[ \t]+котором[ \t]+при[ \t]+покупке[ \t]+${acquisition}[ \t]+${repair}[ \t]+бы\.[ \t]+${pronoun}[ \t]+не[ \t]+${purchased}[ \t]+${referent},[ \t]+поэтому[ \t]+такое[ \t]+покрытие[ \t]+не[ \t]+являлось[ \t]+${possessive}[ \t]+действующим[ \t]+покрытием`,
      'gu',
    );
    return [...unquoted.matchAll(pattern)].some((match) =>
      hasUnretractedClauseEnd(unquoted, match.index + match[0].length),
    );
  });
}

/** A nominal acquisition is counterfactual only inside the complete unrealized/actual-world unit.
 * Object identity, repair scope and ownership still require the independent source verifier. */
function hasCompleteRussianCounterfactualUnit(unquoted: string): boolean {
  const name = String.raw`(?!(?:Если|Когда|Якобы|Не|Неверно|Пример|Допустим|If|Unless|Example|Not)(?![\p{L}]))\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){1,3}`;
  const attribution = String.raw`(?:[Пп]о[ \t]+словам[ \t]+${name},[ \t]+)?`;
  const word = String.raw`(?!(?:она|он|они|я|мы|вы|ты|бы|был[аои]?|есть|будет|при|если|но|а|и|не|что|якобы|сказал[аои]?|сообщил[аои]?|подтвердил[аои]?)(?![\p{L}]))[\p{L}\p{N}][\p{L}\p{N}'’-]*`;
  const noun = String.raw`${word}(?:[ \t]+${word}){0,13}`;
  const consequence = String.raw`${word}(?:[ \t]+${word}){0,15}`;
  const locative = String.raw`[Вв][ \t]+нереализованном[ \t]+(?:варианте|сценарии)[ \t]+`;
  const scenarios = [
    String.raw`${locative}покупка[ \t]+${noun}[ \t]+покрыла[ \t]+бы[ \t]+${consequence}`,
    String.raw`${locative}приобретение[ \t]+${noun}[ \t]+покрыло[ \t]+бы[ \t]+${consequence}`,
    String.raw`${locative}приобрет[её]нное[ \t]+${noun}[ \t]+покрывало[ \t]+бы[ \t]+${consequence}`,
    String.raw`[Нн]ереализованный[ \t]+вариант[ \t]+состоял[ \t]+в[ \t]+том,[ \t]+что[ \t]+при[ \t]+покупке[ \t]+${noun}[ \t]+был[ \t]+бы[ \t]+покрыт[ \t]+${consequence}`,
    String.raw`[Нн]ереализованный[ \t]+вариант[ \t]+(?:состоял|заключался)[ \t]+в[ \t]+том,[ \t]+что[ \t]+при[ \t]+покупке[ \t]+${noun}[ \t]+ремонт[ \t]+${consequence}[ \t]+был[ \t]+бы[ \t]+покрыт`,
  ];
  const nonpurchase = String.raw`(?:[Оо]на[ \t]+это[ \t]+продление[ \t]+не[ \t]+приобрела|[Оо]на[ \t]+не[ \t]+приобрела[ \t]+(?:это[ \t]+продление|его)|[Оо]н[ \t]+не[ \t]+приобр[её]л[ \t]+(?:это[ \t]+продление|его)|[Пп]окупки[ \t]+не[ \t]+произошло|[Пп]родление[ \t]+не[ \t]+было[ \t]+приобретено)`;
  const inactive = String.raw`(?:оно[ \t]+не[ \t]+являлось[ \t]+(?:её|его|их)[ \t]+действующим[ \t]+покрытием|речь[ \t]+не[ \t]+ид[её]т[ \t]+о[ \t]+(?:её|его|их)[ \t]+действующем[ \t]+покрытии|это[ \t]+не[ \t]+было[ \t]+(?:её|его|их)[ \t]+действующим[ \t]+покрытием|это[ \t]+не[ \t]+(?:её|его|их)[ \t]+действующее[ \t]+покрытие)`;
  return scenarios.some((scenario) => {
    const pattern = new RegExp(
      String.raw`(?:^|[.!])[ \t]*${attribution}${scenario}\.[ \t]+${nonpurchase},[ \t]+поэтому[ \t]+${inactive}`,
      'gu',
    );
    return [...unquoted.matchAll(pattern)].some((match) =>
      hasUnretractedClauseEnd(unquoted, match.index + match[0].length),
    );
  });
}

/** These acquisition forms need their own named actual-world closure. A quoted label, an
 * unrelated person's nonpurchase or an arbitrary colon cannot complete the conditional unit. */
function hasNamedAcquisitionCounterfactual(unquoted: string): boolean {
  const name = String.raw`(?!(?:Если|Когда|Якобы|Не|Неверно|Пример|Допустим|If|Unless|Example|Not)(?![\p{L}]))\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){1,3}`;
  const attribution = String.raw`(?:[Пп]о[ \t]+словам[ \t]+(?<source_name>${name}),[ \t]+)?`;
  const word = String.raw`(?!(?:она|он|они|я|мы|вы|ты|бы|был[аои]?|есть|будет|при|если|но|а|и|не|что|чтобы|якобы|сказал[аои]?|сообщил[аои]?|подтвердил[аои]?|покрыл[аои]?|приобр[её]л[аи]?)(?![\p{L}]))[\p{L}\p{N}][\p{L}\p{N}'’-]*`;
  const noun = String.raw`${word}(?:[ \t]+${word}){0,13}`;
  const consequence = String.raw`${word}(?:[ \t]+${word}){0,15}`;
  const introduction = String.raw`[Нн]ереализованный[ \t]+вариант[ \t]+(?:состоял|заключался)[ \t]+в[ \t]+том,[ \t]+`;
  const scenarios = [
    String.raw`${introduction}что[ \t]+приобретение[ \t]+${noun}[ \t]+покрыло[ \t]+бы[ \t]+${consequence}`,
    String.raw`${introduction}чтобы[ \t]+приобрести[ \t]+${noun}:[ \t]+в[ \t]+таком[ \t]+случае[ \t]+${consequence}[ \t]+был[ \t]+бы[ \t]+покрыт(?:[ \t]+${word}){0,8}`,
  ];
  const nonpurchase = String.raw`(?<actor_name>${name})[ \t]+(?:его[ \t]+не[ \t]+приобр[её]л[аи]?|не[ \t]+приобр[её]л[аи]?[ \t]+(?:это[ \t]+продление|его))`;
  const inactive = String.raw`(?:оно[ \t]+не[ \t]+являлось[ \t]+(?:её|его|их)[ \t]+действующим[ \t]+покрытием|это[ \t]+не[ \t]+было[ \t]+(?:её|его|их)[ \t]+действующим[ \t]+покрытием)`;
  return scenarios.some((scenario) => {
    const pattern = new RegExp(
      String.raw`(?:^|[.!])[ \t]*${attribution}${scenario}\.[ \t]+${nonpurchase},[ \t]+поэтому[ \t]+${inactive}`,
      'gu',
    );
    return [...unquoted.matchAll(pattern)].some((match) => {
      const source = match.groups!.source_name?.replace(/[ \t]+/gu, ' ');
      const actor = match.groups!.actor_name!.replace(/[ \t]+/gu, ' ');
      return (
        (!source || source === actor) && hasUnretractedClauseEnd(unquoted, match.index + match[0].length)
      );
    });
  });
}
