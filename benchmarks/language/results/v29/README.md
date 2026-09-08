# V29 evaluation evidence

Runtime commit: `513cabf`. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol. A later CI-only test change at `c10e01a` leaves all production code and evaluation thresholds unchanged.

The exposed report/assistant/fiction diagnostic yielded 2/3 useful retained sets, 21/24 useful answers and 24/24 useful retrieval judgments. The report omitted the separate absence of an arranged shipment, while its focused answers preserved the required report meaning. Three answers were unjustified nulls. Every nonnull answer was source-entailing, qualified and language compliant.

The separate built-package report/fiction probe after build and service restart yielded 2/2 useful retained sets, 15/16 useful answers and 16/16 useful retrieval judgments. One fictional answer was an unjustified null. All nonnull answers were source-entailing, qualified and language compliant. Source bytes remained unchanged in both probes.

The complete v17 trial fails the unchanged gate. Useful answers are 224/320 writable combinations: development 56/80 and 49/80; held-out 68/80 and 51/80. Useful retention is 29/40. All retained sets are source-entailing, but one nonnull answer adds unsupported terminology doubt and loses qualification. All 32 read-only nulls are justified; 95 writable nulls remain unjustified. No accepted language or promotion error, source-byte change or case availability failure was found.

The full reports, independent input/output judgments and computed `gate.json` are preserved here. V30 and V31 were frozen before these fresh outputs or scores were opened. Their separate complete trials remain required; neither exposed probe replaces the repeated gate.
