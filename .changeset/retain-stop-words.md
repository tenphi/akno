---
'@tenphi/akno-protocol': minor
'@tenphi/akno-core': minor
---

Add `maintenance.retain.stop_words`: names and terms never to retain. Extraction is told to skip them, and any candidate that still names one in its text, subject, destination, support or speaker, along with anything that depends on it, is held as `stop_word` before verification. Applies to extracted and supplied candidates, `remember`, and folder timeline curation.
