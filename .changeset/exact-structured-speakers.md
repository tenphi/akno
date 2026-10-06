---
'@tenphi/akno-core': patch
---

Keep an exact structured source speaker from being mistaken for a different reporter after display-label sanitization. Preserve the original sender and provenance; unsupported aliases, cross-speaker support and inner-report evidence still use the existing guards. Apply the optional retention output allowance to verification too, avoiding truncated verifier calls and their repeated full-source requests; phase defaults and model-role ceilings are preserved.

Add opt-in batch-scoped verification failure for automatic new-source retention: preserve independent verified records while withholding invalid batches and their transitive dependents. Whole-source failure remains the default and is mandatory for replacement corrections.
