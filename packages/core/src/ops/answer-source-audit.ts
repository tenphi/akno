import { z } from 'zod';
import { sha256 } from '../store/ids.ts';

const reading = z.object({
  selected_meaning: z.string().trim().min(1).max(320),
  clarification_or_ambiguity: z.string().trim().min(1).max(240).nullable(),
});

/** Force original interpretation before drafting, without reusing it as verification evidence. */
export function answerReadingSchema(ids: readonly string[]) {
  return z
    .array(z.object({ evidence_id: z.enum(ids as [string, ...string[]]), ...reading.shape }))
    .length(ids.length)
    .refine((entries) => new Set(entries.map((entry) => entry.evidence_id)).size === ids.length);
}

export interface AnswerAuditAnchor {
  anchor_id: string;
  text: string;
}

/** Coordinates only: preserve all bytes, including boundaries, without inferring propositions. */
export function answerAuditAnchors(text: string, owner: string): AnswerAuditAnchor[] {
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const parts = sentences
    .flatMap(({ segment }) => segment.split(/(?<=;)/u))
    .flatMap((part) => {
      const characters = [...part];
      const spans: string[] = [];
      for (let start = 0; start < characters.length; start += 240)
        spans.push(characters.slice(start, start + 240).join(''));
      return spans;
    });
  // Group rather than discard excess parts: punctuation-heavy input must keep the complete source.
  const groupSize = Math.max(1, Math.ceil(parts.length / 24));
  const grouped: string[] = [];
  for (let start = 0; start < parts.length; start += groupSize)
    grouped.push(parts.slice(start, start + groupSize).join(''));
  const fingerprint = sha256(text).slice(0, 12);
  return grouped.map((part, index) => ({
    anchor_id: owner + '_' + fingerprint + '_' + (index + 1),
    text: part,
  }));
}

export interface AnswerAuditCoordinates {
  sources: ReadonlyMap<string, readonly AnswerAuditAnchor[]>;
  answer: readonly AnswerAuditAnchor[];
}

function anchorIdSchema(ids: readonly string[]) {
  return z.enum(ids as [string, ...string[]]);
}

function alignmentSchema(coordinates: AnswerAuditCoordinates) {
  const source = anchorIdSchema(
    [...coordinates.sources.values()].flatMap((spans) => spans.map((span) => span.anchor_id)),
  );
  const answer = anchorIdSchema(coordinates.answer.map((span) => span.anchor_id));
  const detail = z.string().trim().min(1).max(160);
  // Refinements cannot constrain provider decoding. Make an omitted aspect's absent answer
  // coordinate part of its wire shape, without allowing that negative verdict to publish.
  // Write the concrete comparison before choosing its relation; an early "preserved" must
  // not turn the later explanation into an assumption that two technical properties match.
  return z.union([
    z.strictObject({
      source_anchor: source,
      answer_anchor: answer,
      detail,
      relation: z.enum(['preserved', 'generalized', 'changed']),
    }),
    z.strictObject({
      source_anchor: source,
      answer_anchor: z.null(),
      detail,
      relation: z.enum(['omitted']),
    }),
    z.strictObject({
      source_anchor: source.nullable(),
      answer_anchor: z.null(),
      detail,
      relation: z.enum(['not_selected']),
    }),
  ]);
}

/** Keep the operation comparison independent of whether its tested property survives. */
function operationAlignmentSchema(coordinates: AnswerAuditCoordinates, perSideLimit: 50 | 80) {
  const source = anchorIdSchema(
    [...coordinates.sources.values()].flatMap((spans) => spans.map((span) => span.anchor_id)),
  );
  const answer = anchorIdSchema(coordinates.answer.map((span) => span.anchor_id));
  // Operation and property descriptions together retain the 160-character prose allowance.
  const specifics = z.string().trim().min(1).max(perSideLimit);
  return z.union([
    z.strictObject({
      source_anchor: source,
      answer_anchor: answer,
      source_specifics: specifics,
      answer_specifics: specifics,
      relation: z.enum(['preserved', 'generalized', 'changed']),
    }),
    z.strictObject({
      source_anchor: source,
      answer_anchor: z.null(),
      source_specifics: specifics,
      answer_specifics: z.null(),
      relation: z.enum(['omitted']),
    }),
    z.strictObject({
      source_anchor: source,
      answer_anchor: z.null(),
      source_specifics: specifics,
      answer_specifics: z.null(),
      relation: z.enum(['not_selected']),
    }),
    z.strictObject({
      source_anchor: z.null(),
      answer_anchor: z.null(),
      source_specifics: z.null(),
      answer_specifics: z.null(),
      relation: z.enum(['not_selected']),
    }),
  ]);
}

