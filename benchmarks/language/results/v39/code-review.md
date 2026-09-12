# V39 code review

Reviewer: GPT-5.6 Sol in a read-only code-review role. Compared the uncommitted V39 changes with `8bffad1`. No fresh v18 output was inspected.

## Round 1 disposition

No actionable findings.

The retention instruction preserves the existing normalized attribution contract: the structured outer narrator remains `source_speaker`, actual inner reporters remain in `chain`, and the outer narrator is not duplicated there. Its new requirement is proposition-local: close the inner reported clause before a narrator correction while keeping both clauses and shared verification limits in one candidate. It does not relax cleaning, attribution normalization, semantic verification, repair limits, or call counts. The accompanying prohibition against converting a discussion clarification into a document-wide restriction addresses the observed scope error without encoding the invented hinge vocabulary.

The answer generator now receives temporal status as a localized presentation label separate from commitment and disposition. Original typed values remain in the same generation excerpt and remain the sole values in verifier input and public context. The integration test covers the important mixed state—asserted commitment, proposed disposition, tentative temporal status—and checks that display labels do not enter verifier/public evidence.

The hypothesis guidance now asks generation to retain source-supported consideration and its actor. The verifier clarification does not make neutral record provenance evidence of an embedded act: it expressly continues to reject changed or omitted material agency and prevents attribution metadata from supplying a missing consideration or nonselection actor. The deterministic V38 nonselection floor and all three semantic-verification dimensions remain unchanged.

Prompt-version bumps and the benchmark wrapper expectations agree. The V39 plan accurately records the V38 probe counts, unchanged fingerprint/models/gates, absence of a V38 full trial, and the freeze-before-fresh-execution procedure. The changed content uses only the repository's invented vocabulary.

I did not run tests for this review; focused and full checks were still being run by the implementing agent.

## Round 2 adversarial disposition

No actionable findings.

The localized temporal labels do not collapse the three independent dimensions. In particular, `предварительный срок` describes only `temporal.time.status: tentative`; the prompt expressly says a stated proposal may have tentative timing, while the original `commitment: asserted` and `disposition: proposed` remain visible to generation and authoritative to verification. The label does not say the plan was accepted or the meeting was arranged. `planned timing` and `scheduled timing` are used only for their corresponding typed temporal statuses.

The retention addition keeps the narrator correction in the same retrievable unit but outside the inner report's complement. It explicitly prohibits moving the contrast into the inner speaker's words or broadening a discussion clarification into a contract restriction. Its metadata direction matches normalization: outer narrator in `source_speaker`, actual inner reporter in `chain`, with no repeated outer entry. Existing exact support/frame and three-dimension verification still reject a model that ignores that instruction.

The answer changes use two complementary constraints rather than treating neutral provenance as a substitute for agency. Generation must state the source-supported consideration and its actor. Verification may disregard a neutral `the record attributes...` wrapper only while separately comparing embedded content and actors; it expressly rejects omitted or changed consideration/nonselection agency. The V38 deterministic floor remains in place for the observed singular nonselection case. I found no path in this diff that converts attribution metadata into action authority or bypasses semantic verification.

I relied on the implementing agent's reported green build, lint, knip, formatting, safety, documentation, and 2,054-test run. I did not rerun those checks in this round; smoke was still running when requested.
