---
'@tenphi/akno-core': minor
'@tenphi/akno-protocol': minor
---

Add opt-in fact retrieval. `recall.facts` makes derived facts searchable by full text and claim embedding and shows the lines whose facts matched first on each card, without changing which cards return or their order. `recall({ format: "facts" })` returns a ranked fact list with `slug:line` locators, evidence lines for sources without facts, and a compact `text` rendering. `index.fact_extraction: "complete"` derives one fact per checkable line. `recall.fact_ranking` and `recall.line_targeting` are measured alternatives, off by default.

Schema 50 adds a fact search index and fact vectors on upgrade. Every new setting is off by default and the wire protocol is unchanged.
