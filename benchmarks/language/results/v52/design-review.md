# V52 bounded design review

## Scope and disposition

This review uses the reconciled V51 findings supplied by the root and current source boundaries. It proposes no new model call, retry, model, schema dimension, or gate change.

The smallest justified V52 consists of:

1. a shared, source-activated two-obligation agency floor for personal plan adoption and meeting arrangement;
2. a short generation/comparison rule that keeps a speaker's lack of answer distinct from a record's non-establishment;
3. stronger language-check focus on unquoted lowercase Latin compounds, without a blanket deterministic rejection floor.

Do not add a `предложила предварительно...` manner floor. In the reconciled source reading, that wording can express a provisional proposal while still asserting the actual proposal act.

## 1. Personal negative actions: model each action separately

### Shared contract

Add one concise rule to generation and semantic comparison:

> Preserve each explicit negative action with its own actor and object. “Ada has not adopted the proposal as a plan” and “Ada has not arranged a meeting” are two personal actions. They do not entail the unassigned states “the plan was not accepted” or “no meeting was arranged.” Naming Ada in another clause or as source provenance does not supply either missing actor.

This generalizes the existing personal nonselection principle without treating every passive as unsafe. A source may itself establish an unassigned state.

### Deterministic generated-only floor

Implement a helper in the shared action-agency module, analogous in placement to `causeNonselectionAgencySupported`, but return/check two independent obligations:

- **adoption obligation:** readable source contains a personal actor who did not adopt/accept/approve/take up a proposal or plan;
- **arrangement obligation:** readable source contains a personal actor who did not arrange/book/schedule a meeting or appointment.

For each activated obligation, the generated candidate/answer must preserve a personal actor in that corresponding negative action. Passing one cannot satisfy the other. Source speaker metadata and neutral attribution do not activate or satisfy the floor.

Supported answer shapes may include:

- active: `Ada has not adopted the proposal`, `she did not arrange a meeting`, `Ada не приняла предложение как план`, `она не назначила встречу`;
- possessive/actor-bound nominal wording where agency is unambiguous: `Ada's non-adoption of the plan`;
- passive with explicit source-supported agent only if natural grammar actually preserves agency.

Reject/hold generated forms such as:

- `the plan was not accepted/adopted`;
- `meeting not arranged/booked`;
- `the proposal was unaccompanied by a meeting arrangement`;
- Russian `план не был принят`, `встреча не была назначена`, `без организации встречи`;
- a block naming Ada only as reporter/proposer and using those passives later.

### Source exemptions

- If the source itself gives an anonymous/unassigned no-plan or no-meeting clause, defer that exact action to the full verifier; do not invent an actor.
- An anonymous source clause for meeting arrangement must not exempt a separately personal plan-adoption clause, or vice versa.
- Caller-provided exact/model-free candidates remain unchanged.
- Multiple people or multiple plans remain full-verifier work; this floor establishes necessary actor presence, not identity pairing.

### Minimum contrasts

1. Source `I have not adopted the proposal or arranged a meeting`; candidate preserves Ada in both actions → pass floor.
2. Ada preserved only for adoption; meeting passive → fail arrangement obligation.
3. Ada preserved only for meeting; plan passive → fail adoption obligation.
4. Ada named as proposer or outer source, both negatives passive → fail both.
5. Source itself says `No meeting has been arranged`; same unassigned answer → defer, while a separate personal adoption still requires its actor.
6. Source `Bo has not adopted it; Ada has not arranged a meeting`; a candidate assigning both to Ada → floor may pass presence but semantic verifier must reject identity.
7. Positive adoption/arrangement and unrelated negative actions do not activate.
8. Generated retention and answer paths reject the same omission; provided retention remains unchanged.

## 2. Separate epistemic subjects in open questions

The source can establish two different propositions:

- a speaker has no answer/does not know;
- a note or record establishes neither alternative.

Add a short shared composition/comparison rule:

> Keep each epistemic predicate attached to its stated subject. “Ada has no answer” is Ada's knowledge state. “The note establishes neither inclusion nor exclusion” is a property of the note's evidentiary content. Neither licenses “the agreement terms establish neither,” and one subject cannot silently replace the other.

Generation should compose them as separate clauses when both are selected. The verifier should compare the subject and object of each negative epistemic clause before its booleans. Existing document-scope protections remain intact.

