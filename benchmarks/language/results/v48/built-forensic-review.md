# V48 built-probe forensic review

## Scope

This review uses only these V48 artifacts:

- `tmp/language-built-output-packet-v48.json`
- `bench-results/language-built-reliability-v48.json`
- `bench-results/language-built-reliability-v48-trace.jsonl`

I did not inspect grader receipts, earlier trial outputs, source code, live services, or any external source. I
made no provider call and no code or test edit. This is an evidence and cause audit of the two-case built
development probe, not the separately assigned source-only grade.

## Disposition

I found **zero accepted source-entailment errors, zero accepted qualification losses, zero answer-language
violations, and zero null answers** in this packet. Both retained records follow their supplied source, and all
16 answers preserve the material actor/source, action, object, frequency or post-repair scope, uncertainty,
and nonresolution needed for their respective questions.

The V48 source-frame path demonstrably reached both existing answer calls. Every one of the 16 generation
requests and every one of the 16 verifier requests contains a nonempty `retention_source_frame` equal to the
corresponding source content. Every verifier response contains
`excerpt_selection.selected_by_retained_excerpt=true` with `unselected_content=null`, alongside three true
semantic dimensions and an empty mismatch list.

This result supports proceeding from the built diagnostic on these two cases. It does not establish performance
on source frames containing unrelated adjacent facts, multiple supports, absent archives, the 4,800-character
cap, or any null/rejection path, because none occurs in this packet.

## Observed matrix

| Observation | Result |
| --- | ---: |
| Retention cases written | 2 / 2 |
| Retention or replay availability failures | 0 / 2 |
| Typed semantic matches | 2 / 2 |
| Qualified retrieval coverage | 2 / 2 |
| Answer operations without failure | 16 / 16 |
| Nonnull answers | 16 / 16 |
| Generated blocks passing deterministic guards | 16 / 16 |
| Blocks accepted by semantic verification | 16 / 16 |
| Generation requests carrying a source frame | 16 / 16 |
| Verifier requests carrying the same case frame | 16 / 16 |
| Positive, internally consistent excerpt selections | 16 / 16 |
| Trace model events reporting `ok=true` | 56 / 56 |
| Language checks reporting compliant | 18 / 18 |
| Source-byte changes | 0 / 2 |

The 56 trace events comprise two retention calls, two retention-verifier calls, two ownership calls, 16 answer
generation calls, 16 answer-verifier calls, and 18 language checks. No event reports a transport or structured
output failure.

## Open return-delivery question

The English source has two linked statements by Ada Marlow:

1. she has no answer to whether the Zephyr QX-100 agreement includes returning the device after repairs; and
2. the question remains open, with neither coverage nor exclusion of the return delivery established.

The single retained record keeps all of that material content. It identifies Ada Marlow, represents the content
as an open question, retains the agreement and return of the device after repairs, and carries the shared
nonresolution over both coverage and exclusion. Its typed state is `kind=question`, `commitment=none`,
`disposition=active`, `source_role=user`, `source_speaker=Ada Marlow`, and `basis=self_attested`. Those fields
fit the supplied source and do not answer the embedded question.

All eight query/output/view combinations retrieve that same qualified record and produce a cited answer. The
English answers consistently say that this is Ada Marlow's recorded open question and preserve both sides of
the unresolved alternative. The Russian answers also keep Ada Marlow and Zephyr QX-100 unchanged, render the
content as a question about agreement inclusion, retain return after repair, and state that neither inclusion
or coverage nor exclusion has been established. None asserts that return delivery is included, excluded,
arranged, or performed.

One Russian rendering uses `наличие ... такой доставки` for the positive side of the alternative. Literally,
`наличие` can mean existence or presence rather than contractual coverage. In its immediately preceding
agreement-inclusion question, the natural ellipsis is presence in the agreement, and the sentence remains
explicitly unresolved. I therefore do not count it as an accepted source or qualification error. It is less
precise than `включение` or `покрытие` and is suitable for separate language-quality attention. Other Russian
variants such as `доставка возврата` are awkward but still intelligible as return delivery and do not change
the proposition.

The trace contains the two exact source statements joined as the frame for every one of this case's generation
and verification requests. Each verifier independently records that the retained excerpt selected the complete
answer content, and its comparison explicitly checks Ada Marlow's attribution, the open-question status, the
device-return action after repairs, and the unresolved coverage/exclusion pair. My artifact-level comparison
agrees with those acceptances.

## Tentative assistant report

The Russian source says that the assistant's account is preliminary rather than a verified condition; Zephyr
QX-100 servicing may include an indicator check twice per year; and the assistant did not study the agreement
or verify the assumption.

