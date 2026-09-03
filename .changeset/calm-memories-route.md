---
'@tenphi/akno-protocol': minor
'@tenphi/akno-core': minor
'@tenphi/akno-client': minor
'@tenphi/akno': minor
---

Qualify automatic retention destinations by canonical page ownership instead of treating semantic similarity
as write authority. Routing now searches across admitted folders, excludes incompatible period buckets using
typed time or an unambiguous explicit date, resolves unambiguous supplied subjects, detects exact managed
duplicates across pages, and immediately rebuilds retained-memory projections after keyed writes. Date-prefixed
named events remain eligible for their related preparation and follow-up memory.

Managed-item curation now audits reports, plans, questions, and other non-factual retained memories through the
managed-memory projection. Configured fallback pages are treated as temporary queues whose items must move to
one unambiguous existing canonical page or remain held. Canonical subject strength prevents page oscillation and
can require a unique narrower owner when an item sits on a broad profile. `forget --memory` removes any exact
sealed managed item, including one without a derived fact id. A managed-item move also removes a unique source
heading when the moved block was the section's only content, preventing orphan headings without touching
authored sections.
