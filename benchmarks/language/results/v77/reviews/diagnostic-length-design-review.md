# V77 diagnostic detail length — bounded design review

Independent Sol review, read-only. I inspected the frozen V76 reproduction, current alignment schema and contracts, and the proposed wire/local split. I made no provider call or runtime edit.

## Reproduced failure

Selected alternatives answer-verifier trace row 1358 / call 578 returned provider `ok:true` with all three semantic booleans true. The response failed local schema parsing solely at:

`source_alignments[0].qualification.detail`

The returned diagnostic has 160 Unicode code points but 161 UTF-16 code units because it ends with one astral character. Zod's local `.max(160)` measures the JavaScript string length, so the otherwise complete response is invalid. Replacing only that cloned private detail with a short complete sentence makes the same schema and alignment checks pass. This isolates an availability failure in private diagnostic length; it does not establish the correctness of the positive semantic verdict.

## Recommendation

**Adopt the proposed narrower provider-visible maximum of 80 for only the shared actor/qualification `detail` fields, while preserving the local `.max(160)` validator.** A schema such as:

```ts
z.string().trim().min(1).max(160).meta({ maxLength: 80 })
```

is the smallest coherent change if the current Zod-to-endpoint conversion continues to emit `maxLength:80` while local `safeParse` retains the 160-unit bound.

The arithmetic is closed: one Unicode code point occupies at most two UTF-16 code units, so any provider-compliant 80-code-point string fits the unchanged local 160-unit maximum. This avoids truncation, normalization, retry, a larger model cap, or a new pass. It also reduces possible output size.

Apply the metadata to the one shared `detail` definition used by actor and qualification across all three strict relation branches. Do not apply it to:

- `source_context`;
- comparison summaries;
- mismatch evidence;
- `object_and_operation.source_specifics` / `answer_specifics`;
- tested-property fields;
- readings or public answer prose.

Those fields have different ownership and evidence roles, and none caused this failure.

## Why retain the field

Removing `detail` would reduce schema size and output cost, but it would also remove the only required compact explanation of why the chosen source and answer anchors preserve, generalize, change, omit, or do not select an actor/qualification. The relation enum and anchor IDs alone are too easy to fill without actually comparing grammatical subject, experiencer, report role, epistemic limit, or temporal scope.

The detail remains fallible private prose and never becomes source authority. Publication still requires:

- exact source/answer anchor ownership;
- one alignment per cited record;
- a selected category per cited record;
- only positive supported relations in `answerAlignmentsSupported`;
- excerpt selection;
- the three semantic booleans and matching concrete mismatch evidence for negatives;
- all language, provenance, and source-frame checks.

An 80-code-point note is enough to name a concise comparison such as `Ada remains the experiencer of the stated knowledge limit.` The full source/answer text, source context, operation/property specifics, comparison fields, and mismatch records remain available for more detailed reasoning.

## Alternatives

### Prompt-only concision

A prompt instruction to keep these details below 80 characters is useful supporting guidance but is insufficient as the sole fix. V76 demonstrates that a provider can return a structurally coherent value at the apparent maximum while crossing the local UTF-16 limit. A strict provider-visible bound directly constrains decoding; prose guidance does not.

### Lower the local maximum to 80

This is simpler conceptually but unnecessarily changes the existing local acceptance contract and makes provider/code-point versus JavaScript/UTF-16 counting less tolerant. The wire-80/local-160 split deliberately supplies enough local capacity for any valid 80-code-point provider output.

### Add separate source/answer details

That could make comparison more explicit, but it adds schema/output overhead and duplicates information already carried by exact anchors and the required combined diagnostic. The observed failure does not justify that larger change.

## Required controls

1. **Wire conversion:** all actor/qualification detail occurrences in every preserved/generalized/changed, omitted, and not-selected branch expose `maxLength:80`; no `oneOf`, `const`, or unsupported regex is introduced.
2. **Local contract unchanged:** 160 BMP units still parse locally; 161 UTF-16 units fail locally.
3. **Unicode boundary:** 80 astral code points (160 UTF-16 units) parse locally; 81 astral code points fail locally. Endpoint schema remains 80 code points.
4. **Wire/local distinction:** an 81-BMP-unit value demonstrates that local parsing can remain permissive even though it is outside the provider contract. Tests must not misdescribe metadata as a second local validator.
5. **Strict branches:** null/anchor/relation dependencies remain identical for all three alignment variants; unexpected fields and inconsistent null shapes still fail.
6. **Semantic negative:** a concise negative actor or qualification detail with a valid negative relation still cannot publish because the existing semantic booleans/mismatch gates reject it.
7. **Positive integration:** concise complete actor and qualification details pass the same mandatory verifier path; missing/blank details remain invalid.
8. **Transport capture:** actual Chat/Responses endpoint schemas, where applicable, show 80 only on these fields and preserve all other maxima and strictness. A synthetic echo is transport evidence, not model competence.

## Risks and limits

- Some multilingual diagnostics may become terse. Prompt guidance should say `one short complete comparison, at most 80 code points` and prioritize actor/experiencer or qualification difference over narrative explanation. It should not encourage fragments or omit the compared predicate/object.
- Provider structured-output enforcement remains part of the transport contract. A mocked or nonconforming provider could return 81–160 BMP units that local parsing accepts; tests should make this intentional boundary explicit rather than claim local enforcement of 80.
- This change removes the demonstrated length mismatch class for provider-compliant output. It does not prove that positive semantic verdicts are correct or eliminate other schema/cap failures.

## Disposition

The wire-80/local-160 design is **approved** as a bounded availability correction. Preserve all existing semantic, selection, ownership, language, and exact-anchor gates; keep the source-specific and property limits unchanged; add concise prompt guidance and the boundary/transport controls above. No model, output cap, call count, retry, or public schema change is warranted.
