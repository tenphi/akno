# V76 provider-control declaration review — final

Independent Sol review, read-only. This final review preserves `tmp/language-v76-protocol-design-review-initial.md` and inspects the prepared declaration against that design, the frozen runtime, the current capture code, and the preserved V75 natural verifier declaration. I made no provider or semantic call.

## Evidence and provenance

- Frozen HEAD and `tmp/v76-frozen-runtime.txt` both contain `44e6e714f1758948f306ec90cdae9b0d453e3604`.
- The tracked worktree is clean.
- `tmp/v76-protocol-declaration.json` exists; `tmp/v76-protocol-results.json` does not. No live protocol suite has started.
- The declaration contains exactly ten fixtures and hashes to `89352e531e0274e79d60cd0583fa763652eb9bf73455275a977cf7182119ce0c` over its exact UTF-8 bytes.
- `tmp/v76-protocol-prepare.log` records declaration preparation after the local compiled capture checks. Those capture paths use local stubs and establish schema/payload construction, not provider or semantic performance.

The prepare log labels JavaScript string length as `bytes` (`352557`), while the UTF-8 file size is `353334` because the invented fixtures include non-ASCII characters. This is a non-blocking label imprecision: the recorded SHA-256 and live drift check operate on the exact serialized UTF-8 content, and the declaration itself is intact.

## Exact fixture review

The declaration contains the intended logical controls and APIs:

- six Responses controls for copy generation, two-record answer verification, clock translation, positive retention verification, maximum negative retention verification, and four-branch repair;
- four maximum language controls covering Chat Completions and Responses, each with coherent compliant and noncompliant outcomes.

The declared two-record answer-verifier endpoint schema is deeply identical to `tmp/v75-natural-verifier-declaration.json`, and its expected response is also deeply identical. The current V76 captured Zod schema accepted that expected response during preparation. V75's old runtime identifier is not imported into the V76 declaration; frozen provenance is supplied by the V76 live guard and receipt.

The mixed repair fixture has the expected strict branches and exact bounds:

- report text-only: 200 + 78 + 120 characters, plus two spaces = 400;
- clock with exclusion: 195 + 90 + 60 + 52 characters, plus three spaces = 400;
- clock without exclusion: 220 + 110 + 68 characters, plus two spaces = 400;
- one unchanged full-candidate repair branch.

The new exclusion is exactly 60 UTF-16 code units: `Processing time is not the reference point for «next month».` It names the same source-defined period and fits the unchanged field cap. Preparation asserted strict schema parsing and exact 400-unit materialization for all three text-only branches.

Cap declarations remain coherent: answer controls use 2,222 effective tokens; language controls use 1,024; retention callers request 3,744, 8,544, or 3,200 but are explicitly limited by the 2,400 role ceiling. These are declared transport limits, not guarantees that every output will fit.

## Live-suite safeguards

The live path reconstructs the complete declaration and requires byte-for-byte equality, exact frozen HEAD, a clean tracked worktree, and absence of a prior results receipt. It creates the receipt before the first control. Each logical result and each wrapped transport are persisted as `started` before execution and updated on completion or exception. Errors are secret-redacted, URL-redacted, and bounded; endpoint counts and usage remain recorded.

Final success still requires all ten logical controls to be provider-successful, locally schema-valid, deeply exact, consistent with the declared language-audit status, and within their declared caller/effective caps. Every observed transport must complete successfully at the effective role ceiling. A failure is preserved and stops the suite's final assertion; there is no unchanged retry or replacement.

## Disposition

**Approved for one live execution of the declared provider-control suite.** The immutable declaration, schema continuity, natural maximum fixture, four-branch clock fixture, caps, exactness gates, and once-only accounting match the reviewed plan.

This approval covers only the ten transport controls. The compiled 21-group run, CI, completed live receipts, deployment evidence, and final independent preflight remain required before any semantic probe. It is not semantic-launch approval and makes no model-competence claim.
