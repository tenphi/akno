---
'@tenphi/akno-core': patch
---

Keep an exact structured source speaker from being mistaken for a different reporter after display-label sanitization. Preserve the original sender and provenance; unsupported aliases, cross-speaker support and inner-report evidence still use the existing guards. Apply the optional retention output allowance to verification too, avoiding truncated verifier calls and their repeated full-source requests; phase defaults and model-role ceilings are preserved.
