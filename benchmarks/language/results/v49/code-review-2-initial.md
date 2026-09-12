# V49 code review round 2 — initial

## Scope

I reviewed the current uncommitted diff against `bc206c8`, including the final inference-boundary and coverage-wording updates made during this review. I inspected the shared proposition-scope contract, answer composition and verification prompts, retention extraction and verification prompts, inferred memory-view rules and negative controls, source-clock floor, V20 corpus/review wiring, frozen input review, trial plan, docs, and prompt-version updates. I made no runtime or test changes and made no live provider calls.

## Disposition

No release-blocking code finding remains in the reviewed V49 scope. The change is coherent enough to freeze and subject to the planned exposed and fresh semantic evaluation after the complete local gate. That evaluation remains necessary: the main changes to proposition scope, clarification precedence, and translated coverage roles are fallible model instructions, and deterministic tests cannot establish their semantic reliability.

One low-priority structural test-coverage omission remains. It does not change current runtime behavior or the gate:

### P3 — V20 is absent from the language-gate fixture's version matrix

`packages/core/src/bench/language-review.test.ts:24-25` limits its fixture type to V19, and the stronger-gate matrix at `:208` also stops at V19. Production wiring does include V20 at every relevant branch in `language-review.ts`, and an independent direct call shows V19 and V20 return identical thresholds: 90% useful answers, 80% useful retention/retrieval, zero accepted language/qualification/promotion/source-byte/source-entailment errors, and 5% maximum availability failure. The V20 corpus test pins its fingerprint and 10-writable-plus-1-read-only shape per split. Therefore this is a future-regression gap in gate accounting tests, not evidence of a current gate change and not a reason to invent a semantic stub test or defer the live evaluation.

## Findings by requested area

### Shared proposition-scope contract

`PROPOSITION_SCOPE_CONTRACT` is defined once in `models/semantic-verdict.ts` and reaches all four relevant judgments:

- answer composition through `ANSWER_SYSTEM_PROMPT`;
- answer verification through `SEMANTIC_COMPARISON_CONTRACT`;
- retention composition through the retain system prompt;
- retention verification through the same semantic comparison contract.

The contract preserves the exact boundaries exposed by V48: the actor and object of personal epistemic limits, both premise and consequence of a selected hypothetical rule, complete material roles under fictional scope, neutral provenance without invented positive or negative recording claims, and actual proposal/discussion acts separately from embedded modality. It does not change the Zod verdict schema, weaken any of the three required booleans, bypass retained-excerpt selection, add a retry, or add a model call.

There is intentional overlap with older prompt rules, but no semantic contradiction in the reviewed text. In particular, “neutral provenance” applies to outer framing, while the following invariant still requires a source-supported proposal or discussion act to remain material. The frame contract continues to prohibit using original source context as a standalone proposition or citation authority.

Residual risk is model compliance and comparison consistency. The contract can cause a safe rejection or longer answer when a selected record is incomplete, but it does not deterministically guarantee actor binding or coupled-clause preservation. The planned source-only grading is the right evidence for that behavior.

### Explicit clarification before conflict abstention

The answer prompt now establishes an explicit order: first resolve a referent only when the supplied evidence or its bound source frame explicitly clarifies it; then abstain only if values remain incompatible. The adjacent text also says that a language switch and lexical similarity alone do not establish equivalence. This preserves the existing safe conflict behavior while avoiding abstention merely because one source-defined referent has different surface forms across languages.

The semantic verifier already instructs the model to use explicit clarification in complete supplied context, reject an incompatible extra component, and preserve ambiguity when no clarification exists. Retention extraction likewise requires both exact spans and makes the supplied clarification, rather than dictionary knowledge, authoritative. The apparent conflict with the frame rule is resolved correctly: a frame may constrain the meaning of the selected retained record, but may not add an unrelated proposition or silently repair a genuinely conflicting retained claim.

This is prompt ordering rather than deterministic resolution logic. The V20 nested-report source and the selected V19 regression source exercise explicit bilingual clarification, while the frozen corpus retains unrelated ambiguity/conflict controls.

### Warranty and coverage roles

Composition now says that when the source covers a service or repair, that service or repair remains the covered subject and the warranty the covering instrument. The final qualification correctly preserves a component or damage as subject when the source itself uses that form. This avoids the earlier blanket wording that could have rewritten a valid component/damage exclusion.

