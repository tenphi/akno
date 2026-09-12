# V31 evaluation evidence

Runtime commit: `2e82c97`. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol.

The exposed report/assistant/fiction diagnostic yielded 3/3 useful retained sets, 22/24 useful answers and 24/24 useful retrieval judgments. Two writable nulls remain unjustified: report Russian-query/Russian-answer explicit view, and fiction Russian-query/English-answer inferred view. Every nonnull answer was source-entailing, qualified and language compliant; no unsafe promotion was found.

The separate built-package report/assistant probe after build and service restart yielded 2/2 useful retained sets, 14/16 useful answers and 16/16 useful retrieval judgments. Both assistant English-query/Russian-answer views returned unjustified nulls. Every nonnull answer was source-entailing, qualified and language compliant. Source bytes remained unchanged in both probes.

The complete v17 trial fails the unchanged gate. Independently useful answers are 279/320 writable combinations: development run 1 69/80; development run 2 70/80; held-out run 1 72/80; held-out run 2 68/80. Useful retention is 33/40. There are 38 unjustified writable nulls and 32 justified read-only abstentions. The gate records 0 unsupported retained case-runs, 0 unsupported nonnull answers, 0 qualification errors and 0 case availability failures. Two otherwise useful Russian answers leave the generic role “assistant” untranslated. No unsafe promotion or source-byte change was found. Three nonnull answers are incomplete: two omit a hypothetical rule’s stated consequence and one omits a fictional promisor.

Full reports, independent input/output receipts and the computed gate are preserved here. The original V31 runtime was frozen before fresh V29/V30 outputs were opened. V32 uses new independently approved v18 held-out inputs; its trial remains separate evidence.
