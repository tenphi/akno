---
'@tenphi/akno-protocol': minor
'@tenphi/akno-core': minor
'@tenphi/akno-client': minor
'@tenphi/akno': minor
---

Add intent-aware retained-memory retrieval across recall, grounded answers, automatic context, and the evidence
graph. Factual, historical, planning, report, question, and discussion views now qualify isolated managed
memory before candidate budgeting, preserve contextual noncanonical matches without promoting them to facts,
and expose evidence-bound typed memory relations through the graph.

Keep every model request on its configured provider origin with explicit bounded redirect handling. Same-origin
307/308 redirects preserve POST bodies; cross-origin, method-rewriting, malformed, credential-bearing, looping,
and excessive redirects fail safely, while retries and API compatibility never fall through to another
provider.
