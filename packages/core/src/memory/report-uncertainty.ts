const REPORT_UNCERTAINTY =
  /\b(?:unverified|unconfirmed|not (?:yet )?(?:been )?(?:independently )?(?:verified|confirmed)|(?:no|without|lacks?) (?:independent )?confirmation)\b|неподтвержд|непроверенн|не провер|не подтверд|не (?:был[аои]? )?подтвержд[её]н|подтверждения[^.!?;\n]{0,40}нет|без подтверждени/iu;

/** Presence of a personal epistemic limit; predicate equivalence still needs source verification. */
export function hasReportUncertainty(text: string): boolean {
  if (REPORT_UNCERTAINTY.test(text)) return true;
  const unquoted = text.replace(
    /«[^»]*»|“[^”]*”|"[^"\n]*"|\x60[^\x60]*\x60|‘[^’]*’|(?<![\p{L}\p{N}])'(?:[^'\n]|(?<=[\p{L}\p{N}])'(?=[\p{L}\p{N}]))+'(?![\p{L}\p{N}])/gu,
    '⟦quotation⟧',
  );
  const name = String.raw`(?!(?:The|This|That|A|An|If|Unless|When|Suppose|Example|Allegedly|Not)\b)\p{Lu}[\p{L}’'-]*(?:[ \t]+\p{Lu}[\p{L}’'-]*){1,3}`;
  const namedActor = String.raw`(?:${name}|(?:[Tt]he[ \t]+)?(?:AI[ \t]+)?assistant)`;
  const actor = String.raw`(?:${namedActor}|I|[Hh]e|[Ss]he|[Ww]e|[Tt]hey)`;
  const negativeAuxiliary = String.raw`(?:has|have|had)[ \t]+not[ \t]+(?:yet[ \t]+)?`;
  const examination = String.raw`(?:read|examined|seen|reviewed)[ \t]+(?:(?:the|these|those|any)[ \t]+)?(?:service[ \t]+)?(?:terms|contract|agreement)`;
  const determiner = String.raw`(?:(?:the|this|that|any)[ \t]+)?`;
  // Checking is admitted only with a report object; this does not equate a performed check
  // with receiving confirmation, or allow a nearby device check to qualify the report.
  const reportObject = String.raw`(?:${determiner}(?:report|message|claim|account|assumption)|${name}['’]s[ \t]+(?:report|account|claim))`;
  const checkedObject = String.raw`(?:${determiner}(?:report|account|claim)|${name}['’]s[ \t]+(?:report|account|claim))`;
  const reportCheck = String.raw`(?:independently[ \t]+)?(?:(?:confirmed|verified)[ \t]+${reportObject}|checked[ \t]+${checkedObject})`;
  const finalPredicate = String.raw`(?:independently[ \t]+)?(?:confirmed|verified)[ \t]+(?:it|this|that)(?:[ \t]+as[ \t]+(?:a|the|this|that)[ \t]+(?:condition|term|requirement))?`;
  const personalCheck = String.raw`(?:independently[ \t]+)?(?:checked|confirmed|verified)[ \t]+(?:it|${determiner}(?:reported[ \t]+)?(?:meaning|contractual[ \t]+(?:condition|term|requirement)))`;
  const negativeExplanation = String.raw`,[ \t]+(?:so|therefore)[ \t]+it[ \t]+(?:is|was)[ \t]+not[ \t]+(?:a|the)[ \t]+(?:condition|term|requirement)[ \t]+${actor}[ \t]+(?:has|have|had)[ \t]+(?:independently[ \t]+)?(?:verified|confirmed)`;
  const possibleContinuation = String.raw`,[ \t]+(?:and|so)[ \t]+(?:this|it)[ \t]+(?:is|remains)[ \t]+(?:(?:still|only)[ \t]+)?a[ \t]+possible[ \t]+(?:(?:contract|contractual)[ \t]+)?(?:condition|term|requirement|interpretation|assumption)(?:[ \t]+rather[ \t]+than[ \t]+an?[ \t]+established[ \t]+(?:condition|term|requirement|interpretation|assumption))?`;
  const clarification = String.raw`,[ \t]+and[ \t]+(?:she|he|they|the assistant)[ \t]+clarif(?:y|ies)[ \t]+that[ \t]+these[ \t]+are[ \t]+${name}['’]s[ \t]+words(?:[ \t]+in[ \t]+(?:her|his|their)[ \t]+retelling)?[ \t]+rather[ \t]+than[ \t]+a[ \t]+(?:condition|term|requirement)[ \t]+(?:she|he|they|the assistant)[ \t]+(?:verified|confirmed)`;
  const relay = String.raw`(?:[ \t]+only[ \t]+(?:conveys|relays)[ \t]+(?:this|the)[ \t]+(?:account|report)[ \t]+and|[ \t]+is[ \t]+only[ \t]+passing[ \t]+on[ \t]+this[ \t]+meaning,)?`;
  // One grammar owns both two- and three-predicate lists. Repeating an auxiliary requires
  // repeating its negation; a new actor or arbitrary continuation cannot inherit it.
  // Proper names establish no gender. Pronouns only constrain their own reflexive spelling.
  const actors = [
    [namedActor, '(?:herself|himself|itself|themself)'],
    ['[Ss]he', 'herself'],
    ['[Hh]e', 'himself'],
    ['I', 'myself'],
    ['(?:[Ww]e|[Tt]hey)', null],
  ] as const;
  return actors.some(([subject, reflexive]) => {
    const finalCheck = reflexive
      ? String.raw`(?:${finalPredicate}|${reflexive}[ \t]+${personalCheck})`
      : finalPredicate;
    const coordination = String.raw`(?:[ \t]+or[ \t]+${reportCheck}|,[ \t]+and[ \t]+${negativeAuxiliary}${reportCheck}|,[ \t]+${reportCheck},[ \t]+or[ \t]+${finalCheck})`;
    const pattern = new RegExp(
      String.raw`(?:^|[.;!])[ \t]*(?:[Tt]he[ \t]+report[ \t]+(?:says|states)[ \t]+(?:that[ \t]+)?)?${subject}(?:,[ \t]*${name},)?${relay}[ \t]+${negativeAuxiliary}${examination}${coordination}(?:${negativeExplanation}|${possibleContinuation}|${clarification})?(?=[ \t]*(?:$|[.!?;\n]))`,
      'u',
    );
    return pattern.test(unquoted);
  });
}
