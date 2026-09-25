---
'@tenphi/akno-core': patch
---

Verify retained event time against the same source supplied reference clock used during extraction. This prevents safe dated reports from being held because their timezone was absent from the report prose.
