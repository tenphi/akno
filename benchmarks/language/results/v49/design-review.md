# V49 bounded design review

## Scope

This review covers the proposed V49 direction against the current `memory/intent.ts`, `ops/answer.ts`, `models/semantic-verdict.ts`, and `timeline/source-clock.ts`, using only already exposed V48 development evidence. It proposes no new model call, retry, schema, gate, or eligibility rule.

## Recommended shape

The smallest coherent change is three narrow code changes and one short shared proposition-scope contract. Avoid adding the whole list of observed sentences to both prompts.

### 1. Extend view inference with bounded predicate-and-record constructions

Keep the existing precedence and precision policy: reports first, then questions, discussion, history, and planning. Add cue helpers analogous to `boundedDiscoursePhrase`, rather than unbound stem alternatives.

Recommended report cues:

- Russian finite `пересказал/пересказала/пересказывает` when it directly governs `слова`, `сообщение`, `версию`, `утверждение`, or a finite `что` clause. Bare `пересказ` and a remote occurrence should not activate reports.
- English assistant tentative reports only when a tentative/unverified modifier, an assistant subject, and a reporting/suggestion predicate govern the same proposition, for example `the assistant tentatively suggested that ... may ...`. Do not let bare `suggest`, `may`, or `assistant` activate reports independently.
- Russian `предварительную версию ... предложил ассистент` only with the epistemic noun, finite proposal predicate, and assistant actor in the same bounded clause. A proposed physical version/product variant remains factual/planning according to its other cues.

Recommended discussion cues:

- Fiction only when `fictional/invented/вымышленн...` binds a story/example/scenario or the promise is explicitly located inside such a frame. A real promise about discussing fiction must not become fictional content.
- Counterfactual/unrealized wording only when `несостоявшийся/нереализованный вариант` is grammatically connected to `описал/описала/рассмотрел...`, as the current helper already does. Extending its adjective or verb forms is safer than a new bare `вариант` match.

Eligibility must remain entirely in `memoryEligibleForView`; these helpers should select a view only. Tests should pair every positive with: a factual assistant suggestion, a real promise, an ordinary retelling object without a report proposition, a physical `предварительная версия` item, and an actual completed option. Also test cue precedence where a rejected fictional proposal must still reach the intended history/discussion view under the documented order.

### 2. Add one shared proposition-scope contract, expressed as four invariants

The answer prompt already contains most individual rules. Adding more examples throughout it will make precedence harder for the model to follow. Introduce one concise constant used by generation and semantic verification, near the existing frame contract:

1. **Personal epistemic limits stay personal.** `I/the assistant did not inspect or confirm X` may qualify X only as that actor's access or knowledge limit. It must not become passive/global `X was not inspected/confirmed`, document silence, or general absence of evidence.
2. **Coupled nonfactual content stays together.** A hypothetical premise and its expressly conditional consequence form one proposition; fiction qualification governs all cited fictional content. State the complete selected fictional proposition before saying it is not real. Do not let a final fiction disclaimer retroactively repair an earlier unqualified real-sounding clause.
3. **Neutral provenance adds no action.** `According to`, `the record contains`, and equivalent attribution can introduce a proposition without asserting that the named person wrote or personally recorded it. Do not add a metaclaim that evidence fails to prove personal recording.
4. **Material source acts remain material.** Neutral framing cannot erase a source-supported proposal, consideration, rejection, report, or personal nonselection. This preserves the distinction identified in V48: `proposed an assumption` cannot be reduced to `discussed a hypothetical rule` merely because the embedded rule is hypothetical.

In the verifier, require each mismatch to identify the exact actor/epistemic subject or the exact clause that escaped hypothetical/fiction scope. This uses the existing comparison/mismatch fields and avoids a permissive equivalence rule. The contract should not say that attribution verbs are generally interchangeable; only neutral outer framing is nonmaterial when the embedded source act is otherwise preserved.

