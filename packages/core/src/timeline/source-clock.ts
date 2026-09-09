/** Bounded lexical floors; the complete cited block still requires semantic verification. */
export function hasDeicticTime(text: string): boolean {
  return /\b(?:today|tomorrow|yesterday|tonight|(?:next|last|this)\s+(?:day|week|month|year|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|сегодня|завтра|вчера|(?:следующ|прошл|эт[аоу]|нынешн)\p{L}*\s+(?:день|дня|дн[её]м|недел|месяц|год|году|утр|вечер)/iu.test(
    text,
  );
}

export function hasSourceRelativeAnchor(text: string): boolean {
  // A quoted deictic word can name the record's clock; a quoted example of an entire anchoring
  // sentence cannot supply it. Require the time expression as the subject of this new construction.
  const deictic = '(?:today|tomorrow|yesterday|tonight|(?:next|last|this)\\s+(?:day|week|month|year))';
  let unquoted = text;
  for (const quotation of [
    /`([^`\n]*)`/gu,
    /«([^»]*)»/gu,
    /“([^”]*)”/gu,
    /"([^"\n]*)"/gu,
    /‘([^’]*)’/gu,
    /(?<![\p{L}\p{N}])'([^'\n]*)'(?![\p{L}\p{N}])/gu,
  ]) {
    unquoted = unquoted.replace(quotation, (_span, content: string) =>
      new RegExp(`^${deictic}$`, 'iu').test(content) ? content : ' ',
    );
  }
  if (
    new RegExp(
      `\\b${deictic}\\s+(?:(?:is|was|being|should be|must be|to be)\\s+)?understood from\\s+(?:(?:the )?(?:moment|time|date) of\\s+)?(?:the |that |this |an? )?(?:(?:original|undated) ){0,2}(?:source (?:record|note)|record|note)\\b(?=\\s*(?:$|[.,;:!?]|rather than|whose))`,
      'iu',
    ).test(unquoted)
  )
    return true;

  const russianDeictic =
    '(?:сегодня|завтра|вчера|(?:следующий|прошлый|этот)\\s+(?:день|месяц|год)|(?:следующая|прошлая|эта)\\s+неделя)';
  const clockLabel = `(?:${deictic}|${russianDeictic})`;
  // Only a quoted clock label can participate in this assertion. Mask other quotations with
  // a separator that cannot splice an omitted negation/example into a live clock assertion.
  const sourceTimeProse = text.replace(
    /`[^`\n]*`|«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    (span) => {
      const content = span.slice(1, -1);
      return new RegExp(`^${clockLabel}$`, 'iu').test(content) ? content : '⟦quotation⟧';
    },
  );
  // The time belongs to the source record, not to a nearby device or processing event.
  // A question, condition or correction cannot close this assertion. The one allowed comma
  // contrast denies today's and processing clocks, optionally followed by a closed unknown date.
  // Start a clause as well: an embedded label after "not", "allegedly" or an example is not asserted.
  const sourceTimeEnd = '(?:$|[.;!])';
  const unknownDate =
    '(?:точн(?:ый|ую)\\s+)?(?:календарный\\s+(?:год|месяц|день)|календарную\\s+дату)\\s+восстановить\\s+нельзя';
  const sourceTimeContrast = `,\\s+а\\s+не\\s+от\\s+сегодняшнего\\s+дня\\s+или\\s+(?:от\\s+)?(?:времени|момента)\\s+обработки(?:,\\s+и\\s+${unknownDate})?(?=\\s*${sourceTimeEnd})`;
  if (
    new RegExp(
      `(?:^|[.;!])\\s*${clockLabel}\\s+(?:отсчитывается|считается)\\s+от\\s+времени\\s+(?:(?:той|этой|исходн(?:ой|ого)|оригинальн(?:ой|ого)|недатированн(?:ой|ого))\\s+){0,2}(?:записи|заметки|источника|разговора)(?=\\s*(?:${sourceTimeEnd}|${sourceTimeContrast}))`,
      'iu',
    ).test(sourceTimeProse)
  )
    return true;

  if (hasUndatedOriginalClock(text)) return true;

  // The intensifier qualifies the source noun, not a new clock or the proposed action.
  if (
    /(?<!\p{L})(?:отсчитыва\p{L}*|считая|отсчит\p{L}*)\s+от\s+самой\s+(?:(?:недатированной|исходной|оригинальной)\s+){0,2}(?:записи|заметки)(?!\p{L})/iu.test(
      text,
    )
  )
    return true;
  return /\bsource-relative\b|\b(?:day|week|month|year) (?:after|before) (?:the )?(?:undated |original ){0,2}(?:source|record(?:ing)?|note|conversation)\b|\b(?:relative to |refers? to |(?:measured|counted|reckoned) from )(?:(?:the )?(?:moment|time|date) of )?(?:the |that |this |an? )?(?:(?:original|undated) ){0,2}(?:source|record(?:ing)?|note|conversation)\b|\b(?:(?:original|undated) ){0,2}(?:source|record(?:ing)?|note|conversation)['’]s\s+["“‘']?(?:today|tomorrow|yesterday|tonight|next |last |this )|(?:день|дня|дн[её]м|недел\p{L}*|месяц\p{L}*|год\p{L}*)\s+(?:после|до)\s+(?:(?:исходн|оригинальн|недатированн)\p{L}*\s+){0,2}(?:источник|запис|замет|разговор)|(?:относительно|по отношению к)\s+(?:(?:дат|момент)\p{L}*\s+)?(?:(?:исходн|оригинальн|недатированн)\p{L}*\s+){0,2}(?:источник|запис|замет|разговор)|(?:относ\p{L}*\s+к|(?:отсчитыва\p{L}*|считая)\s+(?:его\s+)?от|отсчит\p{L}*\s+от)\s+(?:момент\p{L}*\s+|дат\p{L}*\s+)?(?:(?:той|этой|исходн\p{L}*|оригинальн\p{L}*|недатированн\p{L}*)\s+){0,2}(?:источник|запис|замет|разговор)|\b(?:calendar (?:date|day|week|month|year)|reference date)[^.!?;\n]{0,50}\bunknown\s+because\s+(?:the |that |this |an? )?(?:(?:original|source) ){0,2}(?:source|record(?:ing)?|note|conversation)\s+(?:(?:is|was) undated|(?:has|had) no date)\b|(?:календарн\p{L}*\s+(?:дат\p{L}*|день|месяц|год))[^.!?;\n]{0,50}(?:неизвест\p{L}*|не указан\p{L}*)[, ]+(?:поскольку|так как)\s+(?:(?:исходн|оригинальн)\p{L}*\s+)?(?:источник|запис|замет)\p{L}*\s+(?:не датирован\p{L}*|без даты)|относительн\p{L}*\s+(?:время|срок)\s+из\s+недатирован\p{L}*\s+(?:источник|запис|замет)|(?:записан\p{L}*|зафиксирован\p{L}*)\s+в\s+(?:источник|запис|замет)\p{L}*\s+без даты/iu.test(
    text,
  );
}

export function hasUnknownReferenceClock(text: string): boolean {
  if (hasUndatedOriginalClock(text)) return true;
  // "Установить" can mean establish a date or install a component. Require a directly bound
  // date head in this branch; a nearby calendar word or a quoted example cannot supply it.
  const deictic = '(?:today|tomorrow|yesterday|tonight|(?:next|last|this)\\s+(?:day|week|month|year))';
  const unquoted = text.replace(
    /`[^`\n]*`|«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    (span) => {
      const content = span.slice(1, -1);
      return new RegExp(`^${deictic}$`, 'iu').test(content) ? content : ' ';
    },
  );
  // A comma may introduce a permission condition or reversal. Only the closed clock contrast
  // continues this admission; quoting its bare deictic label does not quote the whole assertion.
  const clockContrast = `,\\s+а\\s+${deictic}\\s+относится\\s+не\\s+к\\s+сегодняшнему\\s+дню\\s+и\\s+не\\s+к\\s+моменту\\s+обработки(?=\\s*(?:$|[.;!?]))`;
  if (
    new RegExp(
      `(?<!\\p{L})(?:дат(?:а|у|ы|е|ой)|календарн\\p{L}*\\s+(?:день|месяц|год))\\s+установить\\s+нельзя(?!\\p{L})(?=\\s*(?:$|[.;!?]|${clockContrast}))`,
      'iu',
    ).test(unquoted)
  )
    return true;
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

/** The original-record synonym must preserve both attachment and the explicitly absent source date. */
function hasUndatedOriginalClock(text: string): boolean {
  const label = String.raw`(?:следующий|прошлый|этот)[ \t]+(?:год|месяц)|(?:следующая|прошлая|эта)[ \t]+неделя`;
  const unquoted = text.replace(
    /`[^`]*`|«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    (span) =>
      new RegExp(`^(?:${label})$`, 'iu').test(span.slice(1, -1)) ? span.slice(1, -1) : '⟦quotation⟧',
  );
  const interval = String.raw`(?:в[ \t]+(?:следующем|прошлом|этом)[ \t]+(?:году|месяце)|на[ \t]+(?:следующей|прошлой|этой)[ \t]+неделе)[ \t]+относительно|(?:${label})[ \t]+(?:отсчитывается|считается)[ \t]+от(?:[ \t]+времени)?`;
  const original = String.raw`(?:первоначальной[ \t]+записи[ \t]+без[ \t]+даты|недатированной[ \t]+первоначальной[ \t]+записи)`;
  // A separate refusal of a plan does not retract its source clock; arbitrary continuations may.
  const denial = String.raw`,[ \t]+но[ \t]+не[ \t]+принял[аи]?[ \t]+план[ \t]+и[ \t]+не[ \t]+организовал[аи]?[ \t]+встречу(?=[ \t]*(?:$|[.;!]))`;
  const pattern = new RegExp(
    String.raw`(?<![\p{L}])(?:${interval})[ \t]+${original}(?=[ \t]*(?:$|[.;!]|${denial}))`,
    'giu',
  );
  return [...unquoted.matchAll(pattern)].some((match) => {
    const prefix = unquoted
      .slice(0, match.index)
      .split(/[.!?;\n]/u)
      .at(-1)!;
    return !/(?<![\p{L}])(?:якобы|пример|если)(?![\p{L}])|(?<![\p{L}])не[ \t]*$/iu.test(prefix);
  });
}
