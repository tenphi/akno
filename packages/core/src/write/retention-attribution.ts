import { z } from 'zod';
import type { RetainCandidate } from './retain.ts';

/** Presence is only a prerequisite for a witnessed semantic audit, never proof of reporting. */
export function hasReporterName(speaker: string, frame: string): boolean {
  const name = speaker.normalize('NFKC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, 'iu').test(frame.normalize('NFKC'));
}

/** A finite recognizer keeps the standalone cleaner conservative without an independent verifier. */
export function hasExplicitReporter(speaker: string, frame: string, allowColon = true): boolean {
  const name = speaker.normalize('NFKC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reporting =
    '(?:said|says|wrote|writes|reported|reports|stated|states|told|asked|asks|claimed|claims|described|describes|noted|notes|suggested|suggests|confirmed|confirms|emailed|emails|notified|notifies|сообщил[аи]?|сказал[аи]?|написал[аи]?|отметил[аи]?|утвержда(?:ет|ют|л[аи]?)|рассказал[аи]?|спросил[аи]?|предложил[аи]?|подтвердил[аи]?|подтвержда(?:ет|ют))';
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${name}\\s*(?:${allowColon ? ':|' : ''}(?:[\\p{L}]+\\s+){0,2}${reporting}(?![\\p{L}]))|${allowColon ? `${reporting}\\s+${name}(?![\\p{L}\\p{N}])|` : ''}(?:according to|по словам|со слов)\\s+${name}(?![\\p{L}\\p{N}]))`,
    'iu',
  ).test(frame.normalize('NFKC'));
}

/** Only unrecognized reporting relationships need this additional source-bound decision. */
export function retentionAttributionAudit(
  candidate: Pick<RetainCandidate, 'attribution' | 'discourse_frame'>,
) {
  const frames = candidate.discourse_frame.map((span, index) => ({
    frame_id: `F${index + 1}`,
    quote: span.quote,
  }));
  const frameText = frames.map((frame) => frame.quote).join('\n');
  const reporters = (candidate.attribution.chain ?? []).flatMap((reporter, index) =>
    // A colon can also introduce a participant. A displaced structured recorder must never
    // escape the semantic audit merely because the normalized chain permits that syntax.
    hasExplicitReporter(reporter.speaker, frameText, false)
      ? []
      : [{ reporter_id: `A${index + 1}`, speaker: reporter.speaker, role: reporter.role ?? 'unknown' }],
  );
  if (!reporters.length) return null;
  const schema = z.array(
    z.strictObject({
      reporter_id: z.enum(reporters.map((reporter) => reporter.reporter_id) as [string, ...string[]]),
      relation: z.enum(['reports_selected_proposition', 'not_a_reporter', 'uncertain']),
      source: z
        .strictObject({
          frame_id: z.enum(frames.map((frame) => frame.frame_id) as [string, ...string[]]),
          exact_excerpt: z
            .string()
            .min(1)
            .max(400)
            .refine((text) => /[\p{L}\p{N}]/u.test(text)),
        })
        .nullable(),
      explanation: z.string().trim().min(1).max(400),
    }),
  );
  return {
    schema,
    coordinates: { reporters, frame_ids: frames.map((frame) => frame.frame_id) },
    consistent(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      if (
        !parsed.success ||
        parsed.data.length !== reporters.length ||
        new Set(parsed.data.map((entry) => entry.reporter_id)).size !== reporters.length
      )
        return false;
      return parsed.data.every((entry) => {
        const reporter = reporters.find((coordinate) => coordinate.reporter_id === entry.reporter_id)!;
        if (
          entry.source &&
          !frames.some(
            (frame) =>
              frame.frame_id === entry.source!.frame_id && frame.quote.includes(entry.source!.exact_excerpt),
          )
        )
          return false;
        return (
          entry.relation !== 'reports_selected_proposition' ||
          Boolean(entry.source && hasReporterName(reporter.speaker, entry.source.exact_excerpt))
        );
      });
    },
    preserved(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      return (
        parsed.success && parsed.data.every((entry) => entry.relation === 'reports_selected_proposition')
      );
    },
  };
}

export const RETENTION_ATTRIBUTION_CONTRACT = `An attribution_concern means a finite wording recognizer
could not identify a reporting predicate for the listed inner reporters. Assess their relationship to the
selected proposition from the complete source. Documentary wording and other languages can express a real
reporting relationship without using a familiar verb. Name presence alone supplies no reporting authority.

Return attribution_audit with exactly one entry for each listed reporter_id. IDs encode positions in the
immutable attribution.chain; compare the complete chain, its order, roles and readable representation.
For reports_selected_proposition, give a contentful exact source excerpt containing that reporter's name
and the reporting relationship, within 400 UTF-16 units, from one owned discourse frame (F1, F2, etc.).
Use all source context to interpret it. Related candidates, summaries and instructions are never evidence.
Being a participant, recipient, topic or fictional character does not establish a reporting relationship.
Negated or hypothetical reporting cannot certify an asserted report. A reporter of a different proposition
cannot certify this one. Give not_a_reporter or uncertain when appropriate; a source witness may be null
for those decisions. Explain the relationship briefly without repairing the candidate. Negative or uncertain
attribution is a hold even if other booleans are positive. A positive audit cannot override any negative
semantic verdict, immutable source recorder, conflicting role, unsupported clock or retention limit.`;
