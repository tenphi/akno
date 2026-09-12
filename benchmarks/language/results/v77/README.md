# V77 terminal language and discourse evaluation

The terminal V22 trial **fails both the original 90% useful-answer gate and the separately predeclared
80% completion gate**. Reliability acceptance remains unmet. This closes the bounded implementation and
evaluation work in PR #70 with a measured failure and explicit limits; it does not close issues #61/#62 or
authorize a merge. No further tuning or replacement run follows this held-out result.

| Split / run     | Useful answers | Complete retained sets | Useful retrievals | Availability failures | Ordinary mismatches |
| --------------- | -------------: | ---------------------: | ----------------: | --------------------: | ------------------: |
| development / 1 |          63/80 |                   9/10 |             36/40 |                  1/11 |                0/11 |
| development / 2 |          52/80 |                   7/10 |             28/40 |                  4/11 |                0/11 |
| held-out / 1    |          52/80 |                   7/10 |             32/40 |                  0/11 |                3/11 |
| held-out / 2    |          53/80 |                   7/10 |             32/40 |                  0/11 |                3/11 |

The final independent grade is **220/320 useful writable answers (68.8%)** and **30/40 complete retained sets**. There were 221 published writable answers and 99 writable nulls. The grade records 0 unsupported retained sets, 0 unsupported published answers, 0 qualification errors, 0 accepted language violations and 0 unsafe factual promotions. All 32 read-only nulls were justified policy holds. Source bytes and replay passed in all 44 case-runs. The availability gate records 5/44 failed cases, distinct from the two answer coordinates explicitly typed verification-unavailable. Ordinary Markdown matched 38/44 expected classifications.

The ordinary failures are a safety-boundary defect: three nonfactual passages were marked eligible as
factual evidence in both held-out runs. Zero observed promotions in generated answers does not negate
this incorrect source eligibility. The [frozen replay](ordinary-projection-replay.json) and
[corrected forensic finding](reviews/ordinary-projection-correction.md) make that distinction explicit.

The answer target is applied to each split/run independently: 72/80 for the original gate and 64/80 for
the completion gate. Useful retention and retrieval still require 80%. Source entailment, qualification,
requested language, unsafe factual promotion, source bytes, read-only admission, ordinary-prose checks and
the maximum 5% case availability failure rate are unchanged. Pooled totals cannot rescue a failing cell.
Both [original](full-original-gate.json) and [completion](full-completion-gate.json) verdicts use the same
independent [final source-only review](output-review.json).

## What the PR delivers

`knowledge_language: "en"` gives generated knowledge an explicit owner-controlled language while keeping
source text and requested answer language separate. Original sources, identities and caller-provided
content retain their bytes. English and Russian answers are independently requested; a host remains
responsible for the language of its own final conversation response. Caller-provided retention is exact
and model-free, with a language attestation rather than an implied semantic proof.

Ordinary Markdown receives a deterministic English/Russian discourse projection bound to current source
bytes. Recognized reports, scenarios, questions, tentative statements and rejected proposals remain
inspectable with qualification and are excluded from unqualified factual derivation. Unsupported implicit
forms can still be misclassified; conservative holds also reduce useful retrieval and maintenance.

These are implemented boundaries. The terminal result does not establish reliable automatic multilingual
retention and answering. The [independent scope review](reviews/final-scope-review.md) separates the
implemented contracts from the unfulfilled reliability requirement.

## Terminal execution and review

Runtime `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8` stayed frozen throughout evaluation. V22 has eleven
development and eleven fresh held-out cases, each run twice. Every case has eight query-language,
answer-language and explicit/inferred-view coordinates: 320 writable observations and 32 read-only
controls. Inputs were independently reviewed before execution; the earlier accidentally exposed V21
held-out corpus was quarantined without running its full trial.

Runtime retention and answers use GPT-5.6 Luna; independent grading and forensic reviews use GPT-5.6 Sol.
Embedding and expansion roles are unchanged. The trial uses isolated 2,400-token retention/answer ceilings.
The service's existing 1,024-token answer overlay is outside this evidence. A finite invented corpus and
fallible model reviewers do not establish arbitrary-language, implicit-discourse or longitudinal reliability.

The full [launch manifest](full-launch-manifest.json), [independent preflight](full-preflight-approval.json),
[start receipt](full-started.json) and [completed provenance](full-completed-provenance.json) bind source,
built output, corpus, input approval, role policy, harness and the completion contract. All 44 case-runs
and 352 coordinates were present. Trace lifecycles balance; there were no model-call exceptions. Typed
degradation and semantic failures remain independently visible in the reports.

