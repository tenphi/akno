# V24 trial plan

V24 changes answer verification in response to the exposed v14 built-package probe: a Russian answer
moved a component from an inspection-purpose phrase into the object being collected. It adds independent
proposition, action-argument and qualification-scope verdicts, without another verifier call or retries.
It also includes the separately tested maintenance-language boundary correction.

The v15 input corpus and prior independent input approval remain unchanged:
`4d03a9fde500f2c415f13add30b5db1d3bc843892bb052b3f207be47f9be1746`.
Its development split contains exposed v14 sources. The v15 held-out outputs from the v23 trial have not
been opened or graded while making this revision. Freeze v24 before opening those outputs; any later
output-driven runtime change requires fresh held-out sources for an unexposed evaluation claim.

Run both complete splits twice, with ten writable scenarios and one read-only case per split and eight
query-language/answer-language/explicit-view combinations per scenario. Keep GPT-5.6 Luna as runtime and
GPT-5.6 Sol as the separate input/output reviewer. Require at least 90% useful answers in every split/run,
80% useful retention and retrieval, at most 5% case availability failures, and zero accepted language,
qualification, source-entailment, promotion or source-byte errors. Null answers are not useful.

Preserve both v23 and v24 reports and independent judgments, including failed outcomes. Do not select a
favorable repetition or replace a prior output. The gate describes this finite English/Russian corpus,
not general or longitudinal reliability.
