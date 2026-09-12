/** Hold an explicit outer/inner reversal when the cited prose itself binds that reporting chain. */
export function reportingRolesSupported(text: string, support: string, outer: string): boolean {
  const prose = (value: string) =>
    value
      .normalize('NFKC')
      .replace(
        /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`\n]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
        ' ',
      )
      .replace(/\*\*/gu, '');
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = (value: string) => `(?<![\\p{L}\\p{N}])${escape(value)}(?![\\p{L}\\p{N}’'])`;
  const source = prose(support);
  const answer = prose(text);
  const reporter = named(outer.normalize('NFKC'));
  // Case-fold reporting grammar, then validate the captured name separately. A generic noun phrase
  // or another person's name after a short-name prefix cannot establish an inner speaker.
  const name = "((?:[\\p{L}’'.-]+ ){0,3}?[\\p{L}’'.-]+)";
  const properName = /^(?:\p{Lu}[\p{L}’'.-]* ){0,3}\p{Lu}[\p{L}’'.-]*$/u;
  const modifier = '(?:(?:reportedly|only|merely|только|лишь|предположительно)\\s+){0,2}';
  const verb =
    '(?:said|says|reported|reports|relayed|relays|stated|states|сообщил[аи]?|сообщает|сказал[аи]?|передал[аи]?|переда[её]т)(?![\\p{L}])';
  const intros = '(?:according to|по словам|со слов)';
  const chains = [
    `reported by ${reporter}:\\s+${name}\\s+${modifier}${verb}`,
    `${intros}\\s+${name},\\s+as relayed by\\s+${reporter}\\s*[,;]`,
    `${reporter}\\s+(?:relayed|relays)\\s+${name}[’']s\\s+(?:(?:unverified|unconfirmed|tentative)\\s+){0,2}(?:report|account|statement|assertion)(?![\\p{L}])`,
    `${intros}\\s+${reporter},\\s+${name}\\s+${modifier}${verb}`,
  ];
  const inners = new Set(
    chains.flatMap((pattern) =>
      [...source.matchAll(new RegExp(pattern, 'giu'))]
        .map((match) => match[1]!)
        .filter(
          (inner) =>
            properName.test(inner) && inner.toLocaleLowerCase('en-US') !== outer.toLocaleLowerCase('en-US'),
        ),
    ),
  );
  if (inners.size !== 1) return true;
  for (const inner of inners) {
    const reversed = new RegExp(
      `${intros}\\s+${named(inner)}\\s*,\\s+${reporter}\\s+${modifier}${verb}`,
      'iu',
    );
    // A source may explicitly report its own earlier relay. Preserve that possibility for full
    // semantic pairing; this guard catches only a novel reversed construction in generated text.
    if (reversed.test(answer) && !reversed.test(source)) return false;
  }
  return true;
}
