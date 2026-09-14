# V65 bounded reference design review

## V64 terminology check

The V64 selected forensic note does **not** conflate the selected report with receipt. It consistently describes the source and retained/public wording as Ada `having no independent confirmation` / `has no independent confirmation`. That is possession of confirmation. It separately contrasts this with Ada personally performing confirmation. No substantive correction or preserved replacement copy is needed.

The distinct built-source wording `has not received confirmation` should remain a separate predicate in any cross-probe summary. Neither form licenses `has not confirmed`.

## Exclusion reference design

The proposed generation-side correction is preferable to an anaphora exemption in the verifier. The source directly supplies a grammatical epistemic subject—`Эта запись об исключении`—and directly supplies its predicate/object: it does not resolve whether fan-motor repair is covered and does not claim contractual silence. A retained clause such as:

> `The Zephyr QX-100 exclusion record does not resolve whether fan-motor repair is covered and does not assert that the contract is silent about that repair.`

faithfully repeats the named record context while leaving the motor's ownership unstated. It does not convert `fan motor` into `Zephyr QX-100's fan motor`, and it gives routing/recall a readable product anchor without asking the verifier to infer ownership.

The bounded generation rule should be:

- preserve an explicitly named subject at the attachment the source gives it;
- when a later epistemic clause is governed by `this/the record`, name that record with the already supplied subject label if needed for a self-contained candidate;
- preserve the later action/object at its original specificity instead of attaching the subject label possessively to that object;
- do not infer that every component, repair, person, or action in the frame belongs to the named subject.

This keeps the distinction between **record identity** and **component ownership**. Subject/page metadata remains routing input and cannot authorize prose; the readable named record must be supported by the exact source frame. Full semantic verification remains mandatory and unchanged.

## Required contrasts

- Positive: named Zephyr exclusion followed by `this exclusion record` and `fan-motor repair` yields `The Zephyr QX-100 exclusion record ... fan-motor repair`, without possessive motor ownership.
- Negative ownership: the same source must not yield `Zephyr QX-100's fan motor` unless that relation is explicit.
- Competing entity: a frame naming Zephyr and a separate Vulpine record must not attach Zephyr to Vulpine's record or component.
- Separate clause: a product name in an unrelated preceding proposition must not qualify a later generic record.
- Query-only identity: a product named only in the question cannot enter retained prose.
- Metadata-only identity: candidate subject/page cannot substitute for readable source attachment.
- Exact source ownership: when the source explicitly says `Zephyr QX-100's fan motor`, retaining that possessive remains valid.
- Semantic negative: even with the correct named-record subject, changed coverage polarity, repair object, silence scope, or epistemic predicate must still fail the existing verifier.

## Recommendation

Use the generation-side attachment rule and retain the current entity/action verifier. It addresses V64 row 76 by avoiding the unsupported-looking ownership specialization rather than teaching the verifier a broad same-frame anaphora exception. The remaining limitation is model compliance: the generator can still choose a possessive paraphrase, which should continue to be rejected unless the original frame establishes it.
