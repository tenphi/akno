# V61 bounded attribution design review

## Generic assistant nominal attribution

The V60 draft is source-faithful in its attribution opening:

> **По сообщению ассистента · Предварительно:** Предварительное прочтение ассистента заключается в том, что обслуживание Zephyr QX-100 может включать функциональную проверку индикатора состояния каждый квартал, однако ассистент не изучал договор и не подтверждал это предположение, поэтому это остаётся возможным условием договора, а не установленным требованием.

The rejection is deterministic and occurs before semantic verification. `attributedReportsSupported` requires every qualified `source_report` with a generic assistant speaker to satisfy `hasBoundReporter` (`packages/core/src/ops/answer.ts`, around lines 1452–1494). The only Russian `по ... сообщению SOURCE` branch currently requires one of `предварительному`, `неподтверждённому`, or `непроверенному` between `по` and `сообщению` (around line 1560). Reproducing that exact branch gives:

- `По сообщению ассистента: проверка может требоваться.` → false
- `По предварительному сообщению ассистента: проверка может требоваться.` → true

The visible `· Предварительно` label does not occur inside the grammatical construction and cannot satisfy this branch. This is a lexical false hold; it does not establish anything about the semantic verifier's likely judgment because that verifier was never called for the draft.

The smallest correction is to allow the existing uncertainty adjective to be optional in this one nominal construction:

`по [предварительному|неподтверждённому|непроверенному] сообщению REQUIRED_SOURCE [,|:] PROPOSITION`

This should remain a source-presence floor, with all existing semantic checks mandatory. It should not become a general nominal-report parser. In particular:

- Keep the required source label immediately governed by `сообщению`; `По сообщению Bo Winters, ассистент ...` must not satisfy an assistant requirement.
- Require comma or colon followed by visible proposition content in the same bounded construction. Preserve the existing rejection of a period boundary such as `По сообщению ассистента. ...`.
- Apply the existing quotation masking before matching. A quoted or code-form literal `«по сообщению ассистента»` must not establish live attribution.
- Reject a negated construction (`не по сообщению ассистента`, `вовсе не по сообщению ассистента`) rather than treating the embedded positive substring as attribution.
- Do not accept source labels merely mentioned as an object or topic: `по сообщению устройства об ассистенте` and `сообщение про ассистента` remain negative.
- Preserve the competing-reporter controls: a neighboring assistant mention cannot repair a report grammatically attributed to Bo Winters, and an unrelated assistant clause cannot lend its actor to another report.
- Retain a paired integration test where this floor passes but `proposition_supported` or `action_arguments_preserved` is false, proving the full source verifier still withholds the answer.

Because the requested source is a generic role, limiting the new optional-adjective form to the generic-assistant path is a reasonable first boundary. Named reporters already have several established forms, and widening all source labels is unnecessary for the observed failure.

## Russian warranty-coverage wording

The current deterministic coverage floor correctly targets a narrow role inversion: when the source makes repair the covered item, an unresolved clause such as `покрывается ли ремонтом двигатель` makes repair the covering instrument. Weakening `coverageRolesSupported` would admit precisely the error it was added to prevent.

The useful change is generation-only guidance that gives the model two canonical role-preserving forms and tells it which noun occupies each role:

- `не установлено, покрывает ли гарантия ремонт двигателя вентилятора`
- `не установлено, покрывается ли гарантией ремонт двигателя вентилятора`

Here `ремонт двигателя вентилятора` is the covered service, `гарантия` supplies coverage, and `двигатель вентилятора` is the object of repair rather than the thing covered by repair. Avoid `покрывается ли ремонтом ...`, whose instrumental noun reverses the relation, and avoid making `гарантия` the grammatical object covered by a repair. This sharpens the existing instruction near answer generation lines 223–225; it does not add a synonym dictionary or authorize facts absent from the cited source.

Minimum contrasts should include both canonical positives above, the two inverted shapes (`покрывается ли ремонтом двигатель ...` and `покрывается ли ремонтом ... гарантия`), a quoted grammar example that supplies no live proposition, and a source that independently does say one repair covers a cost or another repair. In every admitted case, the unchanged semantic verifier remains responsible for the actual source/object identity and uncertainty scope.

## Fictional promise and named outer source

The named outer-source requirement should remain. Promise-only answers such as `В вымышленном примере Vulpine Mutual обещает ...` preserve the fictional payload but omit that Ada Marlow is the source presenting it. The bounded generation instruction should prefer neutral source provenance:

`По словам Ada Marlow, в вымышленном примере Vulpine Mutual обещает персонажу Bo Winters ...; обещание существует только в рамках вымысла.`

This names Ada as the outer source without turning her into the promisor, recipient, or necessarily the author of the example. If the block also selects the separate proposal record, it must additionally state that Ada proposed discussing the example; outer attribution alone cannot replace proposer agency. Conversely, when only the fictional-promise record is cited, generation should not import the question's wording that Ada “proposed discussing” it. The source frame and retained citation, not the query, authorize that action.

Paired tests should cover: Ada as outer source with Vulpine Mutual as fictional promisor and Bo Winters as fictional recipient; omission of Ada; substitution of Bo as outer source; `According to/По словам Ada` inside a quotation; and a promise-only citation whose query mentions a proposal but whose answer does not invent it. The existing named-source floor and semantic verifier should remain unchanged.

## Disposition

The assistant failure supports one narrow grammar extension: optional bounded uncertainty modification in `по сообщению <generic assistant>,/: <proposition>`, with negation, quotation, punctuation, and competing-source controls. The coverage and fiction observations support generation guidance, not guard relaxation. None requires another model call, retry, schema field, token-budget change, or gate change. These are finite syntactic floors; final attribution, action roles, qualification, coverage meaning, and selected-source entailment remain mandatory model-verifier judgments.
