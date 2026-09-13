---
'@tenphi/akno-core': minor
'@tenphi/akno-protocol': minor
'@tenphi/akno': minor
---

Add an opt-in English knowledge-language policy and independent English/Russian answer-language requests.
Generated prose is checked against the selected language; exact evidence, existing identities and
caller-provided text keep their original bytes. Provided retention requires an explicit language
attestation when English knowledge is configured, and revision replay preserves its recorded policy and
outcome. The default `knowledge_language: null` preserves previous language targeting only; Markdown
qualification and the updated retention and answer verification also apply when it is unset.

Qualify a bounded set of English/Russian Markdown reports, hypotheses, examples, questions and proposals
before selecting excerpts. Preserve enclosing headings and deciding context, keep embedded nonfactual
claims out of factual derivation and graph inference, and retain qualified inspection. Projection
upgrades rebuild derived qualifications without editing source files; summaries and maintenance that
could discard those qualifications are held.

Check generated retention and answers against their original sources for attribution, action
roles, polarity, uncertainty, fictional scope and source-relative time. Expose typed hold stages,
availability failures and answer rejection counts. One structural extraction repair can precede semantic
verification; a semantic rejection is final. The default answer-role output ceiling becomes 2,400 tokens
to accommodate verification, while explicit caller and provider-role limits remain authoritative.
Otherwise-valid relation-free generated reports with unfamiliar wording for personal epistemic limits
go directly to the existing source verifier, which requires evidence from their own source and current
text. They no longer undergo a forced report rewrite. Complete-record answers preserve the exact
spelling of a non-generic source speaker already named in the selected readable record.
Recognize the prescribed Russian source-clock sentence for day, week, month and year references while
retaining the independent unknown-date and semantic checks.

Add an opt-in, versioned language/discourse evaluation with independent source-based grading and separate
retention, retrieval, useful-answer, safety and availability metrics. Deterministic CI verifies the
contracts and source-byte preservation; live-model quality remains a separately measured property.

This is a partial delivery of #61/#62, whose reliability acceptance remains open. The frozen comparison
recorded one unsupported retained set and nine erroneous answer outputs; semantic verification remains
fallible. Its 1,024-token answer ceiling differs from the shipped 2,400-token default, so the published
quality score does not validate that default profile. See the
[evaluated scope](https://github.com/tenphi/akno/blob/main/docs/language-and-discourse.md#current-evaluated-scope)
for the complete results and limitations.
