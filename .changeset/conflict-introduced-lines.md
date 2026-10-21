---
'@tenphi/akno-core': patch
---

Stop refusing a whole-page rewrite over lines it keeps unchanged. Conflict detection checked every line of a `content` write against the page, so two entries the page already held side by side, such as `Blackwater Bay: Origins … 9/10` and `Blackwater Bay: Tides … 8/10`, conflicted with each other, and any rewrite of that page was refused. A rewrite now checks only the lines it adds, and a `replace` skips the context it carries over from `find`. A rewrite that changes a value is still flagged.
