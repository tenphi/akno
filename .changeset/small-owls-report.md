---
'@tenphi/akno': patch
---

Allow socket hosts to request scheduler-owned health with `plan` command input
`{ action: 'status', schedule: true }`. The read-only response includes the same schedule status as
`akno dream status`, without running maintenance or changing recovery state.
