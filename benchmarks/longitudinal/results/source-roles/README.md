# Direct assertion provenance and explicit reporter controls

Author review for [Akno #192](https://github.com/tenphi/akno/issues/192), 2026-10-05.
These are small development controls, not an independent benchmark or reliability estimate.

## Problem and resulting boundary

Released 0.18.2 sometimes withheld a faithful complete-record copy because its metadata author,
Ada Marlow, was absent from the answer. The source and readable record did not name that person as an
actor or reporter. The recorded rejection was valid structured output within the installed token ceiling,
so increasing a limit alone would not fix that attribution requirement.

Direct assertion author identity is now absent from generation and verification qualification checklists.
Public evidence retains provenance. Readable actors, pronouns and reporters remain source constraints;
source-report records keep their existing outer-source requirements. A named actor and a reporter are
separate roles, even when a report describes an action.

The existing blind predicate reading additionally binds **explicitly named reporters** to their reported
predicates. It receives source text and the selected readable record, without the new draft, question or
provenance author. Bound names must occur in source quotations and the readable selection. Candidate role
comparisons select consecutive server-owned answer spans, preserving Markdown and exact names. A cited
report cannot supply an answer-absent reporter. Full-record rendering selects all bound reporters; focused
composition can omit only reporters of predicates also unselected by its temporal audit. No extra model
call is added. Existing actor, date, source-selection and qualification checks remain independently required.

## Controls and review rounds

Seven invented sealed-record fixtures cover literal copying, English/Russian translation, focused
composition, an explicit actor, a reporter different from the metadata author, a qualified report and
promotion of a reporter into an action's performer. Example source: “Bo Winters reports that silverpine
inspection of Zephyr QX-100 is complete.” Its metadata author is Ada Marlow. The correct answer retains
Bo Winters's reporting scope; neither bare completion nor attributing performance to Bo is supported.

The controls call the compiled core through its socket and compiled client. Their admission state is
sealed manually with a source receipt; this does **not** test natural retention. Generation is scripted to
supply controlled good/bad drafts, so the matrix does not measure generation or its language classifier.
Production deterministic guards, source reading and semantic verification run normally. Each fixture has
a good and bad answer before restart, then both again after reopening and rebuilding. Source bytes remain
unchanged. A separate natural-generation control repeats the original dated-journey/undated-payment case.
All fixtures use the shared invented vocabulary; the real knowledge base is not part of these controls.

Review/fix rounds preserved their failed outputs:

- Metadata separation alone exposed a bad approval after restart: the explicit reporter was omitted.
  The source-only reporter binding now prevents broad approval from excusing an absent name.
- A recopying role audit normalized Markdown in a faithful report and produced a false hold. Selecting
  answer spans fixes that structural failure without normalizing the actual source or answer.
- A broader new role reader inferred agency from a noun modifier. The added binding was narrowed to
  explicitly named reporters; the existing independent actor checks remain required.
- Earlier fixture diagnostics included a translation changing modifier attachment and a focused
  neighbor-clause ambiguity. They are retained as development diagnostics, not pooled with final controls.

## Final scoped results

The final seven-fixture input and restart protocol were fixed before this cohort. Both source reading
and verification use the stated answer model, low reasoning effort and a 60-second model timeout.
The 4,096-token trial tests the shipped default; the installed 1,024-token limit is unchanged. The 8,192-token
trial is a diagnostic override, not a production configuration change.

| Answer model   | Output ceiling | Faithful answers returned | Faithful answers withheld | Incorrect drafts withheld |
| -------------- | -------------: | ------------------------: | ------------------------: | ------------------------: |
| `gpt-6-luna`   |          1,024 |                     13/14 |                      1/14 |                     14/14 |
| `gpt-5.6-luna` |          8,192 |                     14/14 |                      0/14 |                     14/14 |
| `gpt-6-luna`   |          4,096 |                     14/14 |                      0/14 |                     14/14 |

There are 84 answer operations: 42 correct drafts and 42 incorrect drafts. No incorrect draft was
published. One correct translated answer after restart under 1,024 tokens was withheld because the
verifier exhausted its output allowance, not for author attribution. The corresponding negative
population contains one unavailable verdict at that limit; unavailable output is a hold, not evidence
of semantic rejection. The two larger trials return every faithful draft and withhold every bad draft.
Each trial records 52 live model outcomes with reported usage (no missing usage) plus 28 scripted
generation outcomes. These counts are not comparative accuracy rates and do not establish general stability.

The separate natural-generation check with the installed model/ceiling returns the faithful dated
journey and undated completed payment. Bad drafts moving the journey date onto the payment are withheld
before and after restart. This preserves #187's attachment boundary. The full 4,727-test suite, including
current-correction, source-selection and provided-authority coverage, passes alongside build, lint, knip,
all smoke checks and installed-package smoke. Reviewer: Codex, the implementation author, not independent.

## Evidence binding

Generation prompt: `answer-generation-v71`. Verifier prompt: `answer-verifier-v55`.
Private raw controls remain ignored under `bench-results/source-role-192/`; failures were not overwritten.
These SHA-256 values hash raw file bytes, unlike the JSON-encoded lifecycle inventory hashes.

Fixture bytes: `bf87512750ada595072b332113207c053db39ddfd99ee3e0cdeddca5729d883e`. Restart harness bytes: `dcd3081a855929c44f0a004dc7843944c73bf967973ec3b6609018a6d7d432ef`.

| Compiled artifact                                   | SHA-256                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/core/dist/ops/answer.js`                  | `eea6d36f1824f5f48b97338258635e5efbc01dc5159e87dfaf51a414f3b3db28` |
| `packages/core/dist/models/predicate-time-audit.js` | `98f9caaa1795f9acf7998a4476bbe76cad07ef03698c7ff7845b1d465054ff5a` |
| `packages/core/dist/models/source-role-audit.js`    | `74e69afcaf2d8eae216f4eec3958ce1dc993810b1a49883b3cf334e7eb9b2023` |

| Final private output              | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `reporters-final-configured.json` | `b779dcca7ff1346fc7ad05c969aa3ee48141adf9845cdcb2cb7a0c5b272d1fef` |
| `reporters-final-5.6.json`        | `77629b5d04b1fcfa406d621bbd71490d56f6fe83dc3c34f14c07a1d5c929fad9` |
| `reporters-final-6-default.json`  | `7a35b3ac975e858c026bc3b2c4dded44897d11b889195c6cc8eebb2c9804f092` |

These controls isolate the attribution boundary. They do not establish natural retention quality,
multilingual correctness beyond the reviewed fixtures, exhaustive role interpretation or absence of
future false holds. Source reading and semantic verdicts remain fallible; incomplete output remains
unavailable and no semantic retry or fallback acceptance is introduced.
