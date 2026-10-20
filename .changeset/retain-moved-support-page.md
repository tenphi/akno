---
'@tenphi/akno-core': patch
---

Stop failing an automatically retained source revision when the page an earlier memory from the same source was first written to has since been moved, folded into a folder or removed. Comparing new evidence with earlier memories read every page those memories were originally written to, alongside the page each one lives on now, and a missing original page threw `not_found`. Retain then held the whole revision as `retain_apply_failed`, and every later revision of that source failed the same way. A page that no longer exists now contributes no lines: the earlier memory is compared where it lives now, and one that no page carries any more is skipped as before. Other read failures still fail the revision.
