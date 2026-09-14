# V60 code review — round 1

## Finding

### Medium — the new record-time anchor accepts conditional, interrogative, and immediately contradicted clauses

Location: `packages/core/src/timeline/source-clock.ts`, new `sourceTimeProse` branch around lines 35–54.

The new regex ends at the source noun and accepts any punctuation through:

```ts
(?=\s*(?:$|[.,;:!?]))
```

That punctuation is not an assertion boundary. In particular, a comma can introduce a condition or a correction, and `?` marks a question. I reproduced the frozen helper results directly:

```text
Следующий год отсчитывается от времени записи,
если Ada Marlow подтвердит предложение; календарный год неизвестен.
  deictic=true, anchor=true, unknownClock=true

Следующий год отсчитывается от времени записи?
Календарный год неизвестен.
  deictic=true, anchor=true, unknownClock=true

Следующий год отсчитывается от времени записи,
но на самом деле — от времени обработки; календарный год неизвестен.
  deictic=true, anchor=true, unknownClock=true
```

All three therefore satisfy the complete deterministic clock conjunction despite not establishing an unconditional source-record anchor. This is introduced by V60: these phrases do not match the inherited branch because it lacks `времени`. Mandatory semantic verification remains in place, so this is not an acceptance bypass, but it weakens the conservative presence floor and can send unsupported clock wording to semantic acceptance.

The smallest fix is to close the new construction rather than accept arbitrary punctuation. Permit end or a declarative terminal, plus the exact supported contrast used by the observed draft (`…, а не от сегодняшнего дня или времени/момента обработки, …`). Reject immediate conditional/subordinate or corrective continuations and interrogative punctuation. At minimum add paired negatives for `, если …`, `, но на самом деле …`, and `?`; retain the current positive with `, а не …`. A reversed construction such as `От времени записи отсчитывается следующий год` currently returns `anchor=false`; that is a bounded conservative limitation, not a new false admission.

## Other reviewed boundaries

No additional actionable defect found.

- Quote masking is sound for the added shape in the tested boundary: a bare quoted deictic label is restored, a quoted whole assertion is replaced by a separator, and quoted negation cannot splice into a live assertion. Device, processing, meeting, inspection, and `записи устройства` contrasts remain rejected.
- Unknown-clock evidence remains a separate requirement, and answer blocks still require the full semantic verifier. The new semantic negative test confirms that a source-valid clock does not authorize a changed action/object.
- The retention guidance distinguishes receiving confirmation from performing confirmation. It changes generation guidance only; original source and the existing semantic verifier remain authoritative.
- The possessed-device passive-denial guidance does not assign a booking agent or product identity. It allows a source-established person subject/page suggestion only from explicit possession, and the independent ownership outcome still controls writing. The `remember` cases exercise proposed, uncertain, and absent-page outcomes while preserving the unrelated product page.
- Per-record `selected_meaning` and citation guidance correctly prevents a shared private frame from merging sibling retained propositions. It does not change the excerpt-selection schema or treat private readings as evidence.
- Prompt versions are consistent with the changed generation contracts: answer generation advances to `v56`, retention extraction to `v44`; verifier versions remain unchanged. The benchmark expectation is updated. The V60 plan accurately retains the existing model, call, retry, semantic, ownership, gate, and provider-ceiling boundaries.

I did not run provider calls or inspect fresh held-out outputs. The finding is based on direct calls to the exported deterministic helpers; repository checks were being run by the root agent concurrently.

## Recheck of the round-1 clock finding

Resolved in the current diff. I reran the three exact reproductions after the bounded ending change:

- `…, если Ada Marlow подтвердит предложение …` now returns `anchor=false`;
- the interrogative `… от времени записи?` now returns `anchor=false`;
- `…, но на самом деле — от времени обработки …` now returns `anchor=false`.

The intended V59 form remains admitted: a bare quoted clock label followed by `отсчитывается от времени записи`, the closed `а не от сегодняшнего дня или времени обработки` contrast, and the closed unknown-calendar-year clause returns all three clock booleans true. A simple declarative `Следующий месяц считается от времени исходной записи; дата записи неизвестна` also remains admitted.

The implementation now excludes `?`, arbitrary comma continuations, and arbitrary contrast text. Its only comma continuation is the bounded today/processing denial, optionally followed by the closed unknown-date wording; the added tests also reject a conditional or question after that contrast. This fixes the introduced false admissions without broadening the inherited clock branches. No remaining actionable finding in the rechecked delta.
