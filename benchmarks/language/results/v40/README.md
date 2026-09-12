# V40 exposed-probe results

Frozen runtime `452f261` passed 2,080 tests across 132 files and all local build, lint, knip, formatting, documentation, smoke, installed-package and repository-safety checks. Two separate GPT-5.6 Sol review/fix rounds addressed a negated-booking clause-boundary defect. Build, service restart and socket readiness were verified at 20:20 local time. Runtime is GPT-5.6 Luna; independent input/output grading and separate code/forensic review use GPT-5.6 Sol.

| Probe | Complete useful retention | Useful retrievals | Useful answers |
| --- | --- | --- | --- |
| Selected exposed development | 2/4 | 24/32 | 26/32 |
| Built-package question/assistant | 2/2 | 16/16 | 16/16 |

All 48 writable answers are nonnull and language compliant. Six selected answers have accepted action-agency/source-entailment errors: the source says Ada Marlow has not selected a cause, but the answers state an unassigned nonselection. The retained alternatives sentence already has the same omission, so downstream verification reads an incomplete agent description. Only two alternatives answers restore the actual personal nonselector. Preserve this failure independently of fluency and uncertainty labels.

The rejected-offer retained set omits the separate absence of a booked handover. Its candidate joins that statement with rejection wording in one frame; the structural asserted-scope check holds it before and after the single repair. The primary rejected offer remains useful for the focused question. The new negated-booking check does not itself cause this hold.

The report, undated-proposal, question and assistant answers pass independent review. In particular, the built assistant answers preserve contractual meaning, and the undated answers retain the original source-relative clock. No unsafe factual promotion or source-byte change was found. These exposed successes do not establish repeated quality.

The [amendment](../../v40-trial-amendment.md) defers full execution. No full V40 trial began, and independently approved v19 held-out sources remain unexecuted. All models and gates remain unchanged; PR #70 stays open and unmerged.

CI separately failed the graph wrapper's aggregate mixed-retrieval check, with 2,079 tests passing. The original report omitted nested metrics, so the exact nested cause cannot be established from that log; a contended 20 ms latency check is a plausible explanation. The follow-up exposes those metrics and requires all non-latency correctness checks to pass in the unit test while keeping the production 20 ms budget and benchmark failure reporting unchanged. This does not alter the frozen language runtime or its results.
