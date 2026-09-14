# Clean postvalidation and scoring review

## Scope

I performed a final bounded, read-only static review of the updated `validate-public.mjs`, `postvalidate.mjs`, and `score.mjs` against the frozen comparison procedure and grading contract previously reviewed. I did not execute validation or scoring, inspect live outputs, packets, grades, blind mappings, or model traces, or alter any execution or grading artifact. The earlier review reports remain unchanged.

## Assessment

The remaining validation gaps identified in the prior review are closed, and I found no new concrete defect in the reviewed paths.

`validate-public.mjs` now compares the complete retain input against the frozen one-source request, including source ID, revision, items, extraction mode, and exact mission. Replay is bound to that complete input. It requires a null case error, rejects public/open throws, reconciles the exact public operation sequence and review-bearing results, and recomputes retention and overall availability, language rejection, noncanonical eligibility, and semantic-match diagnostics using the same conditions as the frozen common procedure.

`score.mjs` now requires exactly two parts for every aggregate grade, verifies each referenced part hash, and requires the aggregate cases to equal the ordered concatenation of the two part case arrays. This proves the grade assembly rather than merely proving that referenced part files exist unchanged. It also requires every grade case's observation membership to equal the exact anonymous candidate set, eliminating ungraded extras.

The broader chain remains sound:

- postvalidation binds the frozen declaration, corpus, source obligations, validator code, completed receipt set, per-arm case receipts and traces, model policy, and candidate runtime/source/dist proof;
- every case/run and all eight query coordinates are exact;
- packet source data, coordinates, retained knowledge, stored pages, answers, and retrieval values are tied to validated public receipts;
- one retrieval identity is enforced per query/view pair across answer languages;
- read-only justification requires the exact public policy-hold path, empty retention, and null answers;
- initial grades are preserved and final differences must replay from explicit, reasoned correction ledgers;
- empty retention cannot be complete;
- answer, retention, and retrieval coverage use the worst individual block/run, while case availability is also bounded per block/run; and
- zero-tolerance semantic, qualification, language, promotion, byte, ordinary-control, and replay failures cannot be offset by pooled success elsewhere.

## Disposition

Clean static assessment. The reviewed postvalidation and scoring chain is consistent with the frozen declaration and grading contract for the comparison and one-arm integration modes. This conclusion is limited to the code paths reviewed; successful execution remains the final evidence that completed artifacts satisfy them.