Verification independently compares covered subject and covering instrument and gives concrete English/Russian inversions. It applies inside questions and negations, so retaining uncertainty cannot excuse a reversed embedded relationship. No deterministic heuristic accepts an answer based on noun overlap; all existing semantic booleans and mismatch consistency remain required.

The fresh exclusion case tests a cracked base-plate exclusion alongside unresolved drive-shaft-repair coverage. The previous held-out case remains available in the exposed development regression. Actual Russian grammatical performance still belongs to the live evaluation.

### Source-clock activation

The only deterministic time change adds `source noun + с неизвестной календарной датой`, with punctuation/end lookahead. It does not accept `...датой ремонта` or a date attached to a meeting or device. Existing activation remains conjunctive:

1. retained temporal precision is `unknown`;
2. retained prose has deictic time;
3. retained prose has a source-relative anchor;
4. retained prose has an unknown source clock.

Answer preservation separately requires both the anchor and unknown clock. The added positive and negative tests exercise exact punctuation/end forms, repair-date suffixes, and unrelated event/device nouns. This is a bounded lexical extension and does not alter factual eligibility or synthesize a date.

### Inferred memory views and negative controls

The new view rules select a view only; `memoryEligibleForView` is unchanged. Reports therefore remain limited to `basis === source_report`, and discussion remains limited to tentative/hypothetical/counterfactual/proposed/rejected memory.

The current rules are bounded by content noun, predicate, actor/modal context, word distance, and clause separators:

- Russian qualified retellings require a qualified `сообщение` construction with a finite reporting verb.
- Russian assistant readings require a qualified epistemic noun and assistant proposal predicate.
- Unrealized variants require the qualified variant noun and a describing/considering/discussing predicate.
- Fiction requires a bounded fictional example/promise, and Russian fictional promises additionally require a discussion/description predicate.
- English tentative assistant reports require assistant attribution, tentative qualification, and `may/might/could`; an action suggestion without that modal does not activate reports.

`DISCOURSE_WORD` prevents the bounded gaps from crossing the tested English and Russian coordination/subordination tokens, and punctuation cannot occur in the gap. The added negatives cover remote predicates, physical/product versions, completed variants, ordinary promises, action suggestions, and mixed clauses. Targeted execution of `intent.test.ts`, `source-clock.test.ts`, and `language.test.ts` passed 158 tests. `git diff --check bc206c8` is clean.

These are intentionally narrow recall improvements. Some natural paraphrases will still fall back to factual and produce null; that is a coverage risk, not a broadening defect. Expanding the cue vocabulary from live V49 outputs would expose and tune on the fresh corpus, so any such work must use another fresh held-out set.

### V20 corpus, approval, and unchanged gate

The V20 corpus has 22 unique cases: 11 development cases copied from the now-exposed V19 held-out split and 11 fresh held-out cases. Each split contains ten writable and one read-only case. Its computed fingerprint is `8658f0d00661221cf4e042ffb78f5ed2f3c6b575ab254b81b65ded6e853ea0e9`, matching both the pinned test and `benchmarks/language/results/v49/input-review.json`. The input review contains 22 unique matching IDs and 22 approvals.

`runLanguageBench`, CLI validation, review-packet corpus selection, v2 packet selection, source-dimension integrity, entailment review requirements, breakdowns, and gate thresholds all include V20. V20 and V19 produce the same gate object. Prompt and memory-view versions are incremented, including the grounded-answer benchmark expectation.

The trial plan keeps the previous failed trial and exposed inputs, separates the selected V20-development probe from the V19 regression probe, requires every started run to finish, forbids semantic retries and threshold changes, and reserves the complete fresh V20 trial for independently approved inputs. It explicitly requires a new fresh corpus after tuning on V20 output. I found no path that silently substitutes V19 for `corpus: 'v20'`; the terminal branch selects V20 only after explicit handling of V19.

## Verification considered

- Current diff inspected against `bc206c8`, including concurrent final fixes.
- V20 fingerprint, split counts, approval count, unique IDs, and exact approval/corpus ID correspondence recomputed locally.
- V19 and V20 gate thresholds compared directly and found identical.
- Targeted deterministic tests: 158 passed across memory intent, source clock, and language corpus/wiring tests.
- `git diff --check bc206c8`: clean.
- Parent reported the complete rerun passing 2,233 tests across 133 files after the final inference-boundary fixes; the final coverage wording is prompt-only and was inspected directly here.

No live call was made. No synthetic judgment is treated as evidence of model reliability.
