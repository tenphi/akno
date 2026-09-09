# V71 report postrepair cleaning replay

## Result

The read-only deterministic replay is preserved in
[language-v71-report-cleaning-replay.json](report-cleaning-replay.json). It uses the frozen
V71 module at [tmp/core-v71/dist/write/retain.js](core-v71/dist/write/retain.js), calls only
cleanCandidateBatch, and makes no model or provider call.

The production-shape input vector contains the exact admitted position 0 from selected-trace row 2 and the
exact repaired position 1 from row 4. The repair retains position 1's original support and discourse-frame
arrays byte-for-byte. Cleaning receives the complete original three source items and generated=true.

The result contains:

- one admitted candidate, the independent no-delivery denial at vector position 0; and
- one held candidate, the repaired report at vector position 1, with reason_code discourse_uncertain and the
  exact diagnostic:

> the source report has a confirmation or verification limit that was not recognized in a closed readable
> clause; state that same limit in its own short complete sentence within this record, with an explicit
> subject when the limit is personal; preserve lacking or receiving evidence versus personally checking it

This confirms the initial stage review's localization: the report is rejected by deterministic postrepair
cleaning and never becomes eligible for the semantic retention verifier.

## Inputs and assumptions

The receipt extracts all replay content from the already exposed V71 trace:

- sourceItems: row 2's complete structured source, with item IDs, roles, speakers and text unchanged;
- original candidate and its repair diagnostic: row 4's repair target at zero-based original index 1;
- repaired candidate: row 4's returned repair at index 1; and
- sibling context: row 2's admitted position 0, retained in the vector exactly as production does when it
  replaces only the failed original position.

The explicit cleaner options are sourceItems plus generated=true. I did not supply folders, admitted pages,
source ID, revision, reference time or timezone because those values are not part of the exposed cleaner
payload and do not decide this earlier report-uncertainty branch. Consequently replay candidate IDs are
deterministic for these disclosed options but are not expected to equal the live operation's IDs. The typed
hold reason and candidate disposition are the relevant result.

The JSON receipt records SHA-256 hashes of the frozen cleaner module and its report-uncertainty source, the
full input vector, both candidates, the exact options and the complete returned value. No answer result,
semantic verdict or grade is synthesized.

## Exact failed recognition

The source frame satisfies hasReportUncertainty: it explicitly says Ada passed on Bo's account without
having read the agreement or independently checked the account, and the Russian clarification says Ada
herself had not verified the relayed meaning.

The repaired English sentence is:

> Ada Marlow is only passing on this meaning; she has not read the agreement, independently checked Bo
> Winters's account, or personally verified this meaning.

This is a grammatical shared-negation coordination. “Has not” governs all three participles: read, checked,
and verified. The frozen helper recognizes the first examination and the middle independently-checked report
object. Its closed final-predicate grammar accepts an optional “independently” before verified/confirmed, or
a matching reflexive form such as “herself”. It does not accept the semantically ordinary modifier
“personally” in this final position. Therefore hasReportUncertainty returns true for the deciding frame and
false for the repaired text, producing the replayed typed hold.

This is a bounded lexical false hold rather than evidence that the candidate omitted uncertainty. The result
does not establish how a model would judge the sentence semantically because no semantic model is invoked.

## Source-first assessment

The repaired record is materially source-faithful:

- Ada remains the person passing on the meaning, and Bo remains the person whose account supplies the
  agreement claim.
- The agreement permits sending Zephyr QX-100 to the workshop to measure the latch gap.
- The repair uses “not to replace the latch”, preserving the source's corrective service-action contrast.
- Ada's nonreading of the agreement, lack of independent checking of Bo's account, and lack of personal
  verification of the relayed meaning are all explicit under the same negative auxiliary.
- Its affirmed governing polarity is appropriate for the positive reported permission; the negative
  replacement contrast and personal limits are qualifications rather than negation of that main report.
- The independent no-delivery denial is not repeated in this record because it survives as its own candidate.

“According to Bo Winters” followed by “Ada Marlow is only passing on this meaning” is slightly less direct
than “Ada reports that Bo says”, but it preserves both reporter roles and does not invent verification,
delivery or completed service. I find no material source error in the repaired record.

## Disposition

The exact postrepair hold is discourse_uncertain from the closed report-uncertainty floor. The failure is the
floor's omission of “personally” as a supported final verification modifier, not missing source content,
changed polarity, attribution loss, frame loss, response shape, language, ownership or semantic-verifier
rejection. The initial stage review remains preserved separately. Final benchmark diagnostics may confirm
the same typed validation hold, but they cannot change what this frozen deterministic replay returned.