The source-only grader formed expectations before outputs and preserved its [initial review](output-review-initial.json).
The forensic reviewer separately compared sources, public outputs and then runtime traces. Reviewer
disagreements and corrections are preserved with the final adjudication; private runtime verdicts are
diagnostic material, never source truth. The held-out fragment was checked for exact equality with the
official complete packet before its grades were carried forward.

## Preserved diagnostic failure

The once-only exposed selected and built diagnostics aborted in external capture instrumentation. Its
unconditional Luna assertion rejected correctly configured query expansion before recording the call.
All twelve cases aborted before their 96 planned answer observations; zero query cells were recorded.
Retention, retrieval, replay and source-byte outcomes are unknown. Those missing observations are neither
safe abstentions nor evidence of semantic success.

Both failed reports, source/output packets and [independent root-cause review](reviews/harness-failure-forensics.md)
remain preserved. A separate full-only capture distinguishes three expansion modes, six Luna operations
including placement, and unknown operations. Mocked controls exercise actual production expansion and
placement, role-policy rejection, balanced exception traces and the fixed language-check ceiling. Two
independent reviewers approved it before the terminal full trial. No exposed diagnostic was replaced;
production runtime, model roles, semantic passes and caps did not change.

## Stopping decision and remaining design work

The user capped this continuation at ten iterations and allowed a lower target or a different approach.
The separately predeclared completion contract lowers only useful answering from 90% to 80%; its original
gate remains intact. Two iterations are conservatively charged, including the external harness correction.
The terminal trial is the stopping point. Lowering the target again would conceal the remaining failures.

The evidence favors a structural change over more phrase-specific guards: represent source-bound
propositions with explicit actor, predicate, polarity, object/property, epistemic mode and time witnesses,
then render that representation under the configured language policy. Preserve independent propositions
as a set so losing one cannot silently erase the rest; check that selected answer propositions respond to
the requested predicate. Any such redesign needs its own fresh evaluation. This trial does not establish
that a specialized or larger model is necessary or sufficient.

The remaining failures include loss of central report, assistant, time and competing-hypothesis records; incomplete retention of some independent propositions; source-answerable nulls after retention; a published counterfactual answer that states only the true antecedent instead of the requested unrealized benefit; development availability failures; and three nonfactual ordinary-Markdown passages incorrectly marked eligible as factual evidence in both held-out runs (six failures). The latter is an admission-boundary defect even though the independently graded generated outputs showed no factual promotion. Reviewer disagreements about focused subsets and redundant qualifications remain visible in the preserved reviews. They do not change the failing disposition.

## Verification and artifact map

The frozen runtime passed two independent code review/fix rounds, 3,910 tests in 152 files, all local
gates, exact-revision CI/docs, build/restart/socket deployment, 23 compiled control groups, and ten provider
controls over sixteen endpoint requests. Provider controls establish finite transport/schema behavior;
they are separate from the failed semantic result. Publication checks are recorded separately.

- [Development](development.json), [held-out](held-out.json), [source/output packet](source-output-packet.json)
  and [final metric summary](full-output-summary.json).
- [Input review](input-review.json), [source review](source-review.md), [forensic review](full-forensics.md)
  and preserved initial/corrected reviews.
- [Final review disposition](reviews/final-review-disposition.md), [source-grade reconciliation](source-review-reconciliation.md)
  and [initial/final temporal adjudication](reviews/rubric-adjudication-final.md) preserve the grading disagreements.
- [Completion contract](completion-contract.json), [final disposition](final-disposition.json),
  [top-level review](reviews/top-level-review.md) and [runtime freeze](runtime-freeze.md).
- [Failed selected diagnostic](selected-diagnostic-failed.json), [failed built diagnostic](built-diagnostic-failed.json)
  and [ungradable diagnostic disposition](reviews/source-grading-disposition.md).
- [Local artifact hashes](local-artifact-manifest.json) preserve original traces, logs and intermediate
  artifacts. Raw traces and logs stay local; only invented reports and reviewed receipts are published.
  Harness snapshots under `harness/` are exact provenance text, not runnable package entrypoints.

Earlier files such as `runtime-freeze.md` describe their historical checkpoint. This README and the final
disposition describe the terminal state. Original failures and earlier verdicts are not relabeled.
