/** Hold a bounded Russian repair-as-coverer inversion against repair-as-covered source prose. */
export function coverageRolesSupported(text: string, support: string): boolean {
  // This floor recognizes one role reversal, not arbitrary Russian grammar. Quoted examples and
  // separate clauses must not supply a predicate's subject or instrument; full semantics still apply.
  const clauses = (value: string) =>
    value
      .replace(
        /«[^»]*»|“[^”]*”|"[^"\n]*"|`[^`\n]*`|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
        ' ',
      )
      .split(/[.!?;:\n]|,(?:\s*(?:а|но|и|тогда как|пока)(?![\p{L}]))/iu);
  const sourceClauses = clauses(support);
  const coveredRepair =
    /\brepair\s+(?:(?:is|was|may be|might be|would be|can be|could be|must be)\s+)?covered\b|(?<![\p{L}])ремонт\s+(?:[\p{L}-]+\s+){0,5}(?:покрывается|покрыт)(?![\p{L}])|(?<![\p{L}])(?:покрывается|покрыт)\s+(?:ли\s+)?(?:гарантией\s+)?ремонт(?![\p{L}])/iu;
  if (!sourceClauses.some((clause) => coveredRepair.test(clause))) return true;
  // A source may independently say that a repair covers another repair/cost. In that case the
  // full verifier must pair the propositions; a presence floor cannot resolve that ambiguity.
  const repairCoverer =
    /\brepair\s+(?:(?:itself|also|may|might|can|could|would|will)\s+){0,2}covers?\b|(?<![\p{L}])ремонт\s+(?:сам\s+)?покрывает(?![\p{L}])|(?<![\p{L}])(?:покрывается|покрыт\p{L}*)\s+(?:[\p{L}-]+\s+){0,5}ремонтом(?![\p{L}])/iu;
  if (sourceClauses.some((clause) => repairCoverer.test(clause))) return true;
  // In the same unresolved-coverage clause, instrumental 'ремонтом' makes repair the coverer
  // regardless of whether the following object is itself another repair or a component. Do not
  // borrow uncertainty from another sentence, or activate on a quoted grammatical example.
  const unresolvedInstrument =
    /(?<![\p{L}])(?:не\s+(?:определя|устанавлива|позволя)[\p{L}]*|неизвестно)[^.!?;:\n]{0,100}(?<![\p{L}])покрывается\s+ли\s+ремонтом\s+[\p{L}]/iu;
  return !clauses(text).some(
    (clause) =>
      unresolvedInstrument.test(clause) ||
      /(?<![\p{L}])покрывается\s+(?:ли\s+)?ремонтом\s+(?:[\p{L}-]+\s+){0,5}ремонт(?![\p{L}])/iu.test(clause),
  );
}
