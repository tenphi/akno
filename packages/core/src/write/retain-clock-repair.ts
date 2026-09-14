import { z } from 'zod';
import type { RetainSourceSpan } from '@tenphi/akno-protocol';
import { hasUnretractedClauseEnd } from '../memory/clause-ending.ts';

// Each branch fits the existing 400-unit sentence cap without truncation or borrowed allowance.
// eslint-disable-next-line no-control-regex -- Keep CR/LF/NUL visible to validation.
const completeSentence = /^[^\r\n\u0000]*[.!]$/u;
// Keep Unicode content mandatory locally; the provider rejects property escapes and lookaround.
const sentence = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(completeSentence)
    .refine((value) => /[\p{L}\p{N}]/u.test(value));
export const clockRepairFields = {
  proposition_and_nontemporal_scope: sentence(220),
  source_clock_anchor_and_unknown_date: sentence(110),
  unresolved_calendar_period: sentence(68),
};
export const excludedClockRepairFields = {
  proposition_and_nontemporal_scope: sentence(195),
  source_clock_anchor_and_unknown_date: sentence(90),
  excluded_reference_clocks: sentence(60),
  unresolved_calendar_period: sentence(52),
};
export type ClockTextRepair = {
  proposition_and_nontemporal_scope: string;
  source_clock_anchor_and_unknown_date: string;
  excluded_reference_clocks?: string;
  unresolved_calendar_period: string;
};
const fields = Object.keys(excludedClockRepairFields) as (keyof ClockTextRepair)[];
export function clockRepairText(value: ClockTextRepair): string {
  return fields.flatMap((key) => (value[key] === undefined ? [] : [value[key]!])).join(' ');
}
export function normalizeClockRepairTransaction(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('repairs' in value) || !Array.isArray(value.repairs))
    return value;
  return {
    ...value,
    repairs: value.repairs.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return entry;
      const record = { ...entry } as Record<string, unknown>;
      for (const key of fields)
        if (typeof record[key] === 'string')
          record[key] = record[key].replace(/^[ \t]+|[ \t]+$/gu, '').replace(/[ \t]+/gu, ' ');
      return record;
    }),
  };
}
export function clockRepairLanguageProse(value: unknown): string[] {
  value = normalizeClockRepairTransaction(value);
  if (!value || typeof value !== 'object' || !('repairs' in value) || !Array.isArray(value.repairs))
    return [];
  return value.repairs.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    return Object.keys(clockRepairFields).every((key) => typeof record[key] === 'string') &&
      (record.excluded_reference_clocks === undefined || typeof record.excluded_reference_clocks === 'string')
      ? [clockRepairText(record as ClockTextRepair)]
      : [];
  });
}

type ClockDefinition = {
  deictic: 'next' | 'last';
  period: 'day' | 'week' | 'month' | 'year';
  direction: 'after' | 'before';
};

/** Only a complete same-span source definition activates the narrow text repair. A draft, sibling
 * or interpretation cannot supply one missing clock dimension. Unfamiliar syntax uses full repair. */