The retained English record preserves the source as the assistant, labels the proposition preliminary and
unverified, keeps `may include`, identifies the indicator check and twice-yearly frequency, and retains both
the lack of agreement review and lack of verification. Its typed state is `kind=claim`,
`commitment=tentative`, `disposition=active`, `source_role=assistant`, `source_speaker=assistant`, and
`basis=source_report`. This presents the proposition as an attributed tentative report rather than an
established service requirement.

All eight answer combinations retrieve that record and preserve the same cumulative qualifications. Each
English answer uses assistant attribution, preliminary/unverified/assumption wording, modal `may`, the
indicator object, twice-yearly frequency, and the assistant's lack of agreement study and verification. Each
Russian answer likewise uses assistant attribution, preliminary and unverified report or assumption framing,
`возможно`, the indicator check, `дважды в год`, and both negative verification statements. None promotes the
possibility to a contract term, maintenance requirement, fact, or completed check.

The complete Russian source is present as `retention_source_frame` in every generation and verifier request for
this case. The 8/8 verifier responses set excerpt selection true/null and separately describe the preserved
servicing relation, indicator object, twice-yearly frequency, assistant attribution, possibility, preliminary
status, and lack of verification. My artifact-level comparison finds no accepted omission or role transfer.

## Source-frame and excerpt-selection evidence

The trace contains exactly two distinct source-frame values, one for each case. The generation and verifier
sets are identical:

- the question case carries both original English source statements, separated by the archive ellipsis; and
- the assistant case carries the complete original Russian source statement.

For each of the 16 answers, the generation request pairs `E1`'s readable retained excerpt with the appropriate
frame. The corresponding verifier request pairs the same `E1` excerpt and frame with the generated answer and
typed record fields. All 16 verifier outputs have:

- `proposition_supported=true`;
- `action_arguments_preserved=true`;
- `qualification_scope_preserved=true`;
- no mismatches; and
- `excerpt_selection={selected_by_retained_excerpt:true, unselected_content:null}`.

This proves that the built operation supplied the archived frame and enforced the new response shape on both
model stages for every observed answer. These artifacts do not expose the database tuple, current file hash,
or lookup fallback decision directly, so they cannot independently prove each internal binding predicate. They
do show that the frame received by both calls matches the source included in the packet and corresponds to the
retained record used as `E1`; no cross-case frame mix-up is present.

## Answer outcomes and null causes

There is no null to diagnose. The report records 16 produced answers out of 16, zero answer-operation failures,
zero availability failures, and `answerReason=answered` throughout. Every answer has one generated block, one
block past deterministic guards, one verified block, no rejection count, and no degradation.

The question case's eight answers have `answerOutcome=complete`. The assistant case's eight answers have
`answerOutcome=partial` even though their generation responses contain no `missing_concepts`, their retrieved
record answers the requested report, and validation accepts the sole block. The artifacts do not expose the
specific field that caused this outcome label. They rule out model-declared missing concepts, retrieval failure,
guard rejection, verifier rejection, and typed degradation. The remaining label appears to come from operation
coverage bookkeeping outside the recorded model response. It does not cause a null or omit any requested
material in the eight visible answers, but it should not be treated as a source-frame rejection signal.

The separate context operation is `empty` and not activated for all combinations, while direct recall is `ok`
and supplies one qualified retained record. This is consistent across both cases and does not prevent answer
generation or citation.

## Language audit

All eight requested-English answers are English apart from the preserved proper names and identifier. All eight
requested-Russian answers are Russian apart from the same preserved names and identifier. Generic `assistant`
is rendered as `ассистент` in Russian. The trace's 18 language checks cover the two retained English records and
the 16 answers; each returns `compliant=true`. I found no untranslated sentence, unwanted name
transliteration, or cross-language qualification loss.

The Russian question answers contain some stiff nominal phrasing, noted above, but remain comprehensible and
keep their epistemic scope. The Russian assistant answers are grammatical enough to convey the full report;
variation among `предположение`, `сообщение`, and `отчёт` does not change its tentative, unverified status.

## Limits of this forensic result

This packet is a selected diagnostic with two retained records and one run. Every answer cites one evidence
item whose source frame substantially overlaps its readable retained text. There is no negative
excerpt-selection result, unrelated adjacent source proposition, ambiguous multi-support record, inactive or
missing archive, frame-budget pressure, stale binding, model failure, verifier rejection, or null answer.
Accordingly, the packet confirms positive-path wiring and semantic preservation for these two examples. It
does not measure the bridge's precision on adverse frames or its availability effect across a complete split.
