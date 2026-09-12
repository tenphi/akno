# V66 bounded design review

## Disposition

The five proposed changes form a coherent, bounded V66. They address distinct observed failure stages without changing the model, thresholds, semantic dimensions, gates, or no-retry policy. The safest scope is to change the two deterministic recognizers narrowly, improve the existing repair and verifier payloads, and make the existing answer-alignment invariant visible to constrained decoding. None of these changes should turn a local presence check into source-entailment authority; the existing complete-source semantic verdict must remain mandatory.

The now-complete held-out forensic supports two additional lexical false-hold corrections and one generation reminder, recorded below. It does not support a general relaxation of discourse or language checks.

## 1. Russian unresolved-coverage role floor

`coverageRolesSupported` currently activates the dangerous instrumental construction only after prefixes such as `не определяет`, `не устанавливает`, or `неизвестно`. It therefore misses the observed clause shape `не отвечает ... покрывается ли ремонтом приводного вала`, in which `ремонтом` incorrectly becomes the covering instrument/agent.

The smallest safe addition is another **same-clause unresolved-question introducer**, bounded to:

- `не отвечает` followed by a bounded object such as `на вопрос` (optionally `о том`), then
- `покрывается ли ремонтом ...`, within the existing quote-stripped clause and distance cap.

This must not recognize a bare `не отвечает` in another clause, quoted grammar, or a different subject/predicate. Keep the existing source activation: the original support must first contain repair-as-covered wording. Keep the existing exception when the source independently and explicitly makes repair the coverer. Full semantics still decides object identity and whether the candidate actually corresponds to the source proposition.

Generation should prefer a source-bound nominal such as `вопрос о покрытии ремонта приводного вала` or a faithful active/passive formulation in which the repair remains the covered service. It should not invent an insurer, warranty, agreement, or other coverer that the source leaves unspecified.

Minimum contrasts:

- reject the observed `не отвечает на вопрос, покрывается ли ремонтом приводного вала` when source says shaft repair coverage is unresolved;
- reject variants with `не отвечает на вопрос о том, покрывается ли ремонтом ...`;
- do not borrow `не отвечает` across a period, semicolon, newline, adversative/comma clause boundary, or quotation;
- do not activate from `устройство не отвечает` or `Ada не отвечает Bo`;
- continue allowing a source that independently says one repair covers another cost/item, subject to semantic verification;
- pair each deterministic positive with a semantic-negative integration case proving the full verifier still withholds it.

## 2. Coordinated personal report uncertainty

The existing `hasReportUncertainty` branch is deliberately a closed grammar. The V65 form adds a three-part shared-negative list after an outer relay clause: the actor `has not read ...`, `[has not] independently checked ...`, `or [has not] herself checked ...`. A bounded extension is justified; an arbitrary wildcard between the negative auxiliary and confirmation predicate is not.

Add one alternative that consumes the whole list under a single explicit negative auxiliary and the same actor. Permit only the existing examination objects and confirmation/check predicates, optional `independently`, and bounded explicit-pronoun/reflexive grammar. Do not infer a named person's gender from a name: for a named actor, reflexive identity remains a full semantic-verifier question rather than a local grammar fact. Require the existing true end/clause boundary. The preceding `only conveys/relays` clause may establish discourse context, but it must not supply the negation or actor for the list.

Necessary negative controls:

- an explicitly positive new finite predicate (`..., but she herself has confirmed it`); by contrast, `has not ... or herself confirmed it` remains governed by the shared negative and is a valid positive test;
- a new named subject in any conjunct;
- `but/however/although/while/because` and sentence/semicolon boundaries;
- quoted or code-contained lists;
- a different object such as checking the device rather than the report/condition;
- negation attached only to relay (`does not relay ..., and checked ...`);
- mismatched reflexive or plural/collective actor;
- trailing retraction after an otherwise matching list.

The helper should only establish readable uncertainty. Attribution, the exact experiencer, the contractual object, and the difference between having/receiving/performing confirmation remain semantic-verifier obligations.