### 3. Give explicit clarification precedence over conflict abstention

Both generation and semantic prompts already say that supplied clarification controls an ambiguous referent, but the V48 generator still returned empty blocks for `dial` versus Russian `регулятор`. The likely problem is instruction ordering: later conflict handling treats the two surface forms as incompatible values before applying the clarification rule.

Do not add a dial/regulator alias. Change the conflict instruction to a short ordered rule:

> First apply any explicit clarification in the supplied source/frame. Treat the clarified phrases as one referent. Only values still incompatible after that resolution trigger conflict abstention.

This is source-authoritative and language-general. Add a negative where two bilingual values are merely adjacent and no text marks one as clarification; that case must remain unresolved. Add a positive where the later clause explicitly says `that means`, `that is`, or contrasts the intended action/referent. The original exact source remains evidence; neither similarity nor a dictionary may supply equivalence.

### 4. Extend only the unknown-clock noun construction

`hasUnknownReferenceClock` already accepts several source-linked Russian forms, but not the natural bounded construction `запись с неизвестной календарной датой`. Add a source noun plus instrumental/`с` phrase:

- `(?:источник|запись|заметка|разговор)[inflection] с неизвестной календарной датой`

Keep `календарной` and the source noun mandatory for this new branch. This prevents `устройство с неизвестной датой`, `встреча с неизвестной датой`, and a free-floating `неизвестная дата` from satisfying the source-clock floor. Pair the positive with those negatives and with `запись с неизвестной датой ремонта`, which describes the repair date rather than the record's reference clock. Existing activation should remain conjunctive: qualified managed memory with unknown precision, deictic source text, source-relative anchor, and unknown clock.

## Risks and constraints

- **View inference can hide otherwise eligible evidence.** Precision is more important than recall at this stage because inferred factual view is the safe default. Every new family therefore needs a local noun/predicate/actor relationship and clause boundary; do not add bare `suggest`, `promise`, `пересказ`, `версия`, or `описала` stems.
- **Personal uncertainty is not global uncertainty.** The new contract must preserve the actor even when the answer also accurately calls the report unverified. `The assistant could not confirm it` is supported; `it could not be confirmed` may imply a broader state.
- **All-fiction-before-disclaimer is an answer-composition rule, not evidence expansion.** It should require qualification to govern each fictional clause, while allowing natural multi-sentence prose. It must not require every incidental story detail when the query selects a narrower proposition.
- **Clarification priority must remain explicit-source-only.** A bilingual switch by itself is not a clarification. The negative control above is load-bearing.
- **Do not weaken the current semantic dimensions.** The V48 verifier correctly caught invented personal-recording absence, missing proposal actors, lost regulator/replacement contrast, and malformed source clocks. The proposed changes should improve comparison ordering and proposition decomposition, not override a negative verdict or resubmit it.

## Minimum regression set

1. Positive and factual-negative pairs for each new report/discussion view construction, including mixed-language and clause-separated cases.
2. Personal assistant noninspection/nonconfirmation preserved; passive global absence rejected.
3. Hypothetical premise plus conditional consequence preserved; an answer stating only the consequence as actual rejected.
4. Multi-clause fictional answer with qualification governing every fictional assertion; late disclaimer after an unqualified real assertion rejected.
5. Neutral attribution accepted without personal recording; added `no evidence she recorded it` rejected; a real source-supported proposal still requires its proposer/action.
6. Explicit bilingual clarification resolves a surface-form difference; adjacent unexplained bilingual values remain a conflict.
7. `запись с неизвестной календарной датой` positive and device/event/repair-date negatives, with the existing source-relative-anchor conjunction still required.

## Disposition

The scope is justified if implemented as the bounded constructions and shared four-invariant contract above. The view additions improve retrieval without changing eligibility, while the prompt work targets proposition decomposition and instruction precedence. Phrase-by-phrase expansion beyond these grammatical families would increase false activation and prompt conflict without addressing the observed systemic failures.
