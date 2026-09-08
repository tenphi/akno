# V29 evaluation evidence

Runtime commit: `513cabf`. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol. A later CI-only test change at `c10e01a` leaves all production code and evaluation thresholds unchanged.

The exposed report/assistant/fiction diagnostic yielded 2/3 useful retained sets, 21/24 useful answers and 24/24 useful retrieval judgments. The report omitted the separate absence of an arranged shipment, while its focused answers preserved the required report meaning. Three answers were unjustified nulls. Every nonnull answer was source-entailing, qualified and language compliant.

The separate built-package report/fiction probe after build and service restart yielded 2/2 useful retained sets, 15/16 useful answers and 16/16 useful retrieval judgments. One fictional answer was an unjustified null. All nonnull answers were source-entailing, qualified and language compliant. Source bytes remained unchanged in both probes.

The full fresh v17 trial is running with both splits repeated twice under the committed V29 plan. These exposed probes alone do not establish the full 90% coverage and zero-error gate. Preserve every full-trial result and independent judgment, including failures.
