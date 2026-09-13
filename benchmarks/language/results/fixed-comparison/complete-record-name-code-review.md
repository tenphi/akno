# Complete-record source-name code review

Reviewer: independent Sol review (`/root/language_blind_review`)  
Checkout: `tmp/akno-integration`  
Scope: `packages/core/src/ops/answer.ts` and `answer.test.ts`. No source edits or model calls.

## Disposition

Clean. The implementation matches the bounded plan and I found no correctness or overreach defect.

## Guard placement and activation

The guard runs on the materialized `AnswerDraft`, after `answerRecordText()` has resolved copy, ordinary translation, or structured clock translation, and before the existing support guards and semantic verifier. Thus it checks the actual prose that could be published. An approving language verdict cannot bypass it.

Activation is limited to `recordRendering !== undefined`. `answerRecordRendering()` already requires exactly one evidence item, one source frame, one qualified memory line, a bounded canonical readable record, and a schema whose evidence ID is that record's ID. The new scan therefore cannot impose a name from an unselected sibling or arbitrary metadata record.

For that cited qualified line, the guard requires all of the following before enforcing exact preservation:

- a nonempty `source_speaker`;
- a non-generic source identity;
- the exact identity is boundary-present in the line's current readable prose; and
- the final materialized block lacks that same boundary-present identity.

This preserves the no-metadata-invention rule. A source speaker found only in the private original frame or metadata does not become required public text. Generic `user`/assistant identities remain translatable roles. Ordinary focused composition does not receive the new requirement.

Using the existing `sourceSpeakerInReadableText()` helper is appropriate. It admits Markdown and possessive boundaries while rejecting transliteration, longer names, hyphen-joined names, and combining-mark extensions. It checks exact visible spelling without claiming to determine grammatical role; existing full-source actor/qualification verification remains mandatory for blocks that pass.

## Controls

The table test covers:

- exact preservation and Markdown-wrapped preservation;
- exact regression (`Ada Marlow` → `Ада Марлоу`);
- complete omission;
- longer-name, joined-name, and combining-mark boundary failures;
- metadata-only identity exclusion;
- generic-role localization;
- ordinary focused composition exclusion; and
- an exact-name answer that still fails the independent semantic verifier.

The request-count assertions establish that local failures stop before semantic verification, while accepted local cases still reach it. The semantic-negative companion proves the new check does not authorize unsupported content.

The final focused receipt reports 668/668 tests passing across three files in `tmp/akno-name-full-answer-tests.log`.

## Limits

The guard only establishes exact name preservation in complete-record rendering. It does not prove that the name occupies the same semantic role, and it intentionally does not enforce attribution in ordinary focused answers. Those are correct limits because the existing semantic and attribution checks remain responsible for role preservation.

No model/pass/budget/schema/public API behavior changes beyond rejecting a complete-record block that alters or omits an already-visible named source.
