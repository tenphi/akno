---
'@tenphi/akno-core': patch
---

Stop holding automatically retained memories when the verifier grounds a reference through the conversation's own structure. A speakerless assistant or user turn now supplies its role as the first-person author label, and a name stated in an earlier turn by the same author can anchor a later pronoun or short name in that author's turn. Another author's turn, a later turn or a turn without an author label still cannot donate an identity, an explicit name must still occur in its own frame, and every reference keeps its semantic-role and preservation checks. Previously these legitimate references failed as `context_witness_invalid`. Replaying 224 recorded live retention runs with identical model responses, these holds fell from 87 to 34 and written memories rose from 216 to 251, with no previously written memory lost. The verifier contract changes, so `RETAIN_VERIFIER_VERSION` advances to v54.
