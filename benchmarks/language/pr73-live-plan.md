# PR 73 live verification plan

This is a focused measurement of the Markdown scope and mixed-language evidence selection changes at
`745a8c45bceb6c03da7d26c3de19a3fae5450760`. It supplements the existing reliability results for issues
#61 and #62; it does not replace their full-corpus acceptance gate.

## Before execution

Use the earlier benchmark's OpenAI generation model and record the resolved model IDs, API type, token
ceilings, reasoning settings, and timeouts. Load connection settings without opening the live knowledge base. Every
operation runs against invented sources in temporary knowledge bases. No endpoint, credential, live vault
path, or private source content belongs in the published artifacts.

Freeze the runner, source cases, expectations, and built package hashes before the first model call. This
is an exposed diagnostic corpus, not a held-out generalization claim. No model switching, selective retries,
prompt edits, or threshold changes are allowed within a recorded run. Preserve failed runs and incomplete
operations. The runtime's own bounded repair and provider retry policy must be recorded separately.

## Scope

Run each of seven cases twice in a fresh knowledge base:

- Ordinary English assistant report under an indented heading with closing hashes.
- Ordinary Russian assistant report under an indented heading.
- Ordinary mixed-language hypothetical passage under an indented heading.
- Ordinary factual passage after an empty sibling heading ends a hypothetical section.
- Automatically retained English assistant report with an explicit verification limit.
- Automatically retained Russian assistant report with the same limit and English knowledge policy.
- Automatically retained mixed-language assistant report with that policy and limit.

For each case, use English, Russian, and mixed-language queries independently of requested English/Russian
answer language: 84 target answer coordinates across both repetitions. Compare inferred and explicit-view
retrieval; preserve the actual selected evidence and original qualification frames. For nonfactual cases,
separately verify that a factual-view answer cannot promote the qualified proposition. Check ordinary
factual retrieval after the empty heading so safe exclusion cannot conceal a loss of ordinary facts.

Retained cases run source → extraction/verification → placement → restart/rebuild → replay → recall/context
→ answer. Ordinary cases exercise read/recall/context/answer directly without replacing authored prose with
managed records. Source snapshots cover both file bytes and the set of files; retention's authorized additions
are measured separately from subsequent read/rebuild/replay preservation.

## Reporting and decision

Report retention completeness, language compliance, useful qualified retrieval, correct view selection,
source-supported answer usefulness, qualification preservation, and availability separately. Every null
target answer remains a coverage miss; missing models and failed verification are availability failures,
not evidence that the source was safely rejected. Auto-recall activation is reported separately because it
also depends on calibrated relevance.

Review every published answer against the original invented source and the expectation frozen before
execution. Runtime verifier acceptance alone is not a correctness label. Record who or what performed
the separate review and preserve initial grades and any corrections.

The focused confirmation requires zero accepted source, qualification, language, or factual-promotion
errors; unchanged source bytes after read/rebuild/replay; correct explicit/inferred view selection; and at
least 90% useful target answers within each ordinary/retained path and repetition. Report exact numerators
and denominators, even if the gate fails. A passing focused result would establish this bounded behavior,
not general model reliability or completion of issues #61/#62.

## Resolved provider profile

The user supplied a temporary OpenAI credential after the original deployment configuration could not be
located. Generation and retention use `gpt-5.6-luna` through the Responses API. Both roles use low reasoning
and the current committed 2,400-token ceiling; answer timeout is 60 seconds and retention timeout is 120
seconds. Provider retries are disabled. Embedding uses `text-embedding-3-small` at 1,536 dimensions.
Expansion, reranking, graph expansion, and index summaries/facts are disabled to bound this focused run.

This differs from the historical comparison's local embedding/expansion models, 1,024-token answer ceiling,
and retention timeout/reasoning configuration. Its scores must not be presented as a like-for-like improvement
over that comparison. The requested generation model remains unchanged. The historical independent reviewer
model `gpt-5.6-sol` was unavailable to this credential during model-access preflight; source-based review by
the implementing assistant will be labeled as such, not as independent model adjudication.

## Execution status

Inputs and expectations are prepared. Live execution requires successful generative and embedding preflight;
the runner records immutable manifests before executing the corpus and preserves every failed case.
