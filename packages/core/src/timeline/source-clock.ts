/** Bounded lexical floors; the complete cited block still requires semantic verification. */
export function hasDeicticTime(text: string): boolean {
  return /\b(?:today|tomorrow|yesterday|tonight|(?:next|last|this)\s+(?:day|week|month|year|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|сегодня|завтра|вчера|(?:следующ|прошл|эт[аоу]|нынешн)\p{L}*\s+(?:день|дня|дн[её]м|недел|месяц|год|году|утр|вечер)/iu.test(
    text,
  );
}

export function hasSourceRelativeAnchor(text: string): boolean {
  return /\bsource-relative\b|\b(?:day|week|month|year) (?:after|before) (?:the )?(?:undated |original ){0,2}(?:source|record(?:ing)?|note|conversation)\b|\b(?:relative to |refers? to |(?:measured|counted|reckoned) from )(?:(?:the )?(?:moment|time|date) of )?(?:the |that |this |an? )?(?:(?:original|undated) ){0,2}(?:source|record(?:ing)?|note|conversation)\b|\b(?:(?:original|undated) ){0,2}(?:source|record(?:ing)?|note|conversation)['’]s\s+["“‘']?(?:today|tomorrow|yesterday|tonight|next |last |this )|(?:день|дня|дн[её]м|недел\p{L}*|месяц\p{L}*|год\p{L}*)\s+(?:после|до)\s+(?:(?:исходн|оригинальн|недатированн)\p{L}*\s+){0,2}(?:источник|запис|замет|разговор)|(?:относительно|по отношению к)\s+(?:(?:дат|момент)\p{L}*\s+)?(?:(?:исходн|оригинальн|недатированн)\p{L}*\s+){0,2}(?:источник|запис|замет|разговор)|(?:относ\p{L}*\s+к|(?:отсчитыва\p{L}*|считая)\s+(?:его\s+)?от|отсчит\p{L}*\s+от)\s+(?:момент\p{L}*\s+|дат\p{L}*\s+)?(?:(?:той|этой|исходн\p{L}*|оригинальн\p{L}*|недатированн\p{L}*)\s+){0,2}(?:источник|запис|замет|разговор)|\b(?:calendar (?:date|day|week|month|year)|reference date)[^.!?;\n]{0,50}\bunknown\s+because\s+(?:the |that |this |an? )?(?:(?:original|source) ){0,2}(?:source|record(?:ing)?|note|conversation)\s+(?:(?:is|was) undated|(?:has|had) no date)\b|(?:календарн\p{L}*\s+(?:дат\p{L}*|день|месяц|год))[^.!?;\n]{0,50}(?:неизвест\p{L}*|не указан\p{L}*)[, ]+(?:поскольку|так как)\s+(?:(?:исходн|оригинальн)\p{L}*\s+)?(?:источник|запис|замет)\p{L}*\s+(?:не датирован\p{L}*|без даты)|относительн\p{L}*\s+(?:время|срок)\s+из\s+недатирован\p{L}*\s+(?:источник|запис|замет)|(?:записан\p{L}*|зафиксирован\p{L}*)\s+в\s+(?:источник|запис|замет)\p{L}*\s+без даты/iu.test(
    text,
  );
}

export function hasUnknownReferenceClock(text: string): boolean {
  // Keep the absent date attached to a source noun; an unknown device attribute is not a source clock.
  if (
    /(?<!\p{L})(?:источник|запис|замет|разговор)\p{L}*\s+(?:без\s+(?:(?:известн|календарн)\p{L}*\s+){1,2}даты|с\s+неизвестной\s+календарной\s+датой(?=\s*(?:$|[.,;!?])))(?!\p{L})/iu.test(
      text,
    )
  )
    return true;
  return /\bundated (?:(?:original|source) )?(?:source|record(?:ing)?|note|conversation)\b|\b(?:source|record(?:ing)?|note|conversation) (?:is|was) undated\b|\b(?:source|record(?:ing)?|note|conversation) (?:has|had) no (?:reference )?(?:date|timestamp)\b|у\s+(?:(?:исходн|оригинальн|недатированн)\p{L}*\s+)?(?:источник|запис|замет|разговор)\p{L}*\s+нет\s+дат\p{L}*|дат\p{L}*\s+(?:(?:исходн|оригинальн)\p{L}*\s+)?(?:источник|запис|замет|разговор)\p{L}*\s+отсутствует|недатирован\p{L}*\s+(?:(?:исходн|оригинальн)\p{L}*\s+)?(?:источник|запис|замет|разговор)|\b(?:dates?|clocks?|timestamps?|calendar (?:day|week|month|year))[^.!?;\n]{0,60}\b(?:unknown|unspecified|unavailable|not (?:provided|recorded|known)|(?:cannot|could not|can['’]t|couldn['’]t) be (?:recovered|resolved|determined))\b|\b(?:unknown|unspecified|unavailable) (?:(?:original|source|reference|calendar) ){0,3}(?:dates?|clocks?|timestamps?)\b|(?:дат\p{L}*|календарн\p{L}*\s+(?:день|месяц|год))[^.!?;\n]{0,60}(?:неизвест|не указан|утрачен|восстановить нельзя|невозможно восстановить|определить нельзя)|(?:источник|запис|замет|разговор)\p{L}*\s+(?:не датирован\p{L}*|без даты)|\b(?:source|record(?:ing)?|note|conversation)\s+with no date\b|\bcalendar (?:month|week|year)\s+(?:is |was |remains )?(?:unknown|unspecified)\b/iu.test(
    text,
  );
}
