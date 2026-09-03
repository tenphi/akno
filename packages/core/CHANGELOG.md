# @tenphi/akno-core

## 0.10.0

### Minor Changes

- [#51](https://github.com/tenphi/akno/pull/51) [`494fdb0`](https://github.com/tenphi/akno/commit/494fdb069f623ae29f1fb88b9aacf08eec1fc8bb) Thanks [@tenphi](https://github.com/tenphi)! - Quarantine deterministic Markdown conflicts before indexing. Complete merge blocks, owner-configured
  sync-conflict paths, and duplicate stable page ids remain outside recall, derivation, graph, maintenance, and
  automatic writes until file repair clears the typed conflict state.

### Patch Changes

- Updated dependencies [[`494fdb0`](https://github.com/tenphi/akno/commit/494fdb069f623ae29f1fb88b9aacf08eec1fc8bb)]:
  - @tenphi/akno-protocol@0.10.0

## 0.9.0

### Minor Changes

- [#49](https://github.com/tenphi/akno/pull/49) [`4425945`](https://github.com/tenphi/akno/commit/44259453e8fde2967baee21da150ef39f58b9ec4) Thanks [@tenphi](https://github.com/tenphi)! - Complete source-native retention: retain from indexed source pages and documents, optionally archive inline
  sources atomically, replace exact earlier support in corrected revisions, and prune inactive private evidence
  after its dependency-aware grace. `remember` now writes through the shared retention engine while preserving
  its public compatibility response.

### Patch Changes

- Updated dependencies [[`4425945`](https://github.com/tenphi/akno/commit/44259453e8fde2967baee21da150ef39f58b9ec4)]:
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

## 0.7.0

### Minor Changes

- [#44](https://github.com/tenphi/akno/pull/44) [`51529b4`](https://github.com/tenphi/akno/commit/51529b472bac914ecfde4b1fa15dd5fc01ce3d90) Thanks [@tenphi](https://github.com/tenphi)! - Co-locate evidence-backed level-two observations on exact-subject pages with independent proof lineage,
  planned lifecycle transitions, level-aware recall, leaf-expanded answer citations, graph projection, indexed
  reflection, and an explicit reversible migration for legacy detached observation lines.

### Patch Changes

- Updated dependencies [[`51529b4`](https://github.com/tenphi/akno/commit/51529b472bac914ecfde4b1fa15dd5fc01ce3d90)]:
  - @tenphi/akno-protocol@0.7.0

## 0.6.0

### Minor Changes

- [#42](https://github.com/tenphi/akno/pull/42) [`0c09ba7`](https://github.com/tenphi/akno/commit/0c09ba7ff4cc6e6591c3908a60a5949dab4799e8) Thanks [@tenphi](https://github.com/tenphi)! - Add one clock-relative timeline across authored events, retained states, plans and deadlines, and document date evidence. Timeline reads now support explicit clocks, temporal and actionability filters, bounded recurrence, and grouped counts; recall, answers, and automatic context preserve temporal eligibility instead of treating planned or expired memory as current fact. The wire protocol advances to version 2 because timeline adds a retained-memory result variant and required clock metadata.

### Patch Changes

- Updated dependencies [[`0c09ba7`](https://github.com/tenphi/akno/commit/0c09ba7ff4cc6e6591c3908a60a5949dab4799e8)]:
  - @tenphi/akno-protocol@0.6.0

## 0.5.0

### Minor Changes

- [#41](https://github.com/tenphi/akno/pull/41) [`40bea09`](https://github.com/tenphi/akno/commit/40bea091395336c96d9beceacc0b4c0cf1006081) Thanks [@tenphi](https://github.com/tenphi)! - Add replay-safe automatic retention for coherent text and structured source items, with independent semantic
  verification, automatic admitted placement, typed holds and model receipts, and retrieval qualification that
  keeps noncanonical memory searchable without using it as ordinary factual answer evidence.

### Patch Changes

- Updated dependencies [[`40bea09`](https://github.com/tenphi/akno/commit/40bea091395336c96d9beceacc0b4c0cf1006081)]:
  - @tenphi/akno-protocol@0.5.0

## 0.4.0

### Minor Changes

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Add Linux document extraction through Poppler, Tesseract, and LibreOffice with explicit provenance and actionable degradation when native tools are unavailable.

- [#32](https://github.com/tenphi/akno/pull/32) [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc) Thanks [@alex-arzner-pro](https://github.com/alex-arzner-pro)! - Add the Linux runtime foundation with XDG config, state, and socket defaults while preserving macOS paths and explicit overrides.

### Patch Changes

- Updated dependencies [[`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc), [`6cc1c8a`](https://github.com/tenphi/akno/commit/6cc1c8ac3ee8ef858539b6b316a86d74717481bc)]:
  - @tenphi/akno-protocol@0.4.0

## 0.3.0

### Minor Changes

- [#25](https://github.com/tenphi/akno/pull/25) [`0fdccd3`](https://github.com/tenphi/akno/commit/0fdccd3b52f9c216498486d48eac98bda83b6f75) Thanks [@tenphi](https://github.com/tenphi)! - Make rebuild, undo, generated frontmatter, URL ingestion, MCP forwarding, and HTTP access fail closed at their data and authority boundaries. Rebuild now preserves durable workflow state; undo refuses stale files atomically; URL ingest blocks private destinations and DNS rebinding; MCP keeps the service allowlist; and HTTP uses read-only loopback defaults plus server-owned bearer identities.

### Patch Changes

- Updated dependencies [[`0fdccd3`](https://github.com/tenphi/akno/commit/0fdccd3b52f9c216498486d48eac98bda83b6f75)]:
  - @tenphi/akno-protocol@0.3.0

## 0.2.0

### Minor Changes

- [#21](https://github.com/tenphi/akno/pull/21) [`7095fdc`](https://github.com/tenphi/akno/commit/7095fdc9e0edcdc04b0045e9986c4abbe593bfc9) Thanks [@tenphi](https://github.com/tenphi)! - Add replay-safe provided-exact retention and source-scoped retraction with typed v2 memory markers, deterministic noncanonical fact exclusion, reversible user-forget support, and an explicit dry-runnable and undoable brain migration for legacy managed items.

### Patch Changes

- Updated dependencies [[`7095fdc`](https://github.com/tenphi/akno/commit/7095fdc9e0edcdc04b0045e9986c4abbe593bfc9)]:
  - @tenphi/akno-protocol@0.2.0

## 0.1.1

### Patch Changes

- [#2](https://github.com/tenphi/akno/pull/2) [`e9a89d6`](https://github.com/tenphi/akno/commit/e9a89d640412e7c30f17f575c1bf7eac7f306fd4) Thanks [@tenphi](https://github.com/tenphi)! - Keep resumed dream plans scoped to the current run when verifying changes and writing audit receipts. Earlier
  applied items remain visible as plan history without being re-certified or reported as new work.
- Updated dependencies [[`e9a89d6`](https://github.com/tenphi/akno/commit/e9a89d640412e7c30f17f575c1bf7eac7f306fd4)]:
  - @tenphi/akno-protocol@0.1.1

## 0.1.0

### Minor Changes

- [`7cbbb05`](https://github.com/tenphi/akno/commit/7cbbb05a18dbcb623b5fd32f122f386ea7e9c36b) Thanks [@tenphi](https://github.com/tenphi)! - Initial public release of Akno: an inspectable, autonomous memory layer for agents over a Markdown knowledge
  base.

### Patch Changes

- Updated dependencies [[`7cbbb05`](https://github.com/tenphi/akno/commit/7cbbb05a18dbcb623b5fd32f122f386ea7e9c36b)]:
  - @tenphi/akno-protocol@0.1.0
