# V31 evaluation evidence

Runtime commit: `2e82c97`. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol.

The exposed report/assistant/fiction diagnostic yielded 3/3 useful retained sets, 22/24 useful answers and 24/24 useful retrieval judgments. Two writable nulls remain unjustified: report Russian-query/Russian-answer explicit view, and fiction Russian-query/English-answer inferred view. Every nonnull answer was source-entailing, qualified and language compliant; no unsafe promotion was found.

The separate built-package report/assistant probe after build and service restart yielded 2/2 useful retained sets, 14/16 useful answers and 16/16 useful retrieval judgments. Both assistant English-query/Russian-answer views returned unjustified nulls. Every nonnull answer was source-entailing, qualified and language compliant. Source bytes remained unchanged in both probes.

Both complete v17 splits are running twice under the committed V31 plan. The runtime was frozen before fresh V29/V30 full outputs or scores were opened. These exposed probes do not establish the repeated 90% and zero-error acceptance gate.
