# V48 exclusion-role and proposal-status audit

## `v19-held-exclusion` Russian answers

The source asks whether **repair of the fan motor** is covered by warranty: `покрыт ли ремонт двигателя вентилятора`.

- Run 1, EN→RU inferred: `покрывается ли ремонтом по гарантии двигатель вентилятора` makes the **fan motor** the covered subject and `ремонтом` the covering means. This reverses the source roles. Corrected to not useful, not source entailed, qualification not preserved.
- Run 1, EN→RU explicit: `покрывается ли гарантией ремонт двигателя вентилятора` has the correct subject (`ремонт`) and covering means (`гарантией`). It remains accepted.
- Run 1, RU→RU inferred: `покрывается ли ремонтом двигатель вентилятора` again makes the motor covered by repair. Corrected to fail.
- Run 1, RU→RU explicit: `покрывается ли ремонтом двигателя вентилятора гарантия` makes the warranty the covered subject and fan-motor repair the means. Corrected to fail.
- Run 2, EN→RU inferred: `покрывается ли ремон двигателя вентилятора` contains the typo `ремон` for nominative `ремонт`. In context its recoverable grammatical intent is still “whether fan-motor repair is covered,” and the following contract-silence clause confirms that scope. It remains useful and source entailed; the typo does not change the requested language.
- Run 2, EN→RU explicit: `покрывается ли ремонтом двигатель вентилятора` reverses the roles. Corrected to fail.
- Run 2, RU→RU inferred: `покрывается ли ремонтом по гарантии двигатель вентилятора` reverses the roles. Corrected to fail.
- Run 2, RU→RU explicit: `покрывается ли ремонтом двигателя вентилятора гарантия` reverses the roles. Corrected to fail.

These failures preserve an unresolved grammatical form rather than assert actual motor coverage, so I did not mark unsafe factual promotion.

## `v19-held-undated` proposal wording

- Run 1 EN→EN explicit, `proposed, tentatively, reviewing`: the adverb marks the proposal/action as provisional. The sentence still directly asserts that Ada proposed the review, then states the unknown source-relative year and absence of an adopted plan or meeting. It does not make the fact of her proposing uncertain. No change.
- Run 1 RU→EN explicit, `this remains a tentative proposal`: “tentative” characterizes the proposal’s status and timing, while `Ada Marlow proposed` remains asserted. No change.
- Run 2 EN→RU inferred, `предложила предварительно пересмотреть`: this says Ada proposed a preliminary/provisional review. It does not hedge whether she made the proposal, and the remainder preserves the undated clock, unknown calendar year, no adopted plan, and no meeting. No change.

The convention-corrected pre-audit receipt is preserved at `tmp/language-v19-output-review-v48-before-role-audit.json`.
