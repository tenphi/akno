/** A nominal unrealized alternative can express the conditional without the words "если бы".
 * This presence floor never establishes the antecedent, consequence or actual-world qualification. */
export function hasNominalCounterfactual(text: string): boolean {
  const unquoted = text.replace(
    /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    '⟦quotation⟧',
  );
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