## 3. Candidate-specific repair context

The repair payload already binds `candidate_index`, the original candidate, grouped validation issues, complete source, and read-only admitted siblings. Its prompt asks the model to add an exact source span for a missing subject, but the failed V65/V59 pattern shows that leaving the model to rediscover the relevant span can reproduce the same incomplete frame.

Add a server-produced, candidate-specific field only for a diagnostic that names a missing readable subject identifier. It should contain exact source coordinates/spans in which that exact identifier occurs, selected from the original source items. Call it advisory source context, not a replacement frame and not evidence derived from the candidate. Bound its count and bytes. If there are zero or multiple plausible occurrences, expose that fact rather than choosing a silent antecedent. Do not automatically append any span to `discourse_frame`.

The repair instruction should require the model to select only the minimal deciding source span when it resolves the attachment, while retaining the same original position and proposition. It must re-evaluate all candidate metadata from the repaired readable proposition. In particular, adding a span containing competing tentative hypotheses can require changing `commitment`, disposition, or activity status; copied asserted/active metadata must not survive merely because it belonged to the failed draft.

Existing safeguards must remain:

- admitted siblings are immutable and read-only;
- a repair may address only its failed original index;
- returned indices must survive exactly once or the repair transaction fails;
- the cleaner validates exact source spans, subject attachment, and routing again;
- verification still sees the complete original source plus the original-position repair obligation;
- no automatic frame expansion and no second repair/semantic attempt.

Tests should cover a unique identifier occurrence, ambiguous repeated occurrences, identifier only in an unrelated/quoted span, a repaired frame that forces tentative metadata, attempted sibling substitution, attempted mutation of an admitted candidate, and a repair that copies the supplied context without establishing the actual attachment.

## 4. Provider-visible alignment relation/null shapes

The current `alignmentSchema` expresses its relation/anchor invariant through `.refine`. That closes local parsing but is not reliably represented in the provider schema, so constrained decoding can emit a locally invalid combination and convert an otherwise semantic decision into `verification_unavailable`.

Replace it with a `z.union` of three strict shapes:

1. `preserved | generalized | changed`: non-null source anchor and non-null answer anchor;
2. `omitted`: non-null source anchor and `answer_anchor: null`;
3. `not_selected`: nullable source anchor and `answer_anchor: null`.

Use singleton `z.enum([...])` values rather than `z.literal` if that matches the already proven endpoint encoding. `z.union` must serialize as `anyOf`, with no `oneOf` or `const`; every branch should be an object with all properties required and `additionalProperties: false`. Preserve the current exact owner/anchor enums, per-record selected-category requirement, negative-relation hold behavior, strict post-transport parse, and all three semantic booleans.

Transport tests should inspect actual Chat and Responses request schemas, exercise every branch, reject omitted with a non-null answer, reject selected relations with null/foreign/stale anchors, reject extra fields and trailing JSON, and demonstrate that a schema-valid negative alignment is a normal verification rejection rather than availability failure.

## 5. Complete compact span interpretations

Development row 422 is an availability failure caused by an internally inconsistent verifier response, not a source-semantic rejection: the second candidate's private `F2` interpretation ends mid-word (`not an-`), `proposition_supported=false`, but the only mismatch is qualification. The frozen reproduction confirms the first verdict is consistent and the second is not. Its `reason_code: null` is legal for a negative verdict and falls back to `discourse_uncertain`; it is not the inconsistency. The existing consistency check correctly fails the response closed and should not be relaxed.

The smallest mitigation is prompt/payload discipline inside the same verifier call:

- instruct the verifier to write each span interpretation as one short, complete proposition, with the governing actor, polarity, and qualification first;
- state explicitly that the original span is authority and the interpretation is only an audit summary;
- request complete, concise interpretations and avoid trailing fragments; this is prompt discipline, not a new local fragment detector;
- ask for concise wording comfortably below the existing 240-character field maximum rather than encouraging use of the whole allowance;
- require every false semantic dimension to have a mismatch for that same dimension, preserving the existing deterministic consistency check. A non-null reason may be encouraged for diagnostic quality but must remain optional under the current contract.

