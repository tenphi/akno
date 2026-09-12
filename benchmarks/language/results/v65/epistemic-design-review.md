# V65 group-relative epistemic scope design review

The confirmed V64 error fits the existing semantic model but exposes an instruction gap. The shared proposition contract already requires every selected epistemic limit to keep its subject or experiencer, predicate, object and attachment. The source-audit contract also says actor must compare the grammatical epistemic subject/experiencer and qualification must compare who lacks knowledge. Yet the generated `Фактические требования неизвестны` and the all-positive audit erased source `нам` without treating that erasure as material.

## Recommended bounded change

Add one explicit rule to answer generation and one parallel rule to answer verification. No schema, pass, retry, model, budget, or acceptance threshold needs to change.

Generation should say, in substance:

> Preserve the experiencer of every selected knowledge or uncertainty predicate. `The actual requirements are unknown to us` / `Настоящие требования нам неизвестны` may be rendered as `we do not know the actual requirements` / `мы не знаем настоящих требований`, but not as bare `the actual requirements are unknown` / `настоящие требования неизвестны`, `Ada does not know`, `nobody knows`, or `the requirements are unknowable`. A named person who introduces the neighboring hypothesis or reports no actual event does not become the experiencer of the group's knowledge limit. Keep the group-relative limit attached to the actual-requirements contrast.

This direction applies only when that epistemic predicate is selected by the retained excerpt. A private source-frame clause cannot become answer content merely because it appears beside a selected proposition. Conversely, when the retained proposition selects the group-relative unknownness as a material qualifier of the hypothetical rule, a complete answer cannot drop its experiencer while retaining a generic uncertainty word.

The verifier/audit direction should require both relevant alignment categories to assess the experiencer explicitly:

- `actor` compares the source's grammatical epistemic experiencer with the answer counterpart, independently of Ada as hypothetical-rule introducer or nonreport actor;
- `qualification` compares the local/group-relative scope of the uncertainty and its attachment to the actual requirements.

For source `нам неизвестны` and answer bare `неизвестны`, actor should be `omitted` with a source anchor on `нам`/the complete epistemic source span and `answer_anchor:null`, because no answer token supplies the group experiencer. Qualification should anchor the present bare-unknownness clause and mark it `generalized` or `changed`: the candidate turns a bounded “unknown to us” limit into unqualified unknownness. The verdict must set `action_arguments_preserved:false` with an action-argument mismatch and `qualification_scope_preserved:false` with a qualification mismatch. `proposition_supported` should also be false because the globalized proposition is stronger than the source. If the answer substitutes Ada, nobody, a document, or another group, both categories are `changed`, with actual answer anchors.

The distinction between `omitted` and `changed` should follow the current coordinate schema rather than desired prose: truly absent experiencer means `omitted` and a null answer anchor; an explicit but wrong experiencer means `changed` and a non-null anchor. A nearby Ada mention cannot serve as the answer anchor unless Ada grammatically occupies that epistemic predicate.

## Deterministic floor

I do not recommend adding a syntax-only deterministic floor now. A useful floor would need to determine all of the following without semantic interpretation: whether the retained excerpt selected the epistemic predicate, whether its experiencer is material, whether a Russian dative, English prepositional phrase, finite `we know` construction, collective noun, pronoun, or unambiguous shared subject preserves it, and whether a neighboring name belongs to a different predicate. A regex restricted to `нам неизвестно/неизвестны` would miss faithful paraphrases such as `мы не знаем`, while a broader bare-unknownness check would falsely hold legitimate sources that themselves state unqualified unknownness or answers with a clause-local shared experiencer.

A deterministic check could become appropriate later if retention carries a typed, source-verified epistemic experiencer and generation exposes an equally typed answer binding. Current metadata does not encode that role; deriving it mechanically from arbitrary source prose would create a second, brittle semantic authority. Explicit generation plus the existing mandatory source audit is safer for paraphrase and focused selection, and failures remain conservative verifier rejections rather than accepted assertions.

## Minimal tests

Use one complete framed hypothetical record whose retained excerpt itself includes the actual-requirements clause. Positive generated and verified forms should include:

- `the actual requirements are unknown to us`;
- `we do not know the actual requirements`;
- `нам неизвестны настоящие требования`;
- `мы не знаем настоящих требований`;
- a clearly source-bound group noun only when the original identifies that same group.

Negative generation/audit fixtures should cover:

- bare `the actual requirements are unknown` / `фактические требования неизвестны`;
- `Ada does not know the actual requirements` when source says `us`;
- `nobody knows`, `the requirements are unknowable`, and `the record does not establish the requirements`;
- outer `According to Ada` followed by bare unknownness;
- Ada introducing the hypothetical rule in one clause and bare unknownness in the next;
- Ada not reporting an actual missed check beside the separate group-relative limit;
- matching uncertainty vocabulary with the wrong object or clause attachment.

Audit tests should assert exact coordinates and dimensions: missing group experiencer produces actor `omitted`/null anchor, qualification `generalized` or `changed` at the bare predicate, false action and qualification booleans with corresponding mismatches, and false proposition support for the unsupported global claim. Wrong explicit experiencers use `changed` with their non-null anchors. A schema-valid negative verdict must yield ordinary rejection, not verifier unavailability.

Selection controls should prove the rule does not force an independent private-frame knowledge clause into an answer whose retained excerpt selects only another proposition. A coupled selected hypothetical record must keep premise, conditional consequence, actual-requirements experiencer, and no-actual-event limit. A source with genuinely bare unknownness must remain eligible for a faithful bare paraphrase. Include English/Russian directions and same-language paraphrases so the rule is semantic rather than a translation-only special case.

## Assessment

A small prompt-and-audit revision is sufficient and directly addresses the observed error. It sharpens an existing requirement instead of adding authority. The key is to name group-relative/dative experiencers explicitly, require actor and qualification alignments to inspect them independently, and prevent neighboring Ada predicates from satisfying that role. A lexical floor would add false-hold risk without covering normal paraphrases and should be deferred unless a future typed representation makes the experiencer deterministic.
