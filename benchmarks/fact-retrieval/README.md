# Fact retrieval prototype benchmark

A development comparison of three ways to return memory to an agent:

| System        | What the agent receives                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `cards`       | Recall as it ships: page and document cards with a forward line window from each chunk's start |
| `cards+facts` | The same cards, but each card shows the lines whose derived facts matched the query first      |
| `facts`       | `format: "facts"`: ranked live facts with `slug:line`, then cited lines for evidence with none |

Run it from a checkout. It creates and removes a temporary knowledge base containing only invented sources and
never opens the configured one.

```bash
node scripts/bench-fact-retrieval.ts --layout both --extraction both --profile arms \
  --env-file <file holding AKNO_OPENAI_API_KEY> --output /tmp/fact-bench.json
```

## Corpus and layouts

`invented-ranking-v5`, development split only: 60 cases, each with at least one grade-3 direct answer. The
held-out split is never read. The same 120 invented sentences are written two ways:

- `separate` — one sentence per file, exactly as the ranking end-to-end track writes them. Direct answers are
  orphan documents there, and documents are never fact-mined, so this layout checks that fact features do not
  cost evidence that has no facts.
- `packed` — the sentences as bullets on five subject pages, one `##` section per fact family plus
  same-subject distractors, in a fixed shuffled order. 21 of 27 chunks hold more than three citable lines,
  which is the shape where a forward window hides the matching line. (A real base measured on 2026-10-26 had
  about a third of its chunks over three lines, so `packed` is harsher than typical.)

## Measures

- **Direct answer visible** — a grade-3 sentence's own line (or a document quote containing it) is in the
  output. Returning the right page without showing that line does not count.
- **Gold source returned** — the page or document holding a direct answer came back at all.
- **Stale claim visible** — a superseded or wrong-scope grade-0 sentence from the same family is in the output.
- **Tokens** — `ceil(chars / 4)` of the output as Luna's memory tool passes it today (pretty JSON), and of
  the `text` rendering for `facts`.

Models: `text-embedding-qwen3-embedding-0.6b` (1024 dimensions, local) for embeddings; `gpt-6-luna` for
derivation, expansion and the `decisions` reranker. The `arms` profile turns expansion and reranking off;
`production` turns both on as the deployed service runs them.

## Results (arms profile, 2026-10-26)

Facts with `index.fact_extraction: "complete"`, and the default `recall.fact_ranking: "none"`:

| Layout   | Measure               | `cards` | `cards+facts` | `facts` |
| -------- | --------------------- | ------: | ------------: | ------: |
| packed   | Direct answer visible |     48% |           73% |     73% |
| packed   | Stale claim visible   |     97% |           65% |     90% |
| packed   | Median tokens         |   5,171 |         5,193 |     605 |
| separate | Direct answer visible |     95% |           95% |     95% |
| separate | Median tokens         |   3,250 |         3,274 |     840 |

With the deriver's default precise prompt, packed direct-answer visibility reaches only 62%: it derived a fact
for 9–10 of the 15 evaluated direct answers, against 11 of 15 with `complete`. Stale sentences that became
facts kept their qualifier ("superseded", "obsolete draft") in 7 of 7 cases.

## Results (production profile, 2026-10-26)

Expansion and the `decisions` reranker on, complete extraction, `fact_ranking: "none"`:

| Layout   | Measure               | `cards` | `cards+facts` | `facts` |
| -------- | --------------------- | ------: | ------------: | ------: |
| packed   | Direct answer visible |     47% |           73% |     73% |
| packed   | Stale claim visible   |     68% |           52% |     93% |
| packed   | Median tokens         |   2,359 |         2,367 |     319 |
| separate | Direct answer visible |    100% |          100% |    100% |
| separate | Median tokens         |   3,004 |         2,884 |     266 |
| both     | Latency p50           |  ~1.9 s |        ~1.9 s |  ~1.9 s |

The fact arm adds no measurable latency; expansion and reranking dominate. Two caveats: `facts` lists every
fact before any evidence line, so a direct answer held in a document is never first (0% at position one on
`separate`, against 38% for cards); and complete extraction turns stale sentences into facts, which the fact
list then shows with their qualifier rather than leaving out.

### What did not work

Two ranking designs were measured first and rejected because both cost evidence that has no facts:

| Design (packed / separate direct visible)                | complete extraction |
| -------------------------------------------------------- | ------------------: |
| Facts as a fourth fused arm                              |           73% / 78% |
| Facts merged into each arm by best rank (`fact_ranking`) |           73% / 88% |
| Facts only target lines (default)                        |           73% / 95% |

Any scheme that ranks fact-bearing chunks higher ranks documents and source pages lower, because they never
carry facts. Until source evidence has facts of its own, facts should choose lines, not rankings.

### The control

`recall.line_targeting: "lexical"` shows the lines sharing the most query terms first, with no model and no
facts. On `packed` it lifts plain cards from 48% to 68% and cuts stale-claim exposure from 97% to 48%. Most of
the visibility gain therefore comes from showing the right line, not from facts as such; complete facts add
about five points on top. What facts add that line selection cannot is size: the fact list carries the same
answers in roughly a tenth of the tokens.

## Artifacts

Content-safe reports (invented case ids, flags, counts, token estimates, latencies) are in `results/`:

- `development-arms-2026-10-26.json` — both layouts and extraction modes, `arms` profile
- `development-arms-lexical-control-2026-10-26.json` — `packed`, `recall.line_targeting: "lexical"`
- `development-production-complete-2026-10-26.json` — both layouts, complete extraction, `production` profile

The rejected ranking designs were measured during development; the extra-arm variant no longer exists in code,
and `best_rank` can be rerun with `--fact-ranking best_rank`.

## Status

A prototype, not release evidence. One run per configuration, a small invented corpus, and nondeterministic
derivation: fact counts moved by a few between identical index passes.
