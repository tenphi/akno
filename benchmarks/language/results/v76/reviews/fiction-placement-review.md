# V76 selected fiction — bounded placement diagnosis

Independent Sol review, read-only. I read the original fiction source before the packet/report, then inspected only the relevant extraction, retention-verifier, ownership trace, and routing code. I did not inspect independent grades, replay a model/helper, call a provider, or modify runtime.

## Source judgment

The source contains two related durable propositions:

1. Ada Marlow actually proposes discussing a fictional case about Zephyr QX-100. It remains only a proposal to discuss, and no real contract is concluded.
2. Inside that invented case, Vulpine Mutual promises fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership. The promise exists only in that made-up case.

The second proposition is hypothetical content, but it is specified content rather than an unknown possibility. Its connection to Zephyr QX-100 is an anaphoric two-span relationship: turn 1111 names the fictional case as being about Zephyr QX-100; turn 2222 begins `In the invented case` and supplies the promise.

## Candidate and verification

Trace row 899 extracts both propositions. Candidate 0 is the proposal record and explicitly names Zephyr QX-100. Candidate 1 is:

> In Ada Marlow's invented case, Vulpine Mutual promises fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership. This promise exists only within the made-up case.

Candidate 1 faithfully preserves Vulpine Mutual as promisor, fictional Bo Winters as recipient, free hinge-pin replacements, the first eleven ownership days, and confinement to the fictional case. Its hypothetical commitment is appropriate. The possessive `Ada Marlow's invented case` is contextual shorthand; I do not read it as a material claim that Ada authored the promise. The source does establish that she is the speaker proposing discussion of that case.

The candidate's support is turn 2222 and its discourse frame contains both turn 1111 and turn 2222. Retention verification at row 904 accepts both candidates. Independently of that positive verdict, the two exact source spans support the candidate's meaning and their cross-span Zephyr relationship.

The extraction does, however, omit `Zephyr QX-100` from candidate 1's readable text and declares the subject as the relational phrase `Vulpine Mutual's fictional promise to Bo Winters`, with `page:null`. Thus the semantic relationship is present only in private source/frame material, not in the durable proposition or routing subject.

## Exact placement outcome

- Candidate 0 ownership call: trace row 909. Its memory text and subject both name Zephyr QX-100; `page_1` is the Zephyr QX-100 page and `proposed` is also allowed. The model chooses `page_1`, and the proposal is written.
- Candidate 1 ownership call: trace row 914. Allowed selections are only `uncertain` and `page_1`. The payload contains the candidate text/relational subject above and one existing page titled `Zephyr QX-100`; `proposed_page` is null. The model chooses `uncertain`.

The final report consequently records candidate 1 as held at placement with `routing_uncertain` / `ownership_uncertain`; only the proposal record is retained.

The `uncertain` result is justified by the supplied ownership contract. The system prompt says similarity merely nominates pages and that a related keyword is insufficient; it permits a page only when exactly one supplied page's durable purpose owns the memory. In the actual row-914 payload, the memory contains no Zephyr name or explicit device relation. Selecting the Zephyr page would require recovering the omitted antecedent from source context that the ownership model does not receive.

This is not a retention-semantic rejection or provider failure. It is a placement loss caused by a source-supported identity attachment failing to survive into the candidate's self-contained readable proposition/subject.

## Public consequence

The retained set is incomplete: 1/2 source-required fiction records survives. All eight query coordinates retrieve only the proposal record. Seven answer attempts are null; RU→RU inferred produces only the proposal-to-discuss and no promise content. That published sentence is source-faithful as far as it goes, but it cannot answer the focused fictional-promise query completely because the promise record was lost before retrieval.

## Bounded design recommendation

The smallest coherent first correction belongs in extraction/self-contained candidate construction rather than a relaxed ownership decision:

- when a candidate proposition uses a source anaphor such as `the invented case`, require its readable text to replace that anaphor with the exact source-attached narrow identity needed for ownership, here `the invented case about Zephyr QX-100`;
- require the declared subject/page suggestion to follow that actual source attachment, while preserving Vulpine Mutual/Bo Winters as promise roles rather than turning either into the device owner;
- keep the complete exact source frame and mandatory retention verifier responsible for validating the cross-span attachment;
- if the model cannot preserve that attachment within the existing 400-unit record, hold the candidate rather than guessing a page.

A narrow private ownership aid is defensible only as a fallback: pass bounded exact identity-context entries derived from the candidate's own validated discourse frames, limited to at most four identifiers/four exact spans and 1,200 units. Label them advisory and require the model to find the same attachment across those spans. They must not become a new authority: they cannot introduce a page absent from allowed destinations, override the candidate's readable contradiction or missing role, borrow a sibling's subject merely by proximity, or turn a source/paragraph into a writable destination. Because the current failure also leaves the durable prose non-self-contained with respect to Zephyr, improving extraction is preferable to routing an opaque relational record using hidden context alone.

Meaningful controls should include:

- positive: prior span names a fictional case about one device and the next exact span says `in that invented case`; candidate text and subject preserve that device and route to its sole page;
- negative: two different devices/cases precede the anaphor, so attachment remains ambiguous;
- negative: a quoted/example-only device mention does not attach the promise;
- negative: a neighboring sibling proposition names the page but the promise's own frame does not;
- negative: correct device but changed promisor, recipient, replacement object, duration, or fictional scope is rejected by mandatory source verification before placement;
- negative: identity context nominates a source/read-only or unallowed page, which remains unavailable;
- boundary: all identifier/span/count/unit caps fail closed without expanding to paragraph-wide authority.

This recommendation preserves the rule that ownership must be resolved. It does not treat the query wording, source context, similarity, or a sibling record as destination authority.
