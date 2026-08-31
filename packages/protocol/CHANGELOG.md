# @tenphi/akno-protocol

## 0.3.0

### Minor Changes

- [#25](https://github.com/tenphi/akno/pull/25) [`0fdccd3`](https://github.com/tenphi/akno/commit/0fdccd3b52f9c216498486d48eac98bda83b6f75) Thanks [@tenphi](https://github.com/tenphi)! - Make rebuild, undo, generated frontmatter, URL ingestion, MCP forwarding, and HTTP access fail closed at their data and authority boundaries. Rebuild now preserves durable workflow state; undo refuses stale files atomically; URL ingest blocks private destinations and DNS rebinding; MCP keeps the service allowlist; and HTTP uses read-only loopback defaults plus server-owned bearer identities.

## 0.2.0

### Minor Changes

- [#21](https://github.com/tenphi/akno/pull/21) [`7095fdc`](https://github.com/tenphi/akno/commit/7095fdc9e0edcdc04b0045e9986c4abbe593bfc9) Thanks [@tenphi](https://github.com/tenphi)! - Add replay-safe provided-exact retention and source-scoped retraction with typed v2 memory markers, deterministic noncanonical fact exclusion, reversible user-forget support, and an explicit dry-runnable and undoable brain migration for legacy managed items.

## 0.1.1

### Patch Changes

- [#2](https://github.com/tenphi/akno/pull/2) [`e9a89d6`](https://github.com/tenphi/akno/commit/e9a89d640412e7c30f17f575c1bf7eac7f306fd4) Thanks [@tenphi](https://github.com/tenphi)! - Keep resumed dream plans scoped to the current run when verifying changes and writing audit receipts. Earlier
  applied items remain visible as plan history without being re-certified or reported as new work.

## 0.1.0

### Minor Changes

- [`7cbbb05`](https://github.com/tenphi/akno/commit/7cbbb05a18dbcb623b5fd32f122f386ea7e9c36b) Thanks [@tenphi](https://github.com/tenphi)! - Initial public release of Akno: an inspectable, autonomous memory layer for agents over a Markdown knowledge
  base.
