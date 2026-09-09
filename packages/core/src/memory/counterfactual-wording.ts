/** A nominal unrealized alternative can express the conditional without the words "если бы".
 * This presence floor never establishes the antecedent, consequence or actual-world qualification. */
export function hasNominalCounterfactual(text: string): boolean {
  const clauses = text
    .replace(
      /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
      '⟦quotation⟧',
    )
    .split(/[.!?;:\n]|,\s*(?:а|но|и|однако|хотя|пока)(?![\p{L}])/iu);
  // Bound the noun phrase to one relative clause. Another finite actor, quotation or clause
  // cannot lend an unrealized label to an independent conditional statement.
  const word = String.raw`(?!(?:она|он|они|я|мы|вы|ты|бы|был[аои]?|есть|будет|при|если|но|а|и|сказал[аои]?|сообщил[аои]?|подтвердил[аои]?)(?![\p{L}]))[\p{L}\p{N}-]+`;
  const nounPhrase = String.raw`(?:${word}[ \t]+){1,10}`;
  const conditional = String.raw`(?:[\p{Ll}]+л[аои]?[ \t]+бы|был[аои]?[ \t]+бы)`;
  // Keep the two observed grammatical shapes explicit instead of accepting a nearby "бы".
  const shapes = [
    String.raw`нереализованной[ \t]+альтернативой[ \t]+было[ \t]+(?:${word}[ \t]+){0,9}${word},[ \t]+которое[ \t]+в[ \t]+случае[ \t]+покупки[ \t]+${conditional}`,
    String.raw`нереализованный[ \t]+вариант,[ \t]+при[ \t]+котором[ \t]+${nounPhrase}${conditional}`,
  ];
  return clauses.some((clause) =>
    shapes.some((shape) => new RegExp(`(?<![\\p{L}])${shape}(?![\\p{L}])`, 'iu').test(clause)),
  );
}
