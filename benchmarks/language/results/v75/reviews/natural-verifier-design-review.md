# V75 natural maximum-field verifier control — independent design review

## Scope and evidence

I reviewed `tmp/v75-natural-verifier-declaration.json`, `tmp/v75-natural-verifier-preview-final.txt`, and `tmp/v75-natural-verifier-control.mjs` without executing the live path. The declaration hashes exactly to:

`40f971a7df17ac739e545339f093071972ccd6e1ff8533f32ca224166ed89703`

No result receipt exists at the declared output path. The original V75 protocol result remains nine of ten passing, with its repetitive maximum-field verifier fixture preserved as an exact-copy failure.

## Fixture review

The amendment changes exactly 19 string fields from the failed expected value. The object paths and all nonstring values are unchanged, every replacement has exactly the same UTF-16 length as its predecessor, and the captured production endpoint schema is unchanged. The replacements cover the 30, 50, 80, 160, 240, and 320-unit limits used by the original maximum fixture.

The replacement strings are complete invented prose sentences rather than uninterrupted repeated-character padding. Within each multi-sentence field, the sentence subjects and predicates vary enough to remove the former copying confound; no full sentence is duplicated across the fixture. Preparing the shortest fields first is a sound way to meet exact small limits and has no runtime significance.

This remains a transport/exact-copy control. Its prose is deliberately artificial and its verdict content does not establish model semantic competence.

## Runner review

The runner has the necessary preservation and once-only gates:

- explicit `--live` is required;
- declaration bytes must match the reviewed SHA;
- declaration, frozen-runtime receipt, current `HEAD`, and clean-tree state must agree;
- the original result must still identify the same runtime, remain failed, and contain exactly nine exact/schema-valid successes;
- the freshly captured production schema must deep-equal the declared schema, and the local schema must parse the expected value;
- model/API and caller, role, and effective caps are asserted as Luna/Responses and 2,222/2,400/2,222;
- an existing result file prevents execution;
- the started receipt is written before the provider call and the terminal receipt is written on success or failure;
- bounded redacted errors, raw value, typed reason, schema validity, exactness, endpoint count, and usage are retained;
- passage requires exact structural equality, one endpoint request, and reported output usage no greater than 2,222.

The live call uses a newly captured schema from the frozen build and makes a single request. Failure remains saved before the terminal assertion exits nonzero. It neither overwrites nor retries the original fixture.

## Disposition

**Approved for one execution at declaration SHA `40f971a7df17ac739e545339f093071972ccd6e1ff8533f32ca224166ed89703`.**

This is one new amended fixture, not a replacement result. Preserve its outcome regardless of success. A pass would resolve the specific repetitive-padding confound and complete the declared transport evidence; a failure would remain a protocol blocker requiring independent diagnosis. This approval does not authorize corpus probes by itself.
