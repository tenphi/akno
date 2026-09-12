# V59 code review — round 1

## Disposition

No actionable correctness defect found in the reviewed V59 diff against `1ab8c77`.

The repair request now binds each failure to the correct original extraction coordinate and draft. `repair_targets` is sorted by the zero-based original index, each target carries only its own grouped validation issues, and `read_only_admitted_context` carries the original indices needed for relation references without presenting surviving records as repairable output. The repair response remains limited to failed indices. After replacement, the existing cleaner, duplicate/lost-position detection, deep equality of admitted records at their original positions, repaired-original semantic obligations, relation dependency closure and mandatory full-source verification still apply. The original draft is explicitly described as a continuity obligation rather than evidence; the complete source remains in the request as authority. I found no path by which the compact admitted mapping can modify or authorize a surviving record.

The updated tests exercise the material indexing failure mode: two noncontiguous rejected positions bind to their own drafts and issue groups while an admitted middle position remains immutable, and verifier obligations retain the corresponding originals. The migrated tests now inspect per-target issues rather than the removed flat issue array. They also retain invalid, duplicate, omitted and proposition-substitution repair cases. The supplied final logs show 565 focused tests and 2,635 full-suite tests passing; I did not rerun those suites independently. `git diff --check` was clean when reviewed.

The new Russian clock form is suitably narrow for a lexical floor. It requires an unquoted date or calendar head directly followed by `установить нельзя`, stops at a real ending, and masks the supported quote forms before matching. The paired tests cover quoted examples, component installation, merely nearby calendar wording and trailing qualifications. This helper alone is not proof of a valid source clock: the existing caller still separately requires deictic time, a source-relative anchor, the typed unknown-time envelope and semantic verification. That composition keeps the directly bound phrase from admitting an unrelated unknown date.

The generation additions preserve rather than expand authority. The retention prompt asks for an explicit group-relative epistemic experiencer without guessing group membership. The answer prompt says that an earlier query term follows a bilingual clarification only when the source itself resolves the referent and the retained record selects that report; it continues to prohibit query wording, lexical similarity and outside knowledge as alias evidence. These are generation instructions only, with existing source selection and mandatory verifier gates intact.

Versioning is consistent with the changed surfaces: retention extraction advances to `retain-extraction-language-v43` and answer generation to `answer-generation-v55`; both verifier versions remain unchanged. The benchmark expectation and V59 plan reflect those labels and accurately state that schemas, semantic dimensions, model calls, retries, gates and provider/service limits are unchanged.

## Finite limits

This remains a bounded lexical and model-mediated design. The clock grammar does not cover arbitrary Russian paraphrases, and the repair model can still omit a target or propose a semantically bad repair; those outcomes remain held or fail verification. The read-only admitted table intentionally omits full metadata and relation payloads, so it is useful as an index for ordinary references rather than a complete relation reasoner. Those limits are documented or protected by the unchanged transaction and semantic gates and are not blockers for this scope.

## Freeze checkpoint supplied by root

This round preceded the second review's discovery that an arbitrary comma could continue the new clock phrase. Round 2 identified that gap; the implementation now admits only sentence/semicolon/end or a closed dual clock-denial contrast. The round-2 note preserves the finding and verified fix. Frozen runtime is 1f63ecfb7ee8c94870437ba638897e0858e6adb5. Final local validation passed 2,644 tests across 143 files, build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety. Live quality is not established by these checks.
