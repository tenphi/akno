# V77 publication audit — initial independent review

Date: 2026-09-12
Reviewer: GPT-5.6 Sol
Scope: publication artifacts and user-facing claims only. I did not edit runtime or evidence, call a provider, rerun a benchmark, or regrade the 352 output coordinates.

## Initial disposition

No actionable publication defect found.

## Metric and gate reconciliation

The published source-only review, both gate JSON files, the output summary, the final disposition, and the three user-facing summaries agree:

| Split / run | Useful answers | Complete sets | Distinct useful retrievals | Case availability | Ordinary mismatches |
| --- | ---: | ---: | ---: | ---: | ---: |
| development / 1 | 63/80 | 9/10 | 36/40 | 1/11 | 0/11 |
| development / 2 | 52/80 | 7/10 | 28/40 | 4/11 | 0/11 |
| held-out / 1 | 52/80 | 7/10 | 32/40 | 0/11 | 3/11 |
| held-out / 2 | 53/80 | 7/10 | 32/40 | 0/11 | 3/11 |

These sum to 220/320 useful writable answers, 30/40 complete writable retained sets, and 128/160 distinct useful retrievals. Every cell misses the original 72/80 answer target and the separate 64/80 completion target. The original and completion verdicts are both false; the completion verdict also retains the retention, retrieval, availability, ordinary-prose, source, qualification, language, promotion, byte, and read-only requirements.

The apparently different retrieval count in `source-review-reconciliation.md` is compatible with the gate. The review matrix has two answer-language rows for each query-language/view retrieval, so 128 distinct successful retrievals appear as 256 true coordinate judgments. Its 352-row denominator also includes the 32 read-only coordinates. The gate deduplicates answer language and scores the 160 writable query-language/view pairs, as documented in `docs/language-and-discourse.md` and stated directly in `reviews/final-review-disposition.md`.

The availability denominators also remain separate and accurately labeled. Five of 44 case-runs carry case-level availability failure, all in development. Only two of the 352 answer coordinates are typed `verification_unavailable`; the development report separately records six answer-operation failures. None of these is presented as a sound semantic rejection.

## Safety and ordinary Markdown

The final grade records zero unsupported retained sets, unsupported nonnull answers, qualification errors, accepted language violations, or unsafe factual promotions among published model answers. The publication does not turn that finite observation into a universal safety claim.

The ordinary-projection correction and deterministic replay explicitly preserve a separate admission defect. In each held-out run, the nested report, assistant speculation, and competing-hypotheses prose body is classified as factual, qualified, and answer-eligible despite `ordinaryFactual:false`. That is three defects per run and six total. The README, product documentation, PR draft, final forensic correction, and final disposition all call this factual-eligibility failure out independently of the zero observed generated-answer promotions.

## Review history and temporal ruling

The initial 170/320 source-only grade, corrected 220/320 grade, stricter forensic interpretation, and the reasons for their disagreement are all retained. The final temporal adjudication is directly linked from the evidence README and preserves its initial contrary judgment. Its final ruling treats “two weeks after the record” together with the record's missing date and unresolved calendar date as selecting the undated source record and excluding processing time. It separately keeps the fictional retained set incomplete for omitting Ada's actual introduction act while allowing focused answers to identify the fully scoped fictional loan. The publication marks these as interpretation/reconciliation history and does not imply unanimity.

## Artifact and provenance checks

- The result directory contains 93 normalized publication artifacts: 91 mapped local originals plus the copy map and local-artifact manifest. The README, normalization receipt, and two publication receipts account for the remaining four files in the 97-file result directory.
- All 91 mapped source files and destinations exist. Their original hashes match the map. All 93 published hashes match `publication-copy-normalization.json`.
- The 78 exact copies are byte-identical. The three JSON-format-only copies parse to identical data, and the 12 Markdown changes normalize to trailing-line/EOF whitespace only.
- The output summary's hashes bind the final review and both gates. The final disposition binds that summary and the same review/gates. Packet, input-review, corpus, runtime, report, and completed-provenance identifiers agree.
- The development and held-out reports contain 44 case-runs, all with `bytesStable:true` and `replayOutcome:"replayed"`. Their file hashes match `full-completed-provenance.json`; trace hashes and lifecycle counts remain represented in the local artifact manifest.
- Historical checkpoint files retain their original time-bound claims. The top benchmark README labels them historical, while the result README and final disposition alone state the terminal outcome.

## Links and privacy

All relative links in the authored V77 README, benchmark README, and language/discourse documentation resolve against the staged tree. Review snapshots intentionally retain local execution-era references; `artifact-copy-map.json` supplies their published destinations. The PR draft points at the branch evidence tree and states that PR #70 remains open and unmerged and issues remain unchanged.

The changed content contains the repository's invented fixture vocabulary and reviewed invented corpus. I found no absolute user-home paths, credentials, authorization headers, API keys, personal email-like values, or local configuration/knowledge-base content in the publication tree or authored documentation. The staged changes are evidence and documentation; production source and dist digests remain the frozen runtime values.
