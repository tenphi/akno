---
'@tenphi/akno-core': patch
---

Verify the last applied writer in journal order for each path in a maintenance run, while retaining checks for surviving paths of earlier managed-item repairs and excluding rolled-back or older plan history.
