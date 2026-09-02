# Reading memory

Akno separates evidence discovery, direct answering, exact reads, relationship inspection, time-based lookup,
and automatic host context. The split keeps fast or inspectable operations from silently becoming generative.

## Choose the right read operation

| Intent                             | Operation  | Output                                                    |
| ---------------------------------- | ---------- | --------------------------------------------------------- |
| Find evidence for a fuzzy query    | `recall`   | Ranked cited page and document cards                      |
| Ask for a direct grounded response | `answer`   | Verified answer blocks, citations, and related identities |
| Open a known page or document      | `read`     | Exact content, optionally a line range                    |
| Browse the taxonomy                | `list`     | Folders, filtered pages, or a tree                        |
| Inspect relationships              | `graph`    | Bounded exact evidence paths and locators, without bodies |
| Read history or actionable time    | `timeline` | Events, retained world time, and dated-document evidence  |
| Prepare one agent turn             | `context`  | A bounded bundle; `auto_recall` is precision-first        |

Do not call both `answer` and `recall` by default for one question: `answer` already retrieves. Call `recall`
separately when a person or agent also needs to inspect the evidence cards.

## Recall

```bash
akno recall "When does the Zephyr QX-100 warranty expire?"
akno recall "invoice" --type receipt
akno recall "policy wording" --include source --depth full
akno recall "warranty" --source document --ownership orphan
```

Recall runs a staged pipeline:

```mermaid
flowchart TD
  accTitle: Recall pipeline
  accDescr: A query gathers candidates through several optional and independent channels, fuses their ranks, optionally reranks and qualifies them, and assembles page and document evidence under one budget.

  query["Query"] --> expansion["Optional expansion"]
  query --> lexical["Lexical candidates"]
  query --> semantic["Optional semantic candidates"]
  query --> graph["Exact entities and bounded graph candidates"]
  expansion --> fusion["Rank fusion"]
  lexical --> fusion
  semantic --> fusion
  graph --> fusion
  fusion --> rerank["Optional rerank and irrelevance qualification"]
  rerank --> assembly["Page and document assembly under one budget"]
```

The search arms use incompatible score scales, so Akno fuses ranks instead of comparing raw BM25, cosine,
graph, or reranker values.

Recall chooses or accepts one mode:

| Mode       | Best for                                       | Behavior                                            |
| ---------- | ---------------------------------------------- | --------------------------------------------------- |
| `lookup`   | A subject or phrase                            | Add synonyms and word forms                         |
| `question` | A question whose answer uses different wording | Search the original plus a hypothetical answer form |
| `explore`  | Broad discovery                                | Favor coverage and summaries                        |

A result card reports role, relevance, contributing candidate arms, cited excerpts, and approximate budget.
Question mode also reports concept coverage. A relevant page that does not cover one requested attribute is not
evidence for that part of the answer.

When a returned line is an Akno-managed level-one memory, it also carries `memory` qualification: kind,
attribution, commitment, disposition, polarity, epistemic basis, and `answer_eligible`. Reports, hypotheses,
counterfactuals, proposals, rejected decisions, plans, and questions remain searchable and readable with that
status. They are not silently converted into ordinary current facts. Authored prose has no `memory` field;
managed canonical claims and accepted decisions report `answer_eligible: true`.
Time-scoped items also report their stored temporal envelope, a read-time `clock_relation`, whether they are
actionable, and `current_eligible`. A past validity interval may remain valid historical evidence while being
ineligible for a question about what is current.
An owned marker whose current semantics cannot be parsed reports `status: "unavailable"` and
`answer_eligible: false`; malformed or unmigrated managed memory never falls back to authored-fact behavior.

An eligible level-two payload carries a separate `observation` qualification with its stable id, exact subject,
disposition, proof count, and every current leaf fact locator. It is labeled as derived in recall. Ordinary
factual queries rank an observation-backed card below direct evidence; pattern, habit, recurrence, and tendency
queries may promote it. Malformed markers and blocks whose facts, hashes, proof groups, subject, or placement
authority no longer qualify remain readable with `status: "ineligible"`, but are excluded from factual recall,
automatic context, and graph traversal.

### Reranking also qualifies

A successful reranker may remove judged-irrelevant candidates. Candidates outside its bounded window are
unjudged and are not used to fill holes the model never approved. If every judged candidate is rejected,
recall returns honest `empty`.

If reranking fails or returns an invalid structured response, Akno preserves fusion order and reports typed
degradation. It never applies an irrelevance filter from an unvalidated result.

## Grounded answers

```bash
akno answer "How long is the Zephyr QX-100 warranty?"
akno answer "How long is the Zephyr QX-100 warranty?" --context
akno answer "How long is the Zephyr QX-100 warranty?" --rerank
```

`answer` uses question-oriented recall, then asks the answer role for structured cited blocks. Akno validates
the opaque evidence labels, checks introduced numbers and negation against cited text, and renders persistent
locators itself. A separate verifier call judges each answer block only against its nested evidence.

Unsupported blocks are withheld. A missing model produces `degraded/not_answered`; complete empty recall
produces `empty/not_found`. If equally applicable evidence gives incompatible values without an authority rule,
Akno abstains rather than choosing one or inventing a conflict explanation.

