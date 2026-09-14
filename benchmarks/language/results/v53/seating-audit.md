# V53 seating-modifier convention audit

I compared only the original `v18-held-alternatives` source, retained record, and actual answers in `tmp/language-built-output-packet-v53.json`.

The Russian source phrase `неплотно вставленный внутренний разъём` identifies a connector-seating mechanism: the connector is inserted but not firmly or fully seated. In this technical context, **“improperly seated internal connector”** is a natural English paraphrase of that mechanism. “Seated” keeps the connector’s insertion/engagement relation rather than describing arbitrary installation, and “improperly” marks the deficient seating. It is slightly less literal about looseness, but it does not remove the material causal mechanism or broaden it beyond connector seating. Literal identity is unnecessary for complete/useful preservation.

By contrast, **`неправильно установленный внутренний разъём`** says only that the connector was incorrectly installed. `Установленный` can cover mounting or installation generally and does not preserve that the hypothesized defect is loose/incomplete insertion or seating. It remains a source-entailed generalization, but it is incomplete for an answer asking for the competing hypotheses.

The convention therefore remains:

- Retained `improperly seated` record: complete and useful.
- EN→EN inferred, EN→EN explicit, and RU→EN inferred answers using `improperly seated`: complete and useful.
- RU→RU inferred and RU→RU explicit answers preserving `неплотно вставлен`: complete and useful.
- EN→RU inferred using `неправильно установленный`: source-entailed but incomplete, with usefulQualifiedAnswer and qualificationPreserved false.
- EN→RU explicit and RU→EN explicit are null coverage losses and are unaffected by the modifier question.

No judgment changed, so `tmp/language-built-output-review-v53.json` was left untouched and no `-initial` copy was created. Counts remain 4/4 useful retained sets, 32/32 useful retrievals, and 25/32 useful answers.
