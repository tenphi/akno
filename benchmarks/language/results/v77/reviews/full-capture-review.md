# V77 full-only capture and terminal-measurement review

Independent Sol second review on frozen runtime `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`. I inspected the corrected full-only capture, zero-egress controls, trace validator, launch/start/run/validation harness, completion contract, failed-diagnostic provenance, amended plan and proceed decision. I made no provider or full-trial call and did not inspect V22 held-out prose.

## Finding

### Low — trace validation does not bind every null operation to the expansion role

`tmp/v77-full-trace-integrity.mjs:25-29`

The validator requires every recognized semantic operation to use Luna, but for `operation:null` it accepts either Luna or llama. In this full harness, the only intended null `ModelClient.chat` calls are the three query-expansion modes, and the capture itself requires those exact system prefixes to use `llama-3.2-3b-instruct`. A new or missed Luna semantic prompt could therefore appear as `operation:null` and still pass final trace validation.

Before full preflight, add the symmetric invariant: `operation === null` requires `modelId === 'llama-3.2-3b-instruct'`. Add a deterministic negative that changes one successful null-call row to Luna and requires the validator to reject it. This does not change runtime, calls, models, caps or trace fields. It tightens the evidence contract to the role policy already enforced by the capture.

I do not consider this a reason to redesign the capture. It is a small validator omission and should be fixed before manifest preparation/approval.

## Capture correction

The original infrastructure defect is correctly removed:

- `model-call-start` is appended before role-policy enforcement, with both operation and model ID.
- The actual three production `expandQuery` system prefixes select the configured llama expansion role.
- Retention, retain verification, ownership, answer and answer verification select Luna. Language checks remain internal transports of those calls.
- Policy assertion and original-call failures are caught after lifecycle start and emit `model-call-throw`; no failed call disappears before instrumentation.
- Transport starts and results/throws remain independently balanced.

The mocked control exercises production `expandQuery` in lookup, question and explore modes, five recognized Luna operations, wrong semantic/expansion/unknown models, and an expansion transport exception. It preserves thrown exception identity and proves zero network egress with `providerCalls:0`. Eight successful calls yield eight balanced model and transport lifecycles; the ninth is the intentional traced failure. The capture and validator hashes in the receipt match their reviewed files.

These controls establish instrumentation behavior only. They do not establish semantic competence or provider availability.

## Full-only harness

- The full manifest preparation binds frozen source/dist digests; V22 input packet and independent review; the full runners/capture/validator; readiness and protocol receipts; failed V77 diagnostic report; failure provenance and reviews; completion contract; trial decision; and completion-budget policy.
- It recomputes the V22 fingerprint from all 22 cases and checks both source and built corpus registries without printing held-out prose. The independent review is 22/22, explicitly source-only, independent and not authored/tuned by the reviewer.
- It binds current model IDs, enabled status, token limits, timeouts and reasoning effort, and compares all four roles with the preserved failed diagnostic report. Luna remains at 2,400 for derive/answer; expansion remains llama and embedding remains Qwen.
- Start requires a prepared exact manifest, explicit proceed decision, preserved infrastructure-failure provenance, and an independent approval bound to manifest, decision, provenance, review and completion-contract hashes. Each split obtains a unique launch receipt and cannot overwrite an existing report or trace.
- Development and held-out commands each run all eleven V22 cases twice with eight coordinates per case. Validation requires 22 case/run records per split, ten writable plus one read-only case per run, every coordinate, identical versions/models/caps/thresholds, exact launch provenance and balanced trace lifecycles. Totals are 320 writable and 32 read-only observations.
- The failed exposed diagnostics remain 96 planned and zero observed, with unknown retention/bytes and no positive semantic-readiness claim. Nothing in the full harness rewrites or replaces them.

## Gate and terminal disposition

The completion contract keeps the original 90% useful-answer gate visible and separately declares the user-authorized 80% PR-completion gate. Retention and retrieval remain 80%; all source, qualification, language, promotion, byte, unsupported-output and availability criteria remain unchanged. Each split/run is judged independently, null writable answers remain failures, and pooling cannot rescue a cell.

Using the fresh independently reviewed V22 held-out split is appropriate after quarantining V21 held-out. A single full V22 measurement is defensible despite absent V77 diagnostic semantics because:

- the absence is exactly reproduced as external instrumentation failure;
- production runtime and semantic gates are unchanged;
- the corrected capture is exercised without egress;
- prior diagnostics remain failed rather than being rerun; and
- the full result is declared terminal, with no tuning or replacement against exposed V22 output.

The launch record and publication must continue to state that V77 supplied no positive semantic-readiness result. Passing the separate 80% completion target would not retroactively pass the original 90% gate.

## Disposition

**Approve the full-only capture and terminal-measurement approach after the one trace-validator hardening above.** Following that correction, preserve a new zero-egress receipt, prepare and independently review the exact full manifest, and require hash-bound preflight before any provider call. This review itself does not authorize the full run.

---

## Final re-review and correction

The earlier low finding correctly identified ambiguity in `operation:null`, but its proposed rule—requiring every null operation to use llama—was incomplete. Production placement is a legitimate Luna call whose system prompt was not among the original five operation types. The frozen built trace and `write/placement.ts` confirm the exact placement system prefix. Applying the initial recommendation literally would have recreated a harness abort.

The current correction resolves the underlying evidence problem without that regression:

- `placement` is now a sixth finite semantic operation, matched by the exact production system prefix `You place durable knowledge into one Markdown page.`;
- the capture accepts only one of the three exact production expansion prefixes or one of the six known semantic operations;
- expansion requires `llama-3.2-3b-instruct`; every known semantic operation, including placement, requires `gpt-5.6-luna`;
- the trace validator requires `operation:null` to use llama and every nonnull operation to use Luna; and
- an unknown Luna operation is rejected after a recorded lifecycle start and before transport.

The refreshed zero-egress control calls the real `placeManagedItems` path with a valid invented managed-memory marker. It also calls all three real `expandQuery` modes, the other five semantic operations, wrong-role and unknown-role paths, an unknown Luna operation, an expansion exception, and language-cap mutations. Nine successful model calls and nine transports validate as balanced. The intentional expansion exception is the tenth stub call and preserves the original error identity with `transport-throw` and `model-call-throw`. Network egress remains zero.

Receipt hashes independently match the current files:

- capture: `b06082c7fd1758671adb1ccfb05a2fce31fd7c9ac50d16379fe4a5e8cabca295`;
- validator: `8f5aabb680b16755c15bf2bd604763960c9f70e8dd4946e0207ab5e471630b0c`;
- control trace: `6e927ee9c9f98a76fb1613ca005de4f1a39b2a6e419864d345f4a5cf6dbcaa6b`.

The intermediate invalid-marker fixture and earlier control/test/trace versions remain preserved. Production runtime, provider configuration, model calls, semantic gates and caps are unchanged.

### Final disposition

**Clean. The full-only capture correction is approved for exact-manifest preparation and independent full preflight.** The initial low finding is closed by explicit placement classification plus symmetric role validation. This review still does not authorize a provider or full-trial run.