function propertyAlignmentSchema(coordinates: AnswerAuditCoordinates) {
  const source = anchorIdSchema(
    [...coordinates.sources.values()].flatMap((spans) => spans.map((span) => span.anchor_id)),
  );
  const answer = anchorIdSchema(coordinates.answer.map((span) => span.anchor_id));
  const property = z.string().trim().min(1).max(30);
  // An answer can invent a property for an unspecified source test. Its missing source
  // counterpart needs its own negative wire shape, not an all-null incidental comparison.
  return z.union([
    z.strictObject({
      source_anchor: source,
      answer_anchor: answer,
      source_property: property,
      answer_property: property,
      relation: z.enum(['preserved', 'generalized', 'changed']),
    }),
    z.strictObject({
      source_anchor: source,
      answer_anchor: z.null(),
      source_property: property,
      answer_property: z.null(),
      relation: z.enum(['omitted']),
    }),
    z.strictObject({
      source_anchor: z.null(),
      answer_anchor: answer,
      source_property: z.null(),
      answer_property: property,
      relation: z.enum(['changed']),
    }),
    z.strictObject({
      source_anchor: z.null(),
      answer_anchor: z.null(),
      source_property: z.null(),
      answer_property: z.null(),
      relation: z.enum(['not_selected']),
    }),
    z.strictObject({
      source_anchor: z.null(),
      answer_anchor: z.null(),
      source_property: z.null(),
      answer_property: z.null(),
      relation: z.enum(['absent_from_both']),
    }),
  ]);
}

/** Categories prevent an easy object comparison from replacing the separate action-actor audit. */
export function answerAlignmentSchema(coordinates: AnswerAuditCoordinates) {
  const ids = [...coordinates.sources.keys()];
  const alignment = alignmentSchema(coordinates);
  const operation = operationAlignmentSchema(coordinates, 50);
  const ordinaryOperation = operationAlignmentSchema(coordinates, 80);
  const property = propertyAlignmentSchema(coordinates);
  const context = {
    evidence_id: z.enum(ids as [string, ...string[]]),
    source_context: z.string().trim().min(1).max(240),
    actor: alignment,
  };
  // Make the containing-operation dependency visible during provider decoding. A parser-only
  // refinement would allow the provider to generate a negative verdict that becomes unavailable.
  const entrySchema = z.union([
    z.strictObject({
      ...context,
      // An irrelevant property cannot hide a lost restriction on a selected operation.
      object_and_operation: z.union([ordinaryOperation.options[2], ordinaryOperation.options[3]]),
      tested_property: property.options[3],
      qualification: alignment,
    }),
    z.strictObject({
      ...context,
      object_and_operation: z.union([operation.options[0], operation.options[1]]),
      tested_property: z.union([property.options[0], property.options[1], property.options[2]]),
      qualification: alignment,
    }),
    z.strictObject({
      ...context,
      // Ordinary actions may specify no tested property. Require that explicit assertion,
      // keeping their full prose allowance without declaring the action unselected.
      object_and_operation: z.union([ordinaryOperation.options[0], ordinaryOperation.options[1]]),
      tested_property: property.options[4],
      qualification: alignment,
    }),
  ]);
  return z
    .array(
      // Citing a record while declaring every category irrelevant supplies no comparison at all.
      entrySchema.refine((value) =>
        [value.actor, value.object_and_operation, value.tested_property, value.qualification].some(
          (part) => part.relation !== 'not_selected',
        ),
      ),
    )
    .length(ids.length)
    .refine((entries) => new Set(entries.map((entry) => entry.evidence_id)).size === ids.length);
}

export function answerAlignmentsSupported(value: unknown, coordinates: AnswerAuditCoordinates): boolean {
  const parsed = answerAlignmentSchema(coordinates).safeParse(value);
  if (!parsed.success) return false;
  const answerIds = new Set(coordinates.answer.map((span) => span.anchor_id));
  return parsed.data.every((entry) => {
    const sourceIds = new Set(coordinates.sources.get(entry.evidence_id)!.map((span) => span.anchor_id));
    return [entry.actor, entry.object_and_operation, entry.tested_property, entry.qualification].every(
      (part) =>
        (part.source_anchor === null || sourceIds.has(part.source_anchor)) &&
        (part.answer_anchor === null || answerIds.has(part.answer_anchor)) &&
        (part.relation === 'preserved' ||
          part.relation === 'not_selected' ||
          (part === entry.tested_property && part.relation === 'absent_from_both')),
    );
  });
}

