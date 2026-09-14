# Shared prose fix code review — final

Reviewer: independent Sol review (`/root/language_blind_review`)  
Checkout: `tmp/akno-integration`  
Scope: final three-file prose diff and condensed changeset. No model calls.

## Disposition

Clean. The prior normalization finding is resolved, and I found no remaining blocker or material changeset inaccuracy.

## Finding resolution

`categoryHeading()` now trims structural trailing heading hashes, unwraps only a balanced outer `*`, `**`, `_`, or `__` pair, removes a terminal colon, and trims boundary whitespace. It no longer deletes emphasis or code marker characters inside the title.

The added controls confirm that ``## `Report` `` and `## Rep*ort` remain factual, while `## **Nested report:**` retains the intended report scope. This closes the concrete false-positive surface from the initial review without expanding category vocabulary or weakening the positive cases.

The regular expression's full-string anchors and backreference require matching opening and closing emphasis markers. The subsequent category expressions also remain full-title matches. Descriptive headings such as report serial number, preliminary coating specification, versioned dimensions, and their tested Russian forms remain factual.

## Scope, closure, and migration

The category-title grammar remains bounded to report/retelling titles and tentative/preliminary alternatives titles. Ordinary body text does not gain heading authority. Equal-depth sibling headings close the scope; nested headings inherit it. The unit suite covers both behaviors.

`PROSE_PROJECTION_VERSION` changes from `prose-v1` to `prose-v2`. The integration test demonstrates the existing metadata mismatch path rebuilding stale derived line qualifications while preserving the source file bytes, mtime, and file set. It correctly distinguishes database eligibility within the stored qualified view from factual `answer_eligible` returned by the read projection.

Evidence reviewed:

- `tmp/akno-prose-fix-tests-reviewed.log`: 45/45 focused tests passed.
- `tmp/akno-comparison/prose-fix-corpus-check.json`: all 22 fixed-comparison ordinary cases match expected factual eligibility, including the three previously failing V22 categories.

These deterministic checks establish the local projection behavior. They do not establish model quality or historical-runtime causality.

## Changeset accuracy

The condensed `.changeset/knowledge-language-discourse.md` accurately describes the final user-visible behavior at an appropriate level:

- opt-in knowledge and answer language policy, generated-prose checks, and replayed policy;
- bounded Markdown discourse qualification with enclosing context and derived-projection rebuilding without source edits;
- source-based retention/answer verification, typed failures, one pre-semantic structural repair, final semantic rejection, and the 2,400-token default answer-role ceiling subject to lower caller/provider limits;
- versioned evaluation and separate semantic, safety, availability, and byte-preservation evidence.

It does not claim the deterministic suite proves live-model quality. The wording “a bounded set” appropriately avoids implying arbitrary natural-language discourse understanding. No material protocol or migration behavior in this three-file fix is omitted.

## Correction retained from the initial review

The existing `REPORT` rule was not skipped for headings; it lacked the relevant category-title noun vocabulary. The final implementation correctly addresses that through a separate bounded heading grammar.
