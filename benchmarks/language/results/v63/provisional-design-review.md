# V63 provisional contractual-sense design review

## Evidence and boundary

This review is based only on the V62 preliminary report case. The retained English record ends with `no independent confirmation of this reported condition`; its full readable context concerns service terms, and the original Russian clarification says `не проверенное мной условие`. One generated RU answer changes that to `сообщения о состоянии`. Existing retention, answer-generation and semantic-comparison contracts already state that a contract condition is a contractual term/requirement rather than a device's physical state, yet the same-call verifier marked qualification preserved.

This is a selected-sense and qualification-object failure. It is not a language-identity error, and a blanket rule against `condition` or `состояние` would be unsound.

## Generation clarification

The smallest prompt correction is to make the existing rule operational at the epistemic-limit clause:

> When a source uses `condition` in the governing context of a contract, terms, warranty, or service terms, repeat the contractual qualifier in any clause about examining, verifying or confirming it: use `contractual condition/term/requirement` or `условие/требование договора`. Do not leave bare `condition` for translation as physical `состояние`. Preserve a source-supported physical state when that is what the source actually describes.

For the observed record, a stable RU ending is:

> `Ada Marlow не читала условия обслуживания и не имеет независимого подтверждения того, что это условие договора.`

or, when preserving report-object wording:

> `... не имеет независимого подтверждения этого сообщения об условии договора.`

This repeats only a sense already established by the source frame. It must not invent which contractual clause, warranty effect, device property, or legal consequence is involved. It also must not rewrite a physical condition report merely because a contract is mentioned elsewhere.

The same instruction belongs in retention generation as well as answer generation: emitting `reported contractual condition` instead of bare `reported condition` keeps the disambiguating source meaning available to later translation. The exact original spans remain unchanged; generated prose is a faithful clarification, not replacement source authority.

## High-precision deterministic floor

A local floor is defensible only with a narrow two-sided activation:

1. **Source activation:** the selected original frame explicitly binds the verification/confirmation object to a contractual condition, term, or requirement. Strong forms include `contractual condition/term/requirement`, `condition of the contract/service terms`, `условие/требование договора`, or a same-record epistemic construction where `условие` is the object of `проверено/подтверждено` and the governing clause explicitly concerns contract/service terms.
2. **Generated contradiction:** the corresponding generated epistemic clause explicitly makes physical `состояние` the verification/report object, such as `подтверждение сообщения о состоянии`, `не подтверждено состояние устройства`, or an equivalent English physical-state formulation.

Only when both are present should the generated block be held before semantic verification. Mere occurrence of `состояние` elsewhere must not trigger: `индикатор состояния` can be the supported object of a functional check while a separate clause correctly discusses a contractual condition. Likewise, bare `condition`, ordinary equipment condition, health/state language, code identifiers, and quoted examples remain outside this floor.

The floor should inspect the selected source frame/excerpt rather than query wording, model readings, subject metadata, or nearby uncited evidence. It should remain generated-answer-only; caller-authored/provided text retains its existing authority boundary. A pass through this floor never proves the translation correct: all current source alignment, three semantic dimensions and excerpt selection remain mandatory.

### Minimum contrasts

- Positive hold: source `не проверенное мной условие` in explicit service-terms context; answer `сообщение о состоянии`.
- Allowed: same source; answer `сообщение об условии договора` or `неподтверждённое условие договора` with the same personal actor.
- Allowed: source explicitly describes the device's physical state; answer preserves `состояние устройства`.
- Allowed: answer contains supported `индикатор состояния` in one clause and `условие договора` in the confirmation clause.
- Negative activation: a contract is mentioned in an unrelated neighboring proposition, while the verified object is explicitly a physical device state.
- Quotation/code: a quoted mistranslation example does not create a live epistemic target.
- Actor control: correct contractual vocabulary with Ada's personal nonconfirmation changed to passive/global nonconfirmation still fails the existing actor/scope checks.
- Semantic control: a vocabulary-floor pass with a changed contract term or report object is still rejected by the same verifier.

## Same-call source alignment

The existing `qualification` alignment is broad enough in schema but underspecified in instruction. It should explicitly compare the **object/referent of each selected material epistemic qualifier**, alongside its actor and predicate:

- who did not examine or confirm;
- what they did not examine or confirm;
- whether that object is a report, contractual term/condition, physical state, or another proposition;
- which clause the limit qualifies.

This does not require an alignment row for every adjective or incidental qualifier. One bounded qualification entry per cited record remains, but its `source_context`, relation and detail must account for every material selected epistemic limit. If the source object is a contractual condition and the answer object is physical state, relation must be `changed`, both relevant semantic booleans must be false, and a concrete mismatch must be emitted. Correct terminology alone cannot override a changed actor or scope.

No schema field, extra verifier, retry, token ceiling, model, or gate needs to change. The additional instruction should replace or consolidate the existing generic contractual-sense sentence rather than append another long duplicate paragraph.

## Risks and recommendation

The main risk is turning lexical co-occurrence into domain inference. A contract can discuss a device's physical condition, and `состояние` can legitimately occur in an unrelated supported phrase. Therefore source activation must establish the verification object's contractual sense, and generated rejection must bind physical-state wording to that same epistemic predicate. If this relationship cannot be recognized with high precision, prefer generation plus same-call alignment guidance and leave residual cases to the mandatory verifier rather than widening the floor.

Provisional recommendation: first emit `contractual condition/term` explicitly in retained and answer prose and strengthen the existing qualification-alignment instruction to compare its object. Add the deterministic floor only for the narrow explicit source-object/generated-physical-object pair above. This addresses the observed error without banning vocabulary, importing domain facts, or adding a semantic pass.
