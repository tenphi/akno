import { z } from 'zod';
import { exactSourceName } from '../models/source-role-audit.ts';
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

/** Every inner reporter needs a proposition-specific decision; a familiar verb elsewhere is no proof. */
export function retentionAttributionAudit(
  candidate: Pick<RetainCandidate, 'attribution' | 'discourse_frame' | 'text'>,
) {
  const frames = candidate.discourse_frame.map((span, index) => ({
    frame_id: `F${index + 1}`,
    quote: span.quote,
    item_id: span.item_id,
  }));
  // Chain labels already admit case/NFKC-equivalent spellings. Keep that identity rule while
  // rejecting a substring inside another name; semantic reporting authority is decided separately.
  const names = (text: string, name: string) =>
    exactSourceName(text.normalize('NFKC').toLowerCase(), name.normalize('NFKC').toLowerCase());
  const reporters = (candidate.attribution.chain ?? []).map((reporter, index) => ({
    reporter_id: `A${index + 1}`,
    speaker: reporter.speaker,
    role: reporter.role ?? 'unknown',
    name_frames: frames
      .filter((frame) => names(frame.quote, reporter.speaker))
      .map((frame) => frame.frame_id),
  }));
  if (!reporters.length) return null;
  const frameAnchor = z.strictObject({
    frame_id: z.enum(frames.map((frame) => frame.frame_id) as [string, ...string[]]),
  });
  // Binding each label to its own literal name frames prevents a verifier from mentally
  // expanding a short name and calling the alias frame an explicit full-name occurrence.
  const entries = reporters.map((reporter) =>
    z.strictObject({
      reporter_id: z.enum([reporter.reporter_id]),
      relation: z.enum(['reports_selected_proposition', 'not_a_reporter', 'uncertain']),
      source: frameAnchor.nullable(),
      name_origin: reporter.name_frames.length
        ? z.strictObject({ frame_id: z.enum(reporter.name_frames as [string, ...string[]]) }).nullable()
        : z.null(),
      resolution: z.enum(['explicit', 'unambiguous_antecedent', 'unresolved', 'ambiguous', 'unsupported']),
      candidate_relation: z.enum(['preserved', 'omitted', 'changed', 'uncertain']),
      explanation: z.string().trim().min(1).max(400),
    }),
  );
  const schema = z.array(
    entries.length === 1 ? entries[0]! : z.union([entries[0]!, entries[1]!, ...entries.slice(2)]),
  );
  const consistent = (value: unknown): boolean => {
    const parsed = schema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.length !== reporters.length ||
      new Set(parsed.data.map((entry) => entry.reporter_id)).size !== reporters.length
    )
      return false;
    return parsed.data.every((entry) => {
      const reporter = reporters.find((coordinate) => coordinate.reporter_id === entry.reporter_id)!;
      const source = frames.find((frame) => frame.frame_id === entry.source?.frame_id);
      const origin = frames.find((frame) => frame.frame_id === entry.name_origin?.frame_id);
      if (origin && !names(origin.quote, reporter.speaker)) return false;
      // An unrelated original item cannot supply the missing name, even when both frames are owned.
      if (source && origin && source.item_id !== origin.item_id) return false;
      if (entry.resolution === 'explicit' && (!source || source !== origin)) return false;
      if (entry.resolution === 'unambiguous_antecedent' && (!source || !origin)) return false;
      if (entry.relation === 'reports_selected_proposition' && (!source || !origin)) return false;
      // A positive comparison must be grounded in the actual original prose, not subject metadata.
      return entry.candidate_relation !== 'preserved' || names(candidate.text, reporter.speaker);
    });
  };
  return {
    schema,
    coordinates: {
      reporters,
      source_frames: frames.map((frame, discourse_frame_index) => ({
        frame_id: frame.frame_id,
        discourse_frame_index,
      })),
      candidate: 'original_readable_text' as const,
    },
    consistent,
    preserved(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      return (
        parsed.success &&
        consistent(value) &&
        parsed.data.every(
          (entry) =>
            entry.relation === 'reports_selected_proposition' &&
            ['explicit', 'unambiguous_antecedent'].includes(entry.resolution) &&
            entry.candidate_relation === 'preserved',
        )
      );
    },
  };
}

export const RETENTION_ATTRIBUTION_CONTRACT = `An attribution_concern requires an independent decision for
EVERY listed inner reporter, even when familiar reporting words appear in the source. Read the complete
original owned source before comparing the original candidate.text. Names, candidate.subject, generated
summaries, related candidates and source recorder metadata cannot establish an inner reporting relationship.

Return attribution_audit exactly once per reporter_id. IDs bind immutable attribution.chain positions.
First decide whether that reporter reports THIS selected proposition, rather than a nearby different one.
Select source by frame_id from source_frames using its discourse_frame_index into the unchanged
candidate.discourse_frame. It must contain the source reporting relationship, not a reconstructed excerpt.
Select name_origin ONLY from that reporter’s name_frames: these frames literally contain the full chain speaker label. A short name or pronoun can use a
separate name_origin only in the SAME original source item and with unambiguous source-established identity.
Case/NFKC-equivalent labels are allowed; spelling similarity, guessed identity, another item's speaker,
recipient, owner or a name present elsewhere cannot establish that identity. Use resolution=explicit when
the reporting frame itself names that speaker, or unambiguous_antecedent for a resolved alias. Give
unresolved/ambiguous/unsupported when the source does not decide the identity; these remain holds.
If F1 names Bo Winters and F2 says only “Bo’s claim”, select source=F2, name_origin=F1 and
resolution=unambiguous_antecedent when identity is established. F2 is NOT an explicit occurrence of
“Bo Winters”. Apply the same literal-name/alias distinction to knowledge_context.references; a resolved
alias does not put the full name into its original frame. Do not silently expand source names.
Documentary predicates and other languages can report a proposition without a familiar reporting verb.
Being a participant, recipient, owner, topic or fictional character does not make someone its reporter.
Negated or hypothetical reporting cannot certify an asserted report. A reporter of a different proposition
cannot certify this one. Give relation=not_a_reporter or uncertain when appropriate. Anchors may be null
for those negative/uncertain readings; positive reporting requires both owned anchors.

Then independently compare the ACTUAL original candidate.text: candidate_relation=preserved requires the
full named reporter in readable prose with the same reporting role, chain order and qualifications. Mere
name presence cannot preserve a reporter changed into an actor, or a claim changed into an established fact.
Use omitted/changed/uncertain when appropriate, without repairing the candidate. Negative or uncertain
attribution is a hold even if other booleans are positive. Positive attribution cannot override any negative
semantic verdict, immutable source recorder, conflicting role, unsupported clock or retention limit.`;