By default, lines whose managed-memory qualification says `answer_eligible: false` are removed before evidence
is shown to the answer model. If they are the only related memory, `answer` returns `not_answered` while
preserving the related page identities; it does not call the model or claim the topic was never discussed.
Accepted or active plans remain non-factual, but may ground an explicitly future-oriented question. For
time-scoped factual items, current-value questions admit only intervals that are current at the reader clock.

An observation is offered to the answer model as one indivisible evidence item containing its readable L2
sentence and every current L1 leaf line. If any leaf cannot be re-read at its sealed fact, slug, line, and hash,
the whole observation is withheld. A final observation citation expands back to every leaf source; the L2 page
alone is never presented as sufficient proof.

Reranking is off by default for `answer` because generation and verification already select supporting
evidence. `--rerank` opts into another sequential model call for especially noisy corpora or weaker answer
models. `--context` returns the exact bounded evidence shown to the model for a review interface.

## Exact reads and browsing

```bash
akno read products/zephyr-qx-100
akno read products/zephyr-qx-100 --from 10 --to 20
akno read --document doc_a1b2c3d4

akno list --kind tree --depth 2
akno list --kind pages --folder products
```

`read` does no ranking. It can return a source page in full even though ordinary recall quotes it narrowly. A
document read reports whether the original, an indexed extraction, or only identity metadata is available.

Use `list` before writing when the existing taxonomy or nearby page names matter.

## Graph inspection

```bash
akno graph --slug people/ada-marlow --hops 2
akno graph --query "Zephyr QX-100 warranty" --relation related_entity
akno graph --entity ent_01JEXAMPLE --direction out --history
```

`graph` is not fuzzy search and does not answer questions. A slug or entity id gives an exact seed; a query
extracts only declared exact names. Ambiguity stops traversal unless the optional contextual resolver already
made a strongly supported select-or-abstain decision.

Traversal is bounded to three hops and 100 returned paths, with separate fan-out limits. Reaching a bound marks
the result degraded so a partial graph never looks like proof that no other path exists. Paths contain compact
node and relation identities plus source locators, not copied page claims. Follow the locator with `read`.

## Timeline

```bash
akno timeline --since 2031-01 --until 2031-06
akno timeline --match warranty
akno timeline --subject people/ada-marlow
akno timeline --scope today --timezone Europe/Amsterdam
akno timeline --view actionable --order nearest
akno timeline --source deadline --clock overdue
akno timeline --as-of 2031-04-12T10:00:00+02:00 --timezone Europe/Amsterdam
akno timeline --source document
```

Timeline combines three sources without collapsing their meanings:

- authored dated lines remain `event` results;
- typed retained time becomes `event`, `state`, `plan`, or `deadline` according to its relation;
- a dated orphan document remains `document_evidence`, never an event or canonical claim.

The default `history` view keeps inactive, rejected, completed, and cancelled records visible. The
`actionable` view admits only active or accepted scheduled work and deadlines; it is a query, not a reminder or
scheduler. Filter further with `--status`, `--disposition`, `--source`, an exact `--clock` relation, or the broad
`--scope past|today|future|all`. `--source both` remains a compatibility alias for `all`.

Every result is classified at read time as `past`, `today`, `current_period`, `ongoing`, `future`, `overdue`, or
`undated`. The response includes the exact `as_of`, IANA timezone, local date, and grouped counts, so a caller can
repeat the same query deterministically. Month and year precision remain partial periods; Akno does not invent a
day. Open validity intervals may be ongoing. Only an active or accepted due item can be overdue.

`--since` and `--until` use inclusive overlap semantics. Recurrence expands only when both bounds define a
closed range and is bounded; an unbounded query returns only the stored anchor. A half-bounded range also
returns the anchor when it overlaps, but reports degradation because later matching occurrences cannot be
enumerated authoritatively. An instant recurrence needs an IANA timezone because a numeric offset cannot
describe later daylight-saving transitions. If expansion or the retained temporal projection is incomplete,
the result is `degraded` rather than falsely authoritative.

Owned documents remain grouped under their pages. For orphan evidence, file-created or file-modified metadata
is used only when no supported date can be extracted, and is labelled as metadata rather than authored fact.

## Context for a deliberate agent turn

```bash
akno context "The Zephyr QX-100 needs service again" \
  --budget 8000 --pin products/zephyr-qx-100
```

The default context profile fits explicit pins, recent time evidence, a structure outline, and recall into one
shared budget. It avoids four individually reasonable calls overflowing the host model when combined.

## Automatic context for an agent host

A host that checks memory before every substantive turn should use the precision-first profile:

```ts
const bundle = await memory.context({
  profile: 'auto_recall',
  query: currentUserPrompt,
  conversation_context: recentTurns,
  budget: 1200,
});
```

`auto_recall` is evidence preparation, not another answering model. It omits ambient pins, timelines, folder
outlines, and generated summaries. Exact page lines and document quotations keep their locators.

A strong exact or semantic match can activate directly; borderline candidates need qualification. Exact
evidence excludes semantic near-duplicates. Attribute questions require evidence for the attribute, not merely
the entity name. Conflicting values cause abstention. Recent conversation can resolve a narrow local reference
but cannot make unrelated memory relevant.

Temporal qualification is applied before automatic activation. Current prompts cannot activate expired valid
states; future prompts may activate asserted, active or accepted plans, while generic factual prompts cannot
turn planned or scheduled memory into current fact.

`empty` is a normal “inject nothing” result. The host should call the profile at most once per turn, place
non-empty evidence inside a clearly delimited untrusted-memory section, and never persist the returned bundle as
new memory.
