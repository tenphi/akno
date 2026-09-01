# @tenphi/akno-core

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
