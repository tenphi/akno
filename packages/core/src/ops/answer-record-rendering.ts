import { z } from 'zod';
import type { AnswerContextItem } from '@tenphi/akno-protocol';
import type { OutputLanguage } from '../models/language.ts';
import {
  hasDeicticTime,
  hasSourceRelativeAnchor,
  hasUnknownReferenceClock,
} from '../timeline/source-clock.ts';

export interface AnswerRecordRendering {
  evidence_id: string;
  text: string;
  copy_allowed?: false;
  source_clock_translation?: true;
}

/** A single bound record permits preservation without guessing its current language from old policy. */
export function answerRecordRendering(
  evidence: readonly AnswerContextItem[],
  frames: ReadonlyMap<string, string>,
  language: OutputLanguage | null,
  knowledgeLanguage: OutputLanguage | null = null,
): AnswerRecordRendering | undefined {
  if (!language || evidence.length !== 1 || frames.size !== 1) return undefined;
  const item = evidence[0]!;
  if (
    item.type !== 'page' ||
    item.lines.length !== 1 ||
    item.lines[0]!.memory?.status !== 'qualified' ||
    !frames.has(item.evidence_id)
  )
    return undefined;
  // Match the ordinary answer renderer's boundary trim before language and support verification.
  // Visible qualification labels and all interior text remain exact.
  const text = item.lines[0]!.text.replace(/^[-*] /u, '').trim();
  if (!text.trim() || text.length > 600) return undefined;
  // Copying an embedded citation/link would let payload text impersonate server-owned citations.
  // Leave reference-bearing records to the existing composition path, which selects their prose.
  if (/\[|<(?:\/?[A-Za-z]|!)/u.test(text)) return undefined;
  return {
    evidence_id: item.evidence_id,
    text,
    // Policy does not prove the language of old bytes. This only removes a shortcut; a translation
    // can preserve already-localized prose and still must pass actual language and source checks.
    ...(knowledgeLanguage && language !== knowledgeLanguage ? { copy_allowed: false as const } : {}),
    // Match the readable-clock obligation enforced downstream. A private frame or unknown
    // metadata alone cannot authorize an extra source-clock statement in generated prose.
    ...(language === 'ru' &&
    item.lines[0]!.memory.temporal?.time.precision === 'unknown' &&
    hasDeicticTime(text) &&
    hasSourceRelativeAnchor(text) &&
    hasUnknownReferenceClock(text)
      ? { source_clock_translation: true as const }
      : {}),
  };
}

export function answerRecordBlockSchema(record: AnswerRecordRendering) {
  const evidence_ids = z.array(z.enum([record.evidence_id])).length(1);
  const translation = record.source_clock_translation
    ? z.strictObject({
        rendering_mode: z.enum(['translate']),
        translated_record: z.strictObject({
          // These fields and two joining spaces share the previous 2,000-character text cap.
          proposition_and_nontemporal_scope: z.string().trim().min(1).max(1_200),
          source_clock_anchor: z.string().trim().min(1).max(400),
          remaining_clock_qualifications: z.string().trim().min(1).max(398),
        }),
        evidence_ids,
      })
    : z.strictObject({
        rendering_mode: z.enum(['translate']),
        text: z.string().trim().min(1).max(2_000),
        evidence_ids,
      });
  if (record.copy_allowed === false) return translation;
  // Ordinary anyOf, not a discriminated oneOf, is supported by the existing provider contract.
  return z.union([
    z.strictObject({
      rendering_mode: z.enum(['copy']),
      evidence_ids,
    }),
    translation,
  ]);
}

/** Concatenation adds no semantic content; the exact result still needs language and source checks. */
export function answerRecordText(
  block:
    | { text: string }
    | { rendering_mode: 'copy' }
    | {
        translated_record: {
          proposition_and_nontemporal_scope: string;
          source_clock_anchor: string;
          remaining_clock_qualifications: string;
        };
      },
  record?: AnswerRecordRendering,
): string {
  if ('text' in block) return block.text;
  if ('translated_record' in block) {
    const clauses = block.translated_record;
    return [
      clauses.proposition_and_nontemporal_scope,
      clauses.source_clock_anchor,
      clauses.remaining_clock_qualifications,
    ].join(' ');
  }
  return record!.text;
}

export const ANSWER_RECORD_RENDERING_CONTRACT = `When complete_record_rendering is supplied, select that
single retained record only if it answers the question. Return at most one block. Choose rendering_mode
translate when copy_allowed is false; the policy disables copying without classifying the stored bytes.
Otherwise choose rendering_mode
copy when its readable prose already uses output_language; return only that mode and evidence_ids,
without a text field. The server will supply the exact current readable text. Otherwise
choose translate and translate the COMPLETE retained text into output_language. Check the language of the COMPLETE current readable text, including visible status and attribution
labels, not the query or private frame. Translate whenever any readable label needs localization.
A Russian target with English retained prose requires translate, even when the source frame is Russian.
The mode is a generation
choice, not a trusted language classification; both copied and translated text undergo all existing checks.

Preserve every retained clause, including the complete actor chain, personal limits, conditional
consequences, negation and scope. Do not summarize, shorten, add an introduction, answer a presupposition
from the question, or import a recording/action detail from the private original frame. The whole retained
record is the rendering unit here; unrelated material in its private frame remains unavailable. The frame
only constrains interpretation, including explicit bilingual clarification. A conflict requires withholding
the block, not correcting or expanding the record. If it cannot answer the question, return no blocks.

In translations, proper names keep their exact source spelling: do not transliterate them. After
translating the surrounding prose, copy each required named_source_reference.exact_spelling verbatim
into its source-supported role in the final text. Never introduce a name or role absent from the record. Translate
ordinary vocabulary and generic role labels, including every part of a hyphenated component description.
Translate the complete compound by its source meaning; do not leave an English fragment beside a
translated noun. A technical test selects both an object and a tested property: naming only the object
and generic soundness loses the specific test. Keep the source-stated property explicit in target-language
prose. Do not add a property when the source only names an unspecified check or measurement.
If translating a visible report heading, use that record's supplied report_source_display_phrase exactly
for its outer attribution. Keep any other supported status labels localized. This phrase cannot replace
the inner speaker or an embedded action's actor, and cannot add an unretained reporting or recording act.
For nested reports, make the outer source and inner speaker
unambiguous: use 'According to OUTER, INNER said ...' or 'По словам OUTER, INNER сообщил ...'. Do not swap
their roles or rely on an ambiguous recipient/possessive construction with an indeclinable name. Render
the supported meaning in full even when the question requests only part of that record.
A bilingual restatement that fixes a term's referent controls its translation: render that same referent
throughout, without inventing two components or alternative services from two source-language wordings.
Do not specialize an unspecified measurement by choosing its measured property. Keep coverage arguments
in their source roles: a covered repair is not a repair that covers the component. For an unresolved
repair-coverage question in Russian, a nominal relation such as «вопрос о покрытии ремонта» followed
by the component in the genitive case preserves the repair object. Preserve the record's actual nonresolution
predicate and scope, and supply a coverer only when the selected source names one.

When translating a retained counterfactual into Russian, render its actual selected antecedent with
an explicit «если бы» conditional and its consequence with a subjunctive «бы». State the retained
nonoccurrence and not-current limit in separate complete clauses. Preserve whose unrealized action
conditions which consequence; do not replace the conditional with a nominal description of an alternative.
When the record uses an unknown source clock, first translate its actor/action and actual interval.
Then give separate complete clauses locating that interval relative to the original undated record
(in Russian, make the interval the subject of «отсчитывается от времени первоначальной записи без даты»),
contrasting it with processing time, and stating the unknown calendar date or period. Keep the actual
direction and interval, and preserve any nonacceptance, no-event or proposal-only limits separately.
Use these clauses only for qualifications already in the retained record; an ordinary dated statement
must not acquire unknownness or a processing-time contrast. Do not derive a calendar date from today.

When source_clock_translation is true and you select translate, return translated_record instead of text.
Each segment is final public prose, not a plan or evidence. The server joins them with spaces in this order:
- proposition_and_nontemporal_scope: translate the complete actor/action/object, its actual selected
  interval, visible status labels, and every nonclock limit. Keep nonacceptance, no-event and proposal-only
  limits when retained. A tentative-time label qualifies timing, not uncertainty about the proposal act.
- source_clock_anchor: one standalone sentence with the selected interval as subject of
  «отсчитывается от времени первоначальной записи без даты». Preserve the actual interval and direction;
  do not state an unrelated example or quote the whole anchoring sentence.
- remaining_clock_qualifications: translate the remaining retained clock restrictions, including
  processing-time contrast and unknown recording/calendar time only when present. Do not invent a clock.
End each segment with sentence punctuation. Together they must translate every clause of the complete
retained record without importing a proposition from the query or private frame. Missing or conflicting
support requires no block. The segment names supply no authority and cannot bypass any verification.`;