This reduces output pressure without dropping spans or raising budgets. It cannot prove that a model will never truncate, so the documented failure mode remains fail-closed batch availability. Isolating every candidate into its own call would reduce collateral batch loss but changes call count and cost; the single observed response does not justify that broader change yet. Likewise, salvaging the internally consistent sibling would weaken the current atomic-verdict contract and is not recommended for V66.

Add a fixture with the row-422 shape (false proposition, qualification-only mismatch, null reason) and retain the expected whole-batch failure, plus a compact complete two-span positive/negative response. Also test a consistent negative with `reason_code: null` to preserve its legal fallback behavior. Complete JSON containing a clipped private interpretation remains a semantic-quality risk; do not add a heuristic fragment parser. Transport-truncated JSON remains unavailable.

## 6. Held-out bounded lexical corrections

### Counterfactual Russian nominal antecedents

The held-out trace supports extending the existing counterfactual recognition to two same-clause nominal forms:

- `нереализованный вариант ... в случае покупки покрывало бы ...`;
- `нереализованный вариант ... при котором ... покрывало бы ...`.

Activation should require the explicit unrealized/counterfactual nominal antecedent, a bounded same-clause conditional connector, and conditional morphology such as `бы`. It must retain the source's nonpurchase/no-active-coverage qualification. Strip or separate quotations with the existing clause machinery, and do not cross a sentence, semicolon, newline, adversative clause, or a new grammatical subject.

Negative controls must include an actually purchased/active variant, an ordinary factual `вариант ... покрывает`, conditional language whose antecedent is in another clause or quotation, and the row-98 shape whose coverage is independently overbroad. Passing the lexical floor must not rescue row 98: the unchanged semantic verifier still rejects added coverage, actor, object, or scope.

### Russian unknown-date source anchors

Extend the source-clock recognizer only for the observed noun phrases `первоначальной записи без даты` and `недатированной первоначальной записи`, when the deictic interval is explicitly reckoned from that record in the same clause. These phrases preserve both source anchoring and unknown calendar date; word order alone should not cause a hold.

Positive tests should cover both phrases with the current supported reckoning predicates and quoted deictic labels. Negative controls should cover a dated original record, a processing/import/receipt event rather than the source record, the phrase appearing only inside a quotation or grammatical example, a reversed claim that assigns an actual calendar boundary, and cross-clause borrowing. Mandatory semantic verification continues to decide whether the candidate preserved the actual relative interval.

### Ordinary hyphenated component vocabulary

Add a generation-only reminder that hyphenation and technical context do not make ordinary vocabulary a protected identifier or name. In Russian prose, a source term such as `hinge-pin` must be translated faithfully unless it is an exact source-backed identifier/reference, quotation, or code span under the existing policy. This should not create a blanket Latin-token rejection or a new language-check exception; the existing checker and source-reference plumbing remain authoritative.

The held-out evidence does not justify a completeness-schema expansion in V66. Repair the demonstrated upstream retention losses first and keep the existing selection and semantic gates unchanged.

## Trial and evidence boundary

V66 should keep the current models, provider ceilings, thresholds, batching, public schemas, and no-semantic-retry rule. Record schema transport controls before exposed probes, especially the `anyOf` alignment schema. Because V20 is fully exposed, any full evaluation after a justified exposed diagnostic needs the separately approved fresh V21 held-out inputs and a fingerprinted unchanged gate.

Any further held-out discourse/language change requires its own source-grounded reproduction and bounded contrast set; aggregate coverage alone is insufficient.

## Change history

The initial review is preserved at `design-review-initial.md`. This revision corrects the shared-negative example, avoids inferring gender from names, records that null negative reasons are legal, rejects a new fragment detector, and adds only the two reproduced held-out lexical false holds plus the hyphenated-vocabulary generation reminder.
