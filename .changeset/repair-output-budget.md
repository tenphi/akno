---
'@tenphi/akno-core': patch
---

Raise the default derive ceiling to 16,384 tokens so complete retention requests are no longer capped at a brief page-summary allowance. Smaller caller requests and explicit lower ceilings remain honored. Give multi-record retention repairs a bounded output allowance proportional to their failed records, while preserving configured model ceilings. Require complete repair transactions so unfinished JSON cannot replace original candidates; independent verification and admitted siblings remain intact.
