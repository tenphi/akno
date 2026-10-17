---
'@tenphi/akno-core': patch
---

Compare earlier correlated records in bounded batches instead of failing closed on the size of the whole source group. Once a long conversation had retained more than sixteen memories, every later revision with a held candidate reported `deciding_relation_unavailable` and restricted all of the conversation's earlier memories as `pending_correction`. Each model call is still bounded; only a batch that cannot be compared is held, oversized held source text is split at item and line boundaries, and an earlier record whose line no longer exists is skipped. Upgrading to schema 49 releases holds recorded by the old size guard once.