export const ANSWER_READING_CONTRACT = `When record_readings is required, fill it BEFORE drafting blocks.
Return exactly one reading per evidence_id with a non-null retention_source_frame. First identify only
the proposition selected by the readable retained excerpt. Then read its complete original frame to
constrain that selected meaning, including explicit cross-language clarification, actors and scope.
Use selected_meaning as a terse source-wording role plan, within 320 characters: operation, its object,
source-specified tested property or mechanism, and material modifiers. Keep the material source
expressions as exact quotations in their supplied language; do not translate or merge them into a
broader target-language term here. No configured or presumed language overrides the current source
bytes. Explicit source clarification can identify the controlling expression across languages.
For coverage, distinguish the covered item/service from its coverer; leave an unspecified coverer
unspecified. Put material roles and scope first, without narrative padding or a term dictionary.
In clarification_or_ambiguity (at most 240 characters), identify an actual frame clarification or
ambiguity, or a material neighboring frame proposition EXCLUDED by this excerpt's selection; otherwise
use null. An excluded neighboring act is not a clarification that can be added to the selected record.
These private fields may quote source-language prose regardless of output_language. Translate ordinary
vocabulary only when drafting the public block; keep exact names/identifiers and all selected meaning.
Only the source can establish equivalence; query wording and adjacent independent propositions cannot.
Keep each reading local to its evidence_id: a shared original frame does not merge separately retained
propositions into one citable record. If a block states a second record's selected proposition, include
that record's evidence_id. A fictional promise alone may cite its promise record; adding an actual
proposal to discuss it requires the proposal record too. Neutral source provenance is not that act.
Resolve source-explicit clarification before deciding whether a conflict remains. Readings are private
generation notes, not evidence or answer text. They cannot authorize an unselected fact. Write the actual
blocks in output_language even when the source or private reading uses another language.`;