export function sourceClockRepairWitness(frame: readonly RetainSourceSpan[]) {
  const definitions: { pattern: RegExp; clock: ClockDefinition }[] = [];
  for (const period of ['day', 'week', 'month', 'year'] as const)
    for (const [deictic, direction] of [
      ['next', 'after'],
      ['last', 'before'],
    ] as const) {
      const label = `${deictic}[ \\t]+${period}`;
      definitions.push({
        pattern: new RegExp(
          String.raw`^[ \t]*(?<unknown>(?:The[ \t]+)?original[ \t]+record['’]s[ \t]+date[ \t]+is[ \t]+unknown)\.[ \t]+(?<anchor>(?:“${label}”|"${label}"|${label})[ \t]+means[ \t]+the[ \t]+${period}[ \t]+${direction}[ \t]+this[ \t]+record)(?<excluded>,[ \t]+not[ \t]+${direction}[ \t]+processing)?\.[ \t]+(?<unresolved>The[ \t]+calendar[ \t]+${period}[ \t]+cannot[ \t]+be[ \t]+established)`,
          'dgiu',
        ),
        clock: { deictic, period, direction },
      });
    }
  for (const period of ['месяц', 'год'])
    for (const [deictic, direction] of [
      ['следующий', 'после'],
      ['прошлый', 'до'],
    ]) {
      const label = `${deictic}[ \\t]+${period}`;
      definitions.push({
        pattern: new RegExp(
          String.raw`^[ \t]*(?<unknown>Дата[ \t]+первоначальной[ \t]+записи[ \t]+неизвестна)\.[ \t]+(?<anchor>(?:«${label}»|“${label}”|"${label}"|${label})[ \t]+означает[ \t]+${period}[ \t]+${direction}[ \t]+этой[ \t]+записи)(?<excluded>,[ \t]+а[ \t]+не[ \t]+${direction}[ \t]+обработки)?\.[ \t]+(?<unresolved>Какой[ \t]+это[ \t]+календарный[ \t]+${period},[ \t]+установить[ \t]+невозможно)`,
          'dgiu',
        ),
        clock: {
          deictic: deictic === 'следующий' ? 'next' : 'last',
          period: period === 'месяц' ? 'month' : 'year',
          direction: direction === 'после' ? 'after' : 'before',
        },
      });
    }
  const witnesses = frame.flatMap((span, frame_index) =>
    definitions.flatMap(({ pattern, clock }) =>
      [...span.quote.matchAll(pattern)].flatMap((match) => {
        if (!hasUnretractedClauseEnd(span.quote, match.index + match[0].length)) return [];
        // These coordinates certify a complete source definition, not a safe-looking substring.
        // Unmatched framing, retraction or another clock would change which dimensions are owed.
        if (match.index !== 0 || !/^[ \t]*[.!]?[ \t]*$/u.test(span.quote.slice(match[0].length))) return [];
        const dimensions = Object.entries(match.indices!.groups!).flatMap(([dimension, range]) =>
          range
            ? [{ dimension, start: range[0], end: range[1], exact_excerpt: span.quote.slice(...range) }]
            : [],
        );
        return [
          {
            frame_index,
            clock,
            item_id: span.item_id ?? null,
            with_exclusion: Boolean(match.groups!.excluded),
            dimensions,
          },
        ];
      }),
    ),
  );
  // Duplicate proof spans may carry the same definition; distinct definitions are ambiguous.
  const distinct = new Map(
    witnesses.map((witness) => [
      JSON.stringify([
        witness.item_id,
        witness.dimensions.map(({ dimension, exact_excerpt }) => [dimension, exact_excerpt]),
      ]),
      witness,
    ]),
  );
  return distinct.size === 1 ? [...distinct.values()][0]! : null;
}
export type SourceClockRepairWitness = NonNullable<ReturnType<typeof sourceClockRepairWitness>>;

/** The same source-defined period must explicitly exclude processing as its reference.
 * This is a readability floor; the original source verifier still owns temporal entailment. */
