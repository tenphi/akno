import { z } from 'zod';
import type { AnswerContextItem } from '@tenphi/akno-protocol';
import type { OutputLanguage } from '../models/language.ts';

export interface AnswerRecordRendering {
  evidence_id: string;
  text: string;
  copy_allowed?: false;
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
  };
}

export function answerRecordBlockSchema(record: AnswerRecordRendering) {
  const evidence_ids = z.array(z.enum([record.evidence_id])).length(1);
  const translation = z.strictObject({
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

In translations, proper names keep their exact source spelling: do not transliterate them. Translate
ordinary vocabulary and generic role labels. For nested reports, make the outer source and inner speaker
unambiguous: use 'According to OUTER, INNER said ...' or 'По словам OUTER, INNER сообщил ...'. Do not swap
their roles or rely on an ambiguous recipient/possessive construction with an indeclinable name. Render
the supported meaning in full even when the question requests only part of that record.
A bilingual restatement that fixes a term's referent controls its translation: render that same referent
throughout, without inventing two components or alternative services from two source-language wordings.
Do not specialize an unspecified measurement by choosing its measured property. Keep coverage arguments
in their source roles: a covered repair is not a repair that covers the component.`;
