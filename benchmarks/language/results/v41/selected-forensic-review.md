# V41 selected-probe forensic review

Reviewed the selected V41 report, trace, and original-source/output packet. This is a forensic source audit, separate from the independent grade. No full V41 trial or fresh V19 held-out execution occurred.

## Totals

- Four writable cases produced five persisted records.
- Three retained sets are complete. `v18-held-rejected` remains incomplete because its separately extracted no-booking candidate was held at placement.
- 26/32 answers are nonnull. Six are null: one nested-report semantic rejection, four undated-proposal semantic rejections, and one alternatives semantic rejection.
- No model availability or transport failure occurred.

## `v18-held-report`, run 1

Persistence contains both required records. The main record preserves Ada Marlow as outer recorder, Bo Winters as inner reporter, permission to send Zephyr QX-100 to a technician for dial calibration, the regulator-calibration rather than regulator-replacement contrast, and Ada's lack of terms or confirmation. The companion record preserves Ada's denial that she instructed collection. Attribution, source-report basis, uncertainty, and negated self-attested polarity are correct.

Seven accepted answers preserve the same nested roles and report uncertainty. None turns permission into an arrangement, and `terms` remains contractual rather than a device-state claim. I found no accepted content, role, qualification, clock, or language error.

`en -> ru / inferred` is null after semantic verification. Its draft says `она передала непроверенное сообщение Bo Winters`, which the verifier reads as Ada conveying a message *to* Bo and therefore reversing Bo from inner source to recipient. In ordinary Russian the indeclinable-name construction can also naturally mean “she conveyed Bo Winters's unverified message,” especially with the following `о том, что`; under that reading the draft is faithful. This is a disputed, likely false semantic hold caused by attachment ambiguity, not a deterministic attribution-floor rejection. The safe direction is clearer generation (`передала непроверенное сообщение от Bo Winters` / `пересказала слова Bo Winters`), without weakening role verification.

## `v18-held-rejected`, run 1

The persisted plan correctly preserves Ada as the person who declined the offer, sending Zephyr QX-100 to the service centre for thermostat measurement, rejected disposition, and no plan under that offer. All eight answers correctly identify that rejected offer. The frozen focused-answer contract permits omission of the redundant no-plan clause in the shortest answers; none claims acceptance, booking, shipment, or completed measurement.

V41 did generate and semantically verify the independent denial `No handover of the device has been booked.` as its own negated claim with no invented time envelope. Thus the new frame-separation guidance fixed V40's structural/rejection collision. It did **not** reach persistence: routing offered only the existing Zephyr page and returned `uncertain`, so the candidate was held at placement. The readable text and subject (`device handover booking`) left the source's anaphoric device unresolved instead of naming Zephyr QX-100, making the ownership hold defensible. The retained set remains incomplete. A later bounded correction should preserve the source-resolved subject identity in each independently routed candidate; it should not relax ownership or force generic “device” claims onto a product page.

## `v18-held-undated`, run 1

The persisted record is complete and correctly typed: asserted proposal, proposed disposition, tentative scheduled time with unknown precision, unaccepted status, no arranged meeting, source-relative week after the undated original record, and no processing-date resolution. All four accepted English answers preserve those limits and Ada as proposer.

All four Russian drafts are null after semantic verification:

- `en -> ru / inferred`
- `en -> ru / explicit`
- `ru -> ru / inferred`
- `ru -> ru / explicit`

Each uses impersonal `было предложено` after `По словам Ada Marlow`, which makes Ada merely the attribution source and omits her material role as the person who proposed the review. The verifier correctly rejects this under the established action-agent rule. Their calendar/source-clock wording is otherwise faithful. One verdict additionally objects to `предварительно`, but that is at least arguable as presentation of the typed tentative timing; the independent proposer omission is sufficient and concrete in all four. These are justified holds, not source-clock failures.

## `v18-held-alternatives`, run 1

The first extracted surface required one structural repair; the persisted result is correct. It names Ada as both the person considering the alternatives and the person who selected neither cause, preserves the improperly seated connector and faulty temperature probe, keeps both tentative/unsubstantiated, and retains the lack of evidence for either. This confirms the V41 pre-persistence agency floor and bounded repair on the exposed case.

Seven accepted answers preserve Ada's consideration and personal nonselection, both alternatives, common lack of evidence, and tentative status. No passive/global nonselection broadening remains. Natural connector/probe translations are faithful.

`en -> ru / inferred` is null because it begins `В предварительной записи` while the evidence says the hypotheses/claim are tentative; the verifier treats “preliminary record” as a new qualification attached to the record. The draft separately keeps the hypotheses unconfirmed and Ada's agency, so this is a conservative scope hold rather than a lost hypothesis or actor. It is defensible: internal tentative metadata is not evidence that the record itself was preliminary. Clear generation should attach `предварительный` to the hypotheses/status, not the record; no verifier relaxation is warranted.

## Assessment

V41 fixes the exposed personal-nonselection persistence defect and separates the no-booking denial from the rejected-offer tuple without weakening semantic verification. The remaining no-booking loss moved to ownership because the independent candidate discarded the resolved product identity. Four answer holds correctly enforce proposal agency. The nested-report null is likely a false rejection of ambiguous but natural Russian attachment; the alternatives null is a conservative and avoidable qualification-attachment rejection. I found no accepted unsafe output among the 26 nonnull answers.
