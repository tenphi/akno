# Language v22 independent input review

## Method

I reviewed only `tmp/language-v22-proposed-inputs.json` and lines 45–59 of `packages/core/src/bench/language-review.ts`, which define the review artifact schema. I did not inspect runtime implementation or prompts, model outputs, traces, other reviews, private configuration, a knowledge base, or author notes. I did not author this corpus or tune the runtime, and I made no model calls.

I assessed every case from its source items, queries, admission metadata, and stated review expectation. The review considered independent understandability, invented content, material qualifications, attribution and role boundaries, scope, polarity, modality, temporal anchoring, and whether the expected retained answer would be complete and useful without adding unsupported claims.

## Disposition

Approved all 22 cases. The corpus contains 11 development cases and 11 held-out cases; each split contains 10 writable cases and 1 read-only case. Together they cover nested reports, hypotheses, counterfactuals, coverage exclusions, assistant speculation, fiction, unknown source-relative dates, competing alternatives, open questions, rejected plans, and read-only admission behavior.

The corpus fingerprint recorded by the corpus and this review is `b0e1d4871ac78007863609b90dd432588d7ef4d8e1c441f1255bdbf7bd564c8a`.
