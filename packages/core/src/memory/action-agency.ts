/** Preserve a readable singular nonselector instead of broadening it to an unassigned choice state. */
export function causeNonselectionAgencySupported(answerText: string, support: string): boolean {
  // Provenance metadata is not action agency. This floor activates from readable singular choice
  // grammar only; the semantic verifier still checks the actual identity and all clause relationships.
  const singular =
    /\b(?:has not|hasn['’]t) (?:yet )?(?:chosen|selected) (?:an? |the )?cause\b|(?:не (?:выбрала?|выбирала?)\s+причин\p{L}*|причин\p{L}*\s+(?:(?:она|он|я|пока|ещ[её]|так и)\s+){0,3}не (?:выбрала?|выбирала?))(?=$|[^\p{L}])/iu;
  const coordinated =
    /\b(?:has|have|had)\s+(?:(?:not|never)\s+(?:yet\s+)?(?:chosen|selected)\s+(?:(?:either|any|an?|the)\s+)?(?:cause|explanation|hypothesis|alternative)|(?:chosen|selected)\s+neither\s+(?:cause|explanation|hypothesis|alternative))\b|(?:не\s+(?:выбрала?|выбирала?)\s+(?:(?:ни\s+одну|никакую|ни\s+одной|какую-либо)\s+)?(?:причин|верси|гипотез|объяснен)\p{L}*|(?:причин|верси|гипотез|объяснен)\p{L}*\s+(?:(?:она|он|я|пока|ещ[её]|так и)\s+){0,3}не\s+(?:выбрала?|выбирала?))(?=$|[^\p{L}])/iu;
  // A second personal clause cannot license an agentless clause elsewhere in the same block.
  const unassigned =
    /\b(?:no cause (?:has|had) been (?:chosen|selected)|(?:a |the )?cause (?:has|had) not (?:yet )?been (?:chosen|selected)|neither(?: (?:cause|explanation|hypothesis|alternative))? (?:has been |had been |is |was |remains? )?(?:yet )?(?:chosen|selected)|neither(?: (?:cause|explanation|hypothesis|alternative))? (?:has|had) (?:yet )?been (?:chosen|selected))\b|(?<![\p{L}])(?:(?:причин|верси|гипотез|объяснен)\p{L}*\s+(?:(?:пока|ещ[её]|так и)\s+){0,2}не (?:выбрана?|выбрали|выбирали)|не (?:выбрали|выбирали)\s+(?:причин|верси|гипотез|объяснен)\p{L}*|ни\s+одн[ау](?:\s+(?:причин|верси|гипотез|объяснен)\p{L}*)?\s+(?:(?:пока|ещ[её]|так и)\s+){0,2}не\s+(?:выбрана?|выбрали|выбирали))(?![\p{L}])/giu;
  const sourcePassives = [...support.matchAll(unassigned)];
  // Pronouns and multiword name shapes avoid treating an initial capital on a collective noun
  // as personal identity. Other grammar stays with full semantic verification.
  const directPersonal = /(?:^|[^\p{L}])(?:I|he|she|я|он|она)\s*$/iu;
  const namedPersonal =
    /(?<![\p{L}])(?!(?:The|This|That|A|An)\b)\p{Lu}[\p{L}’'-]*(?:\s+\p{Lu}[\p{L}’'-]*){1,3}\s*$/u;
  const carriedPersonal =
    /(?<![\p{L}])(?:(?:I|he|she)|(?!(?:The|This|That|A|An)\b)\p{Lu}[\p{L}’'-]*(?:\s+\p{Lu}[\p{L}’'-]*){1,3})\s+(?:(?:is|was|am)\s+)?(?:consider(?:s|ed|ing)?|discuss(?:es|ed|ing)?)(?![\p{L}])/u;
  const personalActive = [singular, coordinated].some((pattern) =>
    [...support.matchAll(new RegExp(pattern.source, 'giu'))].some((match) => {
      const before =
        support
          .slice(0, match.index)
          .split(/[.!?;\n]/u)
          .at(-1) ?? '';
      return (
        /(?<![\p{L}])(?:я|он|она)(?![\p{L}])/iu.test(match[0]) ||
        directPersonal.test(before) ||
        namedPersonal.test(before) ||
        (/\b(?:and|but)\s*$/iu.test(before) && carriedPersonal.test(before))
      );
    }),
  );
  if (!personalActive && !sourcePassives.some((match) => boundAgent(support, match, support))) return true;
  return [...answerText.matchAll(unassigned)].every((match) => {
    // A separately sourced unassigned state does not inherit another clause's personal actor.
    // This only defers semantic pairing to the mandatory verifier; matching words are not evidence
    // that the candidate preserved that other clause's object, purpose or qualifications.
    if (
      sourcePassives.some(
        (original) =>
          original[0].toLocaleLowerCase('en-US') === match[0].toLocaleLowerCase('en-US') &&
          !boundAgent(support, original, support) &&
          /^(?:\s*$|\s*[.!?;,\n]|\s+(?:for|during|in|under|для|при|на|в|по)(?![\p{L}]))/iu.test(
            support.slice(original.index! + original[0].length),
          ),
      )
    )
      return true;
    return boundAgent(answerText, match, support);
  });
}

function boundAgent(text: string, match: RegExpMatchArray, support: string): boolean {
  const tail = text.slice(match.index! + match[0].length);
  const english = /[a-z]/iu.test(match[0]);
  const agent = tail.match(english ? /^\s+by\s+([^.!?;,]+)/u : /^\s+([^.!?;,]+)/u)?.[1];
  if (!agent) return false;
  const pronoun = agent.match(/^(?:her|him|me|ею|им|мной)(?=$|[^\p{L}])/iu)?.[0];
  // An explicit singular agent may retain passive voice. Its identity still needs verification.
  const name = agent.match(/^\p{Lu}[\p{L}’'-]*(?:\s+\p{Lu}[\p{L}’'-]*){0,3}/u)?.[0];
  const single = pronoun ?? (name && support.includes(name) ? name : null);
  if (!single) return false;
  const prefix = tail.match(english ? /^\s+by\s+/u : /^\s+/u)![0];
  const rest = tail.slice(prefix.length + single.length);
  return !/^\s*(?:(?:,\s*)?(?:and|with|и|с)(?=$|[^\p{L}])|,\s*\p{Lu})/u.test(rest);
}