Necessary contrasts:

- `Ada has no answer, and the note establishes neither inclusion nor exclusion` → supported when both source clauses exist.
- `Neither inclusion nor exclusion is established` → may be a faithful neutral compression only if it does not introduce agreement/document means or erase a material explicitly selected subject; full verifier decides.
- `The agreement terms establish neither` → reject unless source explicitly says that.
- `Ada establishes neither` or `the note has no answer` → reject subject swap.
- A source containing only personal uncertainty must not support a new record/document non-establishment claim, and vice versa.

This is a prompt/comparison correction, not a new deterministic English/Russian parser. It should not relax the built-question hold if the draft really changes the epistemic subject.

## 3. Lowercase Latin hyphenated terms in Russian output

### Do not add the proposed blanket floor

A deterministic rule rejecting every unquoted lowercase Latin hyphenated token in Russian prose is too broad. Valid outputs can contain real lowercase identifiers, package names, command names, protocol terms, or established borrowed technical labels such as `node-fetch`, `e-ink`, or source-defined tokens. The current evidence does not provide a reliable syntactic distinction between an untranslated ordinary compound (`axle-cap`) and those valid forms.

Source occurrence is also insufficient authority: the untranslated `axle-cap` occurs exactly in the English source. Automatically treating every exact source token as an identifier would recreate the V51 failure by exempting it.

### Smaller defensible change

Strengthen both generation and the existing language-check instruction:

> A lowercase Latin hyphenated technical-looking token is not an identifier merely because it is hyphenated or appears in source text. In Russian prose, translate ordinary component/content words. Preserve it only when supplied references or source syntax establish it as a name, identifier, path, command, code, or exact quotation.

Within the **same existing language-check call**, optionally supply a derived `review_tokens` list of unquoted lowercase Latin hyphenated tokens found in generated Russian excerpts. These are attention hints, not exemptions or evidence. The boolean checker must still inspect all prose and decide whether each token is ordinary untranslated language or a legitimate protected form. This adds no pass and does not override a false verdict.

If changing the checker payload is undesirable, the instruction alone is safer than a false-hold-prone runtime regex. A deterministic floor becomes defensible only if the system has typed source-backed identity/code metadata for that exact token. Current `LanguageReference` values are spelling hints and are deliberately not exhaustive proof, so absence from them cannot by itself mean “ordinary word.”

Minimum tests using the real language checker boundary:

- Russian prose containing ordinary `axle-cap` as an unquoted component → checker false.
- Russian translation `колпачок оси` → true.
- Exact quoted `"axle-cap"` and fenced/backticked code → allowed only under existing quotation/code rules.
- Source-backed typed identifier/reference `node-fetch` or an invented lowercase product token → allowed, with surrounding Russian still checked.
- Unreferenced lowercase token merely copied from English source → not automatically exempt.
- A protected identifier plus a longer untranslated English noun phrase → false; the reference exempts only itself.
- English target language remains unaffected.

## 4. Original frame versus retained wording

V51's hypothesis false hold shows the verifier can privilege retained `considers` over original `допускаю` even when the bound frame supports `introduced/posited as a hypothesis`. Do not respond by broadly declaring frame wording superior or all framing verbs equivalent.

The smallest clarification is:

> The retained excerpt selects the proposition; the bound original frame controls its source meaning and can establish an equivalent source-language framing. Reject only a concrete changed act. Do not infer a mismatch solely because the retained paraphrase uses a different faithful verb.

Add a positive source-bound pair for `допускаю правило` → `posited/introduced a hypothetical rule`, and negatives for `enacted/adopted the rule` or `completed discussion`. Require the comparison to identify the actual changed act before rejecting. Keep excerpt selection, all three booleans, and no-retry behavior unchanged.

## Recommended order

Implement the two-action agency floor and epistemic-subject contract first; both directly cover repeated source-role losses. Add the language-check instruction/hints without a deterministic Latin-token rejection. Treat the original-frame clarification as a narrow verifier calibration with explicit positive and negative cases, not a general authority change.

The design should preserve the current coverage-role guard, coupled hypothetical consequence, fiction scope, unknown-clock floor, strict verifier JSON, multi-span audit, and source-only evidence boundary.