export function hasReadableProcessingClockExclusion(
  text: string,
  witness: SourceClockRepairWitness,
): boolean {
  if (!witness.with_exclusion) return false;
  const { deictic, period, direction } = witness.clock;
  const englishLabel = String.raw`${deictic}[ \t]+${period}`;
  const russianPeriod = {
    day: { nominative: 'день', genitive: 'дня' },
    week: { nominative: 'неделя', genitive: 'недели' },
    month: { nominative: 'месяц', genitive: 'месяца' },
    year: { nominative: 'год', genitive: 'года' },
  }[period];
  const russianAdjective =
    period === 'week'
      ? {
          nominative: deictic === 'next' ? 'следующая' : 'прошлая',
          genitive: deictic === 'next' ? 'следующей' : 'прошлой',
        }
      : {
          nominative: deictic === 'next' ? 'следующий' : 'прошлый',
          genitive: deictic === 'next' ? 'следующего' : 'прошлого',
        };
  const russianLabel = String.raw`${russianAdjective.nominative}[ \t]+${russianPeriod.nominative}`;
  const russianGenitive = String.raw`${russianAdjective.genitive}[ \t]+${russianPeriod.genitive}`;
  const isolatedLabel = new RegExp(
    String.raw`^(?:${englishLabel}|${russianLabel}|${russianGenitive})$`,
    'iu',
  );
  const unquoted = text.replace(
    /`[^`]*`|«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
    (quote) => (isolatedLabel.test(quote.slice(1, -1)) ? quote.slice(1, -1) : '⟦quotation⟧'),
  );
  const sourceRecord = String.raw`(?:the[ \t]+)?(?:(?:original|undated|source)[ \t]+){0,2}(?:record|note)`;
  const processing = String.raw`(?:the[ \t]+)?(?:time[ \t]+of[ \t]+processing|processing(?:[ \t]+time)?)`;
  const patterns = [
    String.raw`processing[ \t]+time[ \t]+is[ \t]+not[ \t]+the[ \t]+(?:reference|origin|reference[ \t]+point)[ \t]+for[ \t]+${englishLabel}`,
    String.raw`${englishLabel}[ \t]+is[ \t]+not[ \t]+(?:counted|measured|reckoned)[ \t]+from[ \t]+${processing}`,
    String.raw`${englishLabel}[ \t]+means[ \t]+the[ \t]+${period}[ \t]+${direction}[ \t]+${sourceRecord},[ \t]+not[ \t]+(?:${direction}[ \t]+)?${processing}`,
    String.raw`${englishLabel}[ \t]+(?:refers[ \t]+to|is[ \t]+(?:counted|measured|reckoned)[ \t]+from)[ \t]+${sourceRecord},[ \t]+not[ \t]+${processing}`,
    String.raw`${russianLabel}[ \t]+не[ \t]+отсчитывается[ \t]+от[ \t]+(?:времени[ \t]+)?обработки`,
    String.raw`время[ \t]+обработки[ \t]+не[ \t]+зада[её]т[ \t]+отсч[её]т[ \t]+для[ \t]+${russianGenitive}`,
    String.raw`${russianLabel}[ \t]+отсчитывается[ \t]+от[ \t]+(?:времени[ \t]+)?(?:(?:исходной|первоначальной|недатированной)[ \t]+){0,2}записи,[ \t]+а[ \t]+не[ \t]+от[ \t]+(?:времени[ \t]+)?обработки`,
  ];
  return patterns.some((body) => {
    const pattern = new RegExp(String.raw`(?:^|[.;!])[ \t]*${body}`, 'giu');
    return [...unquoted.matchAll(pattern)].some((match) =>
      hasUnretractedClauseEnd(unquoted, match.index + match[0].length),
    );
  });
}

export const CLOCK_TEXT_REPAIR_CONTRACT = `For repair_contract.mode clock_text_only or clock_text_only_with_exclusion,
return only candidate_index and its required complete final-prose sentences. Preserve the actual proposition,
all named actors and separate nontemporal limits in proposition_and_nontemporal_scope. Explicitly state the
source-relative period/direction and unknown original source date in source_clock_anchor_and_unknown_date.
State that the calendar period cannot be established in unresolved_calendar_period. Only the exclusion arm
has excluded_reference_clocks: preserve the exact source-witnessed excluded processing clock; invent none.
Name clock_witness.clock's same deictic period in a closed reference exclusion, for example
"Processing time is not the reference for next month." A bare processing mention or chronology is not
a clock reference. Do not use an unresolved "the clock" pronoun in this field.
clock_witness lists exact candidate-owned source coordinates, not generated interpretation. Use the complete
original source too. Maximum UTF-16 lengths with exclusion are 195/90/60/52, with three joining spaces;
without exclusion they are 220/110/68, with two spaces. Every sentence must end in its own period or
exclamation mark, with no CR/LF/NUL, headings, examples or fragments. The model supplies every semantic byte;
all nontext fields are cloned unchanged. Omit the repair if these bounds cannot preserve the source. Full
local cleaning, language checking, original repair obligations and semantic verification still follow.`;