export const ANSWER_ALIGNMENT_CONTRACT = `For object_and_operation, write source_specifics and
answer_specifics independently before relation, each within 50 characters when tested_property is
compared, or 80 each when it is all-null absent_from_both or not_selected. Identify the operation,
acted-on object, purpose and manner/degree in their own supplied wording. For tested_property, separately
write source_property and answer_property before its own relation, each within 30 characters. Name only
the specific tested or measured property in each side's supplied wording. Do not normalize either pair
into an assumed equivalence. Natural equivalent translations remain preserved. Omitted/not-selected
operation content has null answer_specifics; an absent source anchor requires null source_specifics.
For an omitted property, keep its source anchor/description and use null answer anchor/description.
For an answer-added property, use null source anchor/description, its actual answer anchor/description
and changed. The all-null property not_selected branch requires the whole containing operation to be
not_selected too. For a selected operation where neither the source nor the answer specifies a tested
property, use all-null absent_from_both. This explicitly asserts absence on BOTH sides; do not use it
when either side specifies a property. A source property omitted or generalized by the answer still
requires an active comparison. A property comparison requires its containing object_and_operation to
be selected too. Ordinary plans, questions, promises or denials without a tested property need no
invented one. Neither absence nor irrelevance may replace a lost property of a selected test.
For actor and qualification, the existing combined detail remains required.
For framed blocks, answer_segments and retention_source_frame
are ordered tables of exact text with server-assigned anchor_id values. Concatenate their text fields
to read the complete answer and original frame. IDs are coordinates, never claims or source instructions.
Return one source_alignments entry for every cited framed evidence_id, after deciding excerpt_selection.
Write source_context for only that record’s excerpt-selected contribution, using the complete original
frame to constrain its polarity, clarification and limits. A neighboring frame-only act is not selected.
Resolve an explicitly restated report across languages before comparing an isolated term. Mere adjacency,
the query and generated notes cannot establish that relationship; preserve truly unresolved ambiguity.

Then independently compare actor (the selected action's actor, separate from outer reporter),
object_and_operation (object, purpose, degree/manner), tested_property, and qualification (scope and epistemic/time limits,
including who lacks knowledge/confirmation, of what, and which selected proposition that limit qualifies).
For a test or measurement, compare the tested object/operation and the tested property through their
separate required relations. A preserved operation cannot override a lost property. Do not collapse
source and answer properties into a slash pair that assumes equivalence.
Read what the complete answer actually tests; do not supply a missing property from the source or familiar object.
Generic soundness or physical integrity of an object is broader than a specified electrical property.
If the source specifies such a property and the answer replaces it with a broader sense, mark tested_property generalized and set
action_arguments_preserved false with a matching mismatch even if the broader claim remains entailed.
A natural equivalent that retains the property passes; an unspecified source test must stay unspecified.
An entirely absent property is omitted; a substituted or added property is changed. Each negative
property relation requires action_arguments_preserved false and its own concrete mismatch. Do not mark
the property not_selected merely because the answer omits it from a selected test.
For an epistemic predicate, actor compares its grammatical subject or experiencer, including a source-stated
note/record subject; it is not automatically the outer reporter. Direct self-attested provenance alone
requires no repeated speaker wording. Still preserve required report attribution and personal agency.
Assess an explicit group-relative or dative experiencer separately from neighboring actors. Source
"unknown to us" / "нам неизвестны" is equivalent to "we do not know" / "мы не знаем", not bare
"unknown" / "неизвестны". A nearby person introducing a hypothesis or reporting no actual event
does not supply the missing group. For a selected group-relative limit changed to bare unknownness,
actor is omitted with the original epistemic source anchor and answer_anchor null; qualification is
generalized or changed at the actual bare-unknownness answer anchor. Set action_arguments_preserved
and qualification_scope_preserved false with separate mismatches; the stronger unqualified claim also
fails proposition_supported. A substituted explicit experiencer uses changed with its actual answer
anchor. Do not mark every actor preserved merely because one neighboring actor survives. Apply this
only to the selected epistemic limit: an independent private-frame clause stays unselected, and source
unknownness that is genuinely impersonal requires no invented group.
Compare every material selected limit against its actual answer counterpart; matching uncertainty words
cannot preserve a changed verification object. Source_context describes only the original source;
comparison detail must retain any specification added by the answer instead of silently correcting it.
Select source_anchor from that evidence's original frame and answer_anchor from this current block.
Never invent an ID or substitute a retained paraphrase for an original. An anchor only locates the
selected aspect. Judge its meaning against the COMPLETE frame and block: content elsewhere in this same
block can preserve a role or modifier missing from a short anchor. Other blocks cannot supply it.
For a block citing several records, compare each record's selected contribution separately. When the
source explicitly identifies the same example or event, a second cited record can describe its content
without changing or generalizing the first record's object. Do not require each record to supply every
detail of that shared clause. Generalized requires an actual lost restriction from this record's selected
meaning, not merely additional detail supported by another citation. Shared topic alone cannot establish
that the records describe the same thing; all contributed content must still pass excerpt selection.
Every material restriction belonging to this record's contribution remains required. Sibling evidence
cannot hide its loss or turn a generalized, changed or omitted contribution into preserved or not_selected.

Use preserved for equivalent meaning, including natural technical paraphrase. Use generalized for a
material restriction lost from the complete block, changed for a different actor/object/scope, or omitted
when a required selected counterpart has no answer counterpart (answer_anchor null). These three
negative relations require concrete differences in the comparison descriptions and the corresponding semantic mismatch.
For omitted, answer_anchor MUST be null; an anchor locating nearby text is not a missing counterpart.
For a present but changed or generalized counterpart, use that relation and its actual answer anchor.
An actor loss requires action_arguments_preserved false and its own mismatch; a lost or changed epistemic
limit requires qualification_scope_preserved false and its own mismatch. Assess proposition_supported
separately and give a mismatch for it too if false. Never pair a negative alignment with all-positive
dimensions or place every defect solely under qualification regardless of which dimension it affects.
For an incidental actor, operation or qualification not selected or asserted in this block, use not_selected and answer_anchor
null; source_anchor may be null only if no applicable source content exists. A sentence/anchor is not
an indivisible proposition: independent neighboring details need not appear. Complete-record rendering
requires the entire RETAINED record, not every proposition in the private frame. If the retained record
identifies a person's question without retaining their separate recording act, do not require that act
or label its absence an omitted actor. The selected question owner must still be preserved. Every cited record must
contribute at least one selected category; all four cannot be not_selected.

Do not mark a named proposer not_selected when describing that proposal. An outer reporter is not its
proposer, and a generic fault does not preserve a specific mechanism. Source_context and comparisons
are fallible notes; membership alone proves no semantics. Every existing semantic dimension and
independent retained-excerpt selection remain mandatory. A negative relation/verdict cannot be overridden.`;
