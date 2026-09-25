---
'@tenphi/akno-core': minor
'@tenphi/akno-protocol': minor
'@tenphi/akno-client': minor
'@tenphi/akno': minor
---

Discover folder-owned timelines from existing `timeline.md` files. Remembered temporal items inherit their owning page's nearest timeline; event writes select that ledger and receipts identify it. Timeline queries and recent-history context default to the root chronology, with explicit selection and combined views. Add timeline discovery, unavailable-boundary reporting, and a read-only preview of legacy ledger entries that need placement review.

Empty timeline declarations are valid boundaries. Initialize their Markdown structure on the first admitted event write, preserving read-only indexing, write policy, and exact undo.
