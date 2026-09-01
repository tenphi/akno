---
'@tenphi/akno-protocol': minor
'@tenphi/akno-core': minor
'@tenphi/akno-client': minor
'@tenphi/akno': minor
---

Add one clock-relative timeline across authored events, retained states, plans and deadlines, and document date evidence. Timeline reads now support explicit clocks, temporal and actionability filters, bounded recurrence, and grouped counts; recall, answers, and automatic context preserve temporal eligibility instead of treating planned or expired memory as current fact. The wire protocol advances to version 2 because timeline adds a retained-memory result variant and required clock metadata.
