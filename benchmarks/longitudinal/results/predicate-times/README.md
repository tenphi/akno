# Predicate date attachments (#187)

This follows [deciding evidence](../current-decisions/README.md). The unchanged invented source dates
a booked journey, then establishes a completed payment without dating that payment. A correlated copy
still describes one journey and one payment. The earlier answer incorrectly turned the journey date
into the payment's completion date.

Automatic extraction now keeps the two temporal scopes explicit. An undated completed action can be
retained as an asserted claim with no event time. Admission requires grounded predicate/time/status
comparisons in addition to the existing semantic verdict. An incomplete, unavailable or changed
comparison cannot authorize a write.

For answers citing a bound original frame or typed temporal record, a separate model call reads the
selected source predicates without seeing the draft or question. The verifier selects immutable
source-predicate IDs rather than rewriting that source reading to fit the draft. Exact quotation,
date presence, temporal relation and complete-record coverage are checked independently of broad
approval booleans. These readings constrain verification; they cannot introduce adjacent source facts
absent from the cited readable record. Provided-candidate authority and the wire protocol are unchanged.

The final local gate passes 4,693 tests, build, lint, unused-code checks, documentation build, repository
safety checks and the built socket/client and installed-package smoke controls. Regression tests cover
positive and negative date attachments, missing or ungrounded audits, immutable source IDs and
incomplete selected-record coverage.

## Controlled reproduction and positive cases

The sealed-record socket/client control uses the same readable copy and original source frame on
released 0.18.1 and the candidate build. Its negative draft is deliberately scripted to reproduce the
old erroneous answer; source reading and verification are live. Its positive answer is generated
naturally. Both versions use the same 8,192-token role ceiling and 2,400-token operation answer budget.
This isolates verification from stochastic extraction and generation; it is not a natural failure rate.

| Answer role    | 0.18.1 bad draft, before / after restart | Candidate bad draft, before / after restart | Candidate natural answer |
| -------------- | ---------------------------------------- | ------------------------------------------- | ------------------------ |
| `gpt-5.6-luna` | answered / answered                      | verification unavailable / rejected         | faithful retained record |
| `gpt-6-luna`   | rejected / answered                      | rejected / rejected                         | faithful retained record |

Both natural answers preserve the journey's date and completed payment without claiming a payment
date. Restart/rebuild preserves the fixture's Markdown bytes. The unavailable result is a safe hold,
not successful semantic rejection. An earlier candidate with source interpretation inside the draft
verifier still approved the bad answer after restart; that failed diagnostic caused the separate
source-reading stage. It is not included in the final comparison.

A second control supplies fixed invented candidates to live admission verification. It does not
measure extraction. The four positive cases are an undated completion, scheduled journey, explicitly
different payment/journey dates, and an explicitly shared date. The negatives transfer the journey
date to the payment or promote the booked journey into an occurred departure.

| Derive role    | Positive admissions, 0.18.1 / candidate | Candidate negative cases                        |
| -------------- | --------------------------------------- | ----------------------------------------------- |
| `gpt-5.6-luna` | 1/4 / 3/4                               | both held; scheduled-journey positive also held |
| `gpt-6-luna`   | 2/4 / 4/4                               | both held                                       |

These small controls show useful positive behavior as well as holds. They do not establish reliability
rates. A separate isolated control using the installed `gpt-6-luna` answer role and its unchanged
1,024-token ceiling also answers the faithful record and withholds both bad drafts as verification
unavailable. The shipped default ceiling increases to 4,096; explicit lower settings remain respected.
The additional source-reading call and fuller audits can increase latency and model cost.

## Final frozen comparison

The final built-core/socket/client run keeps both frozen discourse episodes unchanged: development and
held-out, two derive roles, extract-only and maintained arms, one repeat; eight trajectories and 48
checkpoints. The answer role is fixed to `gpt-5.6-luna` with a 4,096-token ceiling and 2,400-token
operation budget. The previous #172 cohort used a lower role ceiling, so its coverage is not a paired
before/after quality comparison. Derive substitution couples extraction, verification and maintenance
roles. Semantic maintenance transforms are disabled; the maintained arm checks lifecycle stability.

| Split       | Derive role    | Arm          | Booking/payment at correlated confirmation      | Answer at that checkpoint      | Later departure answer                              |
| ----------- | -------------- | ------------ | ----------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| development | `gpt-5.6-luna` | extract-only | both held                                       | typed current hold             | April 22, payment unchanged, occurrence unconfirmed |
| development | `gpt-5.6-luna` | maintained   | undated payment admitted; journey held          | no usable draft                | April 22, occurrence unconfirmed                    |
| development | `gpt-6-luna`   | extract-only | schedule and undated payment admitted           | verification unavailable       | April 22, payment unchanged, occurrence unconfirmed |
| development | `gpt-6-luna`   | maintained   | schedule and undated payment admitted           | verification unavailable       | verification unavailable                            |
| held-out    | `gpt-5.6-luna` | extract-only | both held                                       | typed current hold             | independent journey identity only                   |
| held-out    | `gpt-5.6-luna` | maintained   | dated journey and undated payment copy admitted | faithful copy; no payment date | independent journey identity only                   |
| held-out    | `gpt-6-luna`   | extract-only | schedule and undated payment admitted           | verification unavailable       | April 22, payment unchanged, occurrence unconfirmed |
| held-out    | `gpt-6-luna`   | maintained   | schedule and undated payment admitted           | verification unavailable       | independently supported proposal decision only      |

Author review of the retained journey/payment units, selected evidence and published answers finds no
transferred payment date, occurred departure or additional transaction in this cohort. This is a
bounded temporal-scope review, not a passing broader semantic-quality estimate. Useful combined
booking/payment answer coverage is only 1/8; conservative holds remain material. The separately
controlled natural positives must not be substituted for this cohort's coverage.

Reordered booking/copy replay adds no support. One held scope correction is re-evaluated and admitted;
that is not counted as model-free replay. Retraction followed by restart/rebuild leaves no admitted
journey/payment units in any trajectory. Unrelated unresolved equipment state can remain held.
The runner's source-byte control does not inspect its skeletal destination pages; the focused fixture
and deterministic held-write tests establish byte preservation at their respective boundaries.

There are 615 recorded operations and 615 model-method calls, with no failed operation. Provider usage
is missing for 291 calls, so aggregate tokens and cost remain unknown. Derive deadlines are 300 seconds;
the answer deadline is 60 seconds. No seed is supplied. Review is by the implementation author, not an
independent reviewer. Typed unavailable results are not counted as successful quality checks.

Frozen corpus fingerprint:
`872faa32464940389060e333f2647b534c0b2fd25c1bdd06c8f9358a9cade040`.
Input-review fingerprint:
`75d2f438eeae0b9ad3aecf4bd43ab57b1472005466440d200db6f2c058f911c3`.
Each packet records the complete 14-file compiled inventory. The reviewer accepts that exact inventory
and the exact historical 11- and 13-file inventories, rejecting unknown or incomplete inventories.
The temporal audit module is bound by the runner's SHA-256 of its JSON-encoded UTF-8 text
`0decd0479f3003cdac90a40bd01bf3101ace1a92ba5cbd5411e578ae69c6f038`.

All raw packets, traces, admission/answer controls and unsuccessful diagnostic iterations remain
ignored under `bench-results/predicate-time-187/`. No private knowledge-base data is published.
