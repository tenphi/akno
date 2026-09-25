# @tenphi/akno

## 0.13.5

### Patch Changes

- Updated dependencies [[`c02b1db`](https://github.com/tenphi/akno/commit/c02b1db8e904b7466c391bd0e7dc078497811ecb)]:
  - @tenphi/akno-core@0.13.5
  - @tenphi/akno-client@0.13.5
  - @tenphi/akno-protocol@0.13.5

## 0.13.4

### Patch Changes

- Updated dependencies [[`881f67b`](https://github.com/tenphi/akno/commit/881f67b202d736da5147b14143d974c625f25be6)]:
  - @tenphi/akno-core@0.13.4
  - @tenphi/akno-client@0.13.4
  - @tenphi/akno-protocol@0.13.4

## 0.13.3

### Patch Changes

- Updated dependencies [[`8dff5de`](https://github.com/tenphi/akno/commit/8dff5de9e31ed3a36de6faa5f41c4f9ba58337bb)]:
  - @tenphi/akno-core@0.13.3
  - @tenphi/akno-client@0.13.3
  - @tenphi/akno-protocol@0.13.3

## 0.13.2

### Patch Changes

- [#85](https://github.com/tenphi/akno/pull/85) [`6a5b906`](https://github.com/tenphi/akno/commit/6a5b90644f064169f45fb2a0653075971aff0605) Thanks [@tenphi](https://github.com/tenphi)! - Require separate, replayable evidence-scope assessment before admitting new observations and reflected principles, preserving exact bounded wording and explicit provenance through rebuilds.

- [#86](https://github.com/tenphi/akno/pull/86) [`8d98250`](https://github.com/tenphi/akno/commit/8d982501ea651171a84bcef77bc9563ea9a9eedd) Thanks [@tenphi](https://github.com/tenphi)! - Keep documents with duplicate attachment identifiers distinct during indexing, evaluate graph completeness against eligible facts, and migrate unlabeled retained payloads into source files safely.

- [#82](https://github.com/tenphi/akno/pull/82) [`5b36dea`](https://github.com/tenphi/akno/commit/5b36dea8dae3f454a3551124fa5ec8300c919b19) Thanks [@tenphi](https://github.com/tenphi)! - Restore reliable maintenance progress, co-located observation verification, and loaded deployment validation across repeated dream cycles.

- [#84](https://github.com/tenphi/akno/pull/84) [`398f1cf`](https://github.com/tenphi/akno/commit/398f1cf825bf72132a95b41d2036d5d4730df2cb) Thanks [@tenphi](https://github.com/tenphi)! - Add durable actor-scoped idempotency keys for write, move, forget, and folder mutations, including safe replay and explicit interrupted-write recovery.

- [#86](https://github.com/tenphi/akno/pull/86) [`8d98250`](https://github.com/tenphi/akno/commit/8d982501ea651171a84bcef77bc9563ea9a9eedd) Thanks [@tenphi](https://github.com/tenphi)! - Qualify retained facts for durable scope before placement, reject generic destinations, and preserve ambiguous ownership holds while allowing repeated events to add support only after identity is established.
- Updated dependencies [[`6a5b906`](https://github.com/tenphi/akno/commit/6a5b90644f064169f45fb2a0653075971aff0605), [`8d98250`](https://github.com/tenphi/akno/commit/8d982501ea651171a84bcef77bc9563ea9a9eedd), [`5b36dea`](https://github.com/tenphi/akno/commit/5b36dea8dae3f454a3551124fa5ec8300c919b19), [`398f1cf`](https://github.com/tenphi/akno/commit/398f1cf825bf72132a95b41d2036d5d4730df2cb), [`8d98250`](https://github.com/tenphi/akno/commit/8d982501ea651171a84bcef77bc9563ea9a9eedd)]:
  - @tenphi/akno-core@0.13.2
  - @tenphi/akno-client@0.13.2
  - @tenphi/akno-protocol@0.13.2

## 0.13.1

### Patch Changes

- Updated dependencies [[`20cb951`](https://github.com/tenphi/akno/commit/20cb9515337e8d3a40a4fa45d5f04820f1cb14c1), [`745a8c4`](https://github.com/tenphi/akno/commit/745a8c45bceb6c03da7d26c3de19a3fae5450760), [`558954d`](https://github.com/tenphi/akno/commit/558954da1198b309e4c1cbfa0800636a43c6e649), [`60db7e3`](https://github.com/tenphi/akno/commit/60db7e3a962d4e4d6a42f559f223ab0e9392807d)]:
  - @tenphi/akno-core@0.13.1
  - @tenphi/akno-client@0.13.1
  - @tenphi/akno-protocol@0.13.1

## 0.13.0

### Minor Changes

- [#70](https://github.com/tenphi/akno/pull/70) [`41bd5b0`](https://github.com/tenphi/akno/commit/41bd5b085c676622fb7635f2fc95e76791c7ea5a) Thanks [@tenphi](https://github.com/tenphi)! - Add an opt-in English knowledge-language policy and independent English/Russian answer-language requests.
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

  This is a partial delivery of [#61](https://github.com/tenphi/akno/issues/61)/[#62](https://github.com/tenphi/akno/issues/62), whose reliability acceptance remains open. The frozen comparison
  recorded one unsupported retained set and nine erroneous answer outputs; semantic verification remains
  fallible. Its 1,024-token answer ceiling differs from the shipped 2,400-token default, so the published
  quality score does not validate that default profile. See the
  [evaluated scope](https://github.com/tenphi/akno/blob/main/docs/language-and-discourse.md#current-evaluated-scope)
  for the complete results and limitations.

### Patch Changes

- Updated dependencies [[`41bd5b0`](https://github.com/tenphi/akno/commit/41bd5b085c676622fb7635f2fc95e76791c7ea5a), [`1bc0b09`](https://github.com/tenphi/akno/commit/1bc0b09629251ba0cd8decc9d40516f3d3f81510)]:
  - @tenphi/akno-core@0.13.0
  - @tenphi/akno-protocol@0.13.0
  - @tenphi/akno-client@0.13.0

## 0.12.0

### Minor Changes

- [#59](https://github.com/tenphi/akno/pull/59) [`c2ac2d1`](https://github.com/tenphi/akno/commit/c2ac2d1988d9f6e8ccaa956e89624015110f47aa) Thanks [@tenphi](https://github.com/tenphi)! - Keep managed facts inside the correct page and folder scope, hold oscillating or page-vacating moves, report
  empty knowledge-page shells, and catch up one missed nightly maintenance window when the user service loads.

### Patch Changes

- Updated dependencies [[`c2ac2d1`](https://github.com/tenphi/akno/commit/c2ac2d1988d9f6e8ccaa956e89624015110f47aa)]:
  - @tenphi/akno-protocol@0.12.0
  - @tenphi/akno-core@0.12.0
  - @tenphi/akno-client@0.12.0

## 0.11.0

### Minor Changes

- [#57](https://github.com/tenphi/akno/pull/57) [`3016c02`](https://github.com/tenphi/akno/commit/3016c0276aa848e7506d93da0a54206c38fa3860) Thanks [@tenphi](https://github.com/tenphi)! - Qualify automatic retention destinations by canonical page ownership instead of treating semantic similarity
  as write authority. Routing now searches across admitted folders, excludes incompatible period buckets using
  typed time or an unambiguous explicit date, resolves unambiguous supplied subjects, detects exact managed
  duplicates across pages, and immediately rebuilds retained-memory projections after keyed writes. Date-prefixed
  named events remain eligible for their related preparation and follow-up memory.

  Managed-item curation now audits reports, plans, questions, and other non-factual retained memories through the
  managed-memory projection. Configured fallback pages are treated as temporary queues whose items must move to
  one unambiguous existing canonical page or remain held. Canonical subject strength prevents page oscillation and
  can require a unique narrower owner when an item sits on a broad profile. `forget --memory` removes any exact
  sealed managed item, including one without a derived fact id. A managed-item move also removes a unique source
  heading when the moved block was the section's only content, preventing orphan headings without touching
  authored sections.

### Patch Changes

- Updated dependencies [[`3016c02`](https://github.com/tenphi/akno/commit/3016c0276aa848e7506d93da0a54206c38fa3860)]:
  - @tenphi/akno-protocol@0.11.0
  - @tenphi/akno-core@0.11.0
  - @tenphi/akno-client@0.11.0

## 0.10.1

### Patch Changes

- [#54](https://github.com/tenphi/akno/pull/54) [`1e84050`](https://github.com/tenphi/akno/commit/1e84050cb50bf90326fd755aab92efd56fb4e7dc) Thanks [@tenphi](https://github.com/tenphi)! - Bind auto-recall pronouns, possessives, and omitted-subject question fragments to one identity from bounded
  recent conversation. Ambiguous or unresolved references now abstain with a typed resolution receipt, and model
  qualification cannot substitute a different conversational subject.
- Updated dependencies [[`1e84050`](https://github.com/tenphi/akno/commit/1e84050cb50bf90326fd755aab92efd56fb4e7dc)]:
  - @tenphi/akno-protocol@0.10.1
  - @tenphi/akno-core@0.10.1
  - @tenphi/akno-client@0.10.1

## 0.10.0

### Minor Changes

- [#51](https://github.com/tenphi/akno/pull/51) [`494fdb0`](https://github.com/tenphi/akno/commit/494fdb069f623ae29f1fb88b9aacf08eec1fc8bb) Thanks [@tenphi](https://github.com/tenphi)! - Quarantine deterministic Markdown conflicts before indexing. Complete merge blocks, owner-configured
  sync-conflict paths, and duplicate stable page ids remain outside recall, derivation, graph, maintenance, and
  automatic writes until file repair clears the typed conflict state.

### Patch Changes

- Updated dependencies [[`494fdb0`](https://github.com/tenphi/akno/commit/494fdb069f623ae29f1fb88b9aacf08eec1fc8bb)]:
  - @tenphi/akno-client@0.10.0
  - @tenphi/akno-core@0.10.0
  - @tenphi/akno-protocol@0.10.0

## 0.9.0

### Minor Changes

- [#49](https://github.com/tenphi/akno/pull/49) [`4425945`](https://github.com/tenphi/akno/commit/44259453e8fde2967baee21da150ef39f58b9ec4) Thanks [@tenphi](https://github.com/tenphi)! - Complete source-native retention: retain from indexed source pages and documents, optionally archive inline
  sources atomically, replace exact earlier support in corrected revisions, and prune inactive private evidence
  after its dependency-aware grace. `remember` now writes through the shared retention engine while preserving
  its public compatibility response.

### Patch Changes

- Updated dependencies [[`4425945`](https://github.com/tenphi/akno/commit/44259453e8fde2967baee21da150ef39f58b9ec4)]:
  - @tenphi/akno-client@0.9.0
  - @tenphi/akno-core@0.9.0
  - @tenphi/akno-protocol@0.9.0

## 0.8.0

### Minor Changes

- [#47](https://github.com/tenphi/akno/pull/47) [`d89df8c`](https://github.com/tenphi/akno/commit/d89df8c5934a056f18ae5824608dd8a953b7e07a) Thanks [@tenphi](https://github.com/tenphi)! - Add intent-aware retained-memory retrieval across recall, grounded answers, automatic context, and the evidence
  graph. Factual, historical, planning, report, question, and discussion views now qualify isolated managed
  memory before candidate budgeting, preserve contextual noncanonical matches without promoting them to facts,
  and expose evidence-bound typed memory relations through the graph.

  Keep every model request on its configured provider origin with explicit bounded redirect handling. Same-origin
  307/308 redirects preserve POST bodies; cross-origin, method-rewriting, malformed, credential-bearing, looping,
  and excessive redirects fail safely, while retries and API compatibility never fall through to another
  provider.

### Patch Changes

- Updated dependencies [[`d89df8c`](https://github.com/tenphi/akno/commit/d89df8c5934a056f18ae5824608dd8a953b7e07a)]:
  - @tenphi/akno-protocol@0.8.0
  - @tenphi/akno-core@0.8.0
  - @tenphi/akno-client@0.8.0

## 0.7.0

### Minor Changes

- [#44](https://github.com/tenphi/akno/pull/44) [`51529b4`](https://github.com/tenphi/akno/commit/51529b472bac914ecfde4b1fa15dd5fc01ce3d90) Thanks [@tenphi](https://github.com/tenphi)! - Co-locate evidence-backed level-two observations on exact-subject pages with independent proof lineage,
  planned lifecycle transitions, level-aware recall, leaf-expanded answer citations, graph projection, indexed
  reflection, and an explicit reversible migration for legacy detached observation lines.

### Patch Changes

- Updated dependencies [[`51529b4`](https://github.com/tenphi/akno/commit/51529b472bac914ecfde4b1fa15dd5fc01ce3d90)]:
  - @tenphi/akno-protocol@0.7.0
  - @tenphi/akno-core@0.7.0
  - @tenphi/akno-client@0.7.0

## 0.6.0

### Minor Changes

- [#42](https://github.com/tenphi/akno/pull/42) [`0c09ba7`](https://github.com/tenphi/akno/commit/0c09ba7ff4cc6e6591c3908a60a5949dab4799e8) Thanks [@tenphi](https://github.com/tenphi)! - Add one clock-relative timeline across authored events, retained states, plans and deadlines, and document date evidence. Timeline reads now support explicit clocks, temporal and actionability filters, bounded recurrence, and grouped counts; recall, answers, and automatic context preserve temporal eligibility instead of treating planned or expired memory as current fact. The wire protocol advances to version 2 because timeline adds a retained-memory result variant and required clock metadata.

### Patch Changes

- Updated dependencies [[`0c09ba7`](https://github.com/tenphi/akno/commit/0c09ba7ff4cc6e6591c3908a60a5949dab4799e8)]:
  - @tenphi/akno-protocol@0.6.0
  - @tenphi/akno-core@0.6.0
  - @tenphi/akno-client@0.6.0

## 0.5.0

### Minor Changes

- [#41](https://github.com/tenphi/akno/pull/41) [`40bea09`](https://github.com/tenphi/akno/commit/40bea091395336c96d9beceacc0b4c0cf1006081) Thanks [@tenphi](https://github.com/tenphi)! - Add replay-safe automatic retention for coherent text and structured source items, with independent semantic
  verification, automatic admitted placement, typed holds and model receipts, and retrieval qualification that
  keeps noncanonical memory searchable without using it as ordinary factual answer evidence.

### Patch Changes

- Updated dependencies [[`40bea09`](https://github.com/tenphi/akno/commit/40bea091395336c96d9beceacc0b4c0cf1006081)]:
  - @tenphi/akno-protocol@0.5.0
  - @tenphi/akno-core@0.5.0
  - @tenphi/akno-client@0.5.0

## 0.4.0

### Minor Changes

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Add Linux document extraction through Poppler, Tesseract, and LibreOffice with explicit provenance and actionable degradation when native tools are unavailable.

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Add the Linux runtime foundation with XDG config, state, and socket defaults while preserving macOS paths and explicit overrides.

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Add Linux systemd user-service lifecycle, nightly dream timers, missed-cycle health checks, and redeploy readiness.

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Deliver scheduled maintenance notifications to the local system log on Linux and report typed delivery failures.

### Patch Changes

- [#39](https://github.com/tenphi/akno/pull/39) [`d4adb2f`](https://github.com/tenphi/akno/commit/d4adb2f1c413af7a5f147bf6be325ce863c4e0fc) Thanks [@tenphi](https://github.com/tenphi)! - Run the post-build redeploy phase in a fresh CLI process so service restarts use the newly built core artifacts on the first invocation.
- Updated dependencies [[`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc), [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc)]:
  - @tenphi/akno-core@0.4.0
  - @tenphi/akno-client@0.4.0
  - @tenphi/akno-protocol@0.4.0

## 0.3.0

### Minor Changes

- [#25](https://github.com/tenphi/akno/pull/25) [`0fdccd3`](https://github.com/tenphi/akno/commit/0fdccd3b52f9c216498486d48eac98bda83b6f75) Thanks [@tenphi](https://github.com/tenphi)! - Make rebuild, undo, generated frontmatter, URL ingestion, MCP forwarding, and HTTP access fail closed at their data and authority boundaries. Rebuild now preserves durable workflow state; undo refuses stale files atomically; URL ingest blocks private destinations and DNS rebinding; MCP keeps the service allowlist; and HTTP uses read-only loopback defaults plus server-owned bearer identities.

### Patch Changes

- Updated dependencies [[`0fdccd3`](https://github.com/tenphi/akno/commit/0fdccd3b52f9c216498486d48eac98bda83b6f75)]:
  - @tenphi/akno-protocol@0.3.0
  - @tenphi/akno-core@0.3.0
  - @tenphi/akno-client@0.3.0

## 0.2.0

### Minor Changes

- [#21](https://github.com/tenphi/akno/pull/21) [`7095fdc`](https://github.com/tenphi/akno/commit/7095fdc9e0edcdc04b0045e9986c4abbe593bfc9) Thanks [@tenphi](https://github.com/tenphi)! - Add replay-safe provided-exact retention and source-scoped retraction with typed v2 memory markers, deterministic noncanonical fact exclusion, reversible user-forget support, and an explicit dry-runnable and undoable brain migration for legacy managed items.

### Patch Changes

- Updated dependencies [[`7095fdc`](https://github.com/tenphi/akno/commit/7095fdc9e0edcdc04b0045e9986c4abbe593bfc9)]:
  - @tenphi/akno-protocol@0.2.0
  - @tenphi/akno-core@0.2.0
  - @tenphi/akno-client@0.2.0

## 0.1.1

### Patch Changes

- [#2](https://github.com/tenphi/akno/pull/2) [`e9a89d6`](https://github.com/tenphi/akno/commit/e9a89d640412e7c30f17f575c1bf7eac7f306fd4) Thanks [@tenphi](https://github.com/tenphi)! - Keep resumed dream plans scoped to the current run when verifying changes and writing audit receipts. Earlier
  applied items remain visible as plan history without being re-certified or reported as new work.
- Updated dependencies [[`e9a89d6`](https://github.com/tenphi/akno/commit/e9a89d640412e7c30f17f575c1bf7eac7f306fd4)]:
  - @tenphi/akno-protocol@0.1.1
  - @tenphi/akno-core@0.1.1
  - @tenphi/akno-client@0.1.1

## 0.1.0

### Minor Changes

- [`7cbbb05`](https://github.com/tenphi/akno/commit/7cbbb05a18dbcb623b5fd32f122f386ea7e9c36b) Thanks [@tenphi](https://github.com/tenphi)! - Initial public release of Akno: an inspectable, autonomous memory layer for agents over a Markdown knowledge
  base.

### Patch Changes

- Updated dependencies [[`7cbbb05`](https://github.com/tenphi/akno/commit/7cbbb05a18dbcb623b5fd32f122f386ea7e9c36b)]:
  - @tenphi/akno-protocol@0.1.0
  - @tenphi/akno-core@0.1.0
  - @tenphi/akno-client@0.1.0
