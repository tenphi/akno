---
'@tenphi/akno-core': patch
---

Check adoption destination policy before planning and applying filing pages. Skip source, inference, and
ignored destinations without writing or triggering rollback failures, and omit unavailable adoption actions
from recall and timeline cards. Recheck approved plans when folder policy changes.
