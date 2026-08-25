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
| Ask what happened in a period      | `timeline` | Authored events and typed dated-document evidence         |
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

```text
query
  ├─ optional expansion
  ├─ lexical candidates
  ├─ optional semantic candidates
  └─ exact entities + bounded graph candidates
          ↓
      rank fusion
          ↓
  optional rerank + irrelevance qualification
          ↓
  page/document assembly under one budget
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
akno timeline --source document
```

Timeline combines authored events with typed date evidence from documents. A dated orphan document can appear
without being converted into an event or canonical page. Owned documents remain grouped under their pages.
File-created or file-modified metadata is used only when no supported date can be extracted, and it is labelled
as metadata rather than authored fact.

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

`empty` is a normal “inject nothing” result. The host should call the profile at most once per turn, place
non-empty evidence inside a clearly delimited untrusted-memory section, and never persist the returned bundle as
new memory.
