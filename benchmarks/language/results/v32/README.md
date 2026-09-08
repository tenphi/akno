# V32 evaluation evidence

Runtime commit: `8128401`. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol. Fresh v18 input review approved all 22 cases before execution at fingerprint `bbd6def51d25ea19f7fd273a95174e321b9789914ce288091e56d10e98a64866`.

The exposed report/rejected-plan/undated-proposal/competing-hypotheses diagnostic yielded 3/4 useful retained sets, 31/32 useful answers and 32/32 useful retrieval judgments. The report’s separate no-shipment assertion was missing. One undated-proposal English-query/Russian-answer explicit view returned an unjustified null. All nonnull answers were source-entailing, qualified and language compliant.

The separate built-package open-question/assistant-report probe after build and service restart yielded 2/2 useful retained sets, 11/16 useful answers and 16/16 useful retrieval judgments. Five question answers were unjustified nulls. One otherwise useful Russian assistant answer left the generic role “assistant” untranslated, an accepted language error. All retained content and nonnull answers were source-entailing; no unsafe promotion or source-byte change was found.

No full fresh V32 trial was started. The accepted built-probe language defect was discovered before fresh held-out execution. The original validation plan is preserved; the committed amendment explains why exposed defects are addressed before consuming the still-unexecuted v18 held-out sources. These probes are failed diagnostic/deployment evidence and establish no full quality gate.
