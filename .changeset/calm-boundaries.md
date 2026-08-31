---
'@tenphi/akno-protocol': minor
'@tenphi/akno-core': minor
'@tenphi/akno-client': minor
'@tenphi/akno': minor
---

Make rebuild, undo, generated frontmatter, URL ingestion, MCP forwarding, and HTTP access fail closed at their data and authority boundaries. Rebuild now preserves durable workflow state; undo refuses stale files atomically; URL ingest blocks private destinations and DNS rebinding; MCP keeps the service allowlist; and HTTP uses read-only loopback defaults plus server-owned bearer identities.
