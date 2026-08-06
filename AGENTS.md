# Working on Akno

Guidance for anyone — human or agent — writing code in this repo. Project setup and
architecture live in [CONTRIBUTING.md](CONTRIBUTING.md); this file holds the rules that are easy to break
without noticing.

---

## Never use real data in tests, fixtures, docs, or comments

**Every name, number, address, filename and body of text in this repository must be invented.**

Akno is developed by pointing it at a real knowledge base. That is the only honest way to build it — a
synthetic corpus would have hidden most of the bugs found so far. But it creates a specific hazard: the fastest
way to write a regression test is to paste in the case you just watched fail, and that case is somebody's
private notes.

It has already happened in this repo. Confidence-scoring tests were built from lines read straight out of the
development knowledge base, and a real person's name reached a test fixture. It was caught and the history was
rewritten, which is a cost that gets paid every time.

### The rule

Forbidden in any tracked file, including test fixtures, doc examples, code comments, commit messages and
benchmark inputs:

- Names of real people or organisations — including the developer's own family, landlord, employer, doctor,
  bank, insurer, or landlord's lawyer.
- Real addresses, phone numbers, emails, account numbers, passport or ID numbers, policy numbers.
- Real monetary amounts from someone's actual records — a rent, a premium, a salary, a bill total.
- Real place names tied to a person's movements: where they live, where they travelled, on which dates.
- Verbatim text lifted from a real note, contract, letter, email or legal document.
- Real product model numbers taken from someone's possessions.

Note what is *not* on that list: `documents/car-insurance-2026`, "renewal date", "lease" — the *shapes* of a
personal knowledge base. Those are the point of the project and must stay. What has to be invented is the
**content**.

### How to write a fixture from a real failure

When something breaks on a real page, the reproduction is almost never the specific words. It is the
*structure* — a bold-key line, a table row, a hedge word, a line longer than the cap. Extract the structure and
rebuild it from invented parts:

Wrong: paste the line as it appeared, so the fixture is a bold-key frontmatter field from a real identity
document with that person's real value in it. The test passes and the repository now carries the value.

Right: keep only the properties the bug depends on — a bullet, a bold key, a colon, a short value, and a claim
that is one word — and supply all four from nothing:

```ts
scoreConfidence('- **Warranty:** five years', 'Warranty');
```

Note that this example cannot show you the wrong version, because writing it down here would be the leak. That
is the general shape of the problem: the bad fixture is always the one that is easiest to demonstrate.

A comment naming the real case leaks too. Describe the *shape* — "a bold-key line", not "the passport page".

### The shared vocabulary

Use these across the repo so a reader can tell at a glance that a fixture is invented, and so grepping for a
real name never returns a false positive:

| For | Use |
|---|---|
| A person | `Ada Marlow` (`people/ada-marlow`), `Bo Winters` |
| A company | `Vulpine Mutual` |
| A product | `Zephyr QX-100` |
| Money | `1111 EUR`, `2222 EUR`, `€33/month` — obviously placeholder |
| A place | `Blackwater Bay` |

Repeated digits are chosen on purpose. A number like `1111` announces itself as a placeholder; a plausible,
irregular figure does not, and a reviewer has no way to tell it apart from a real amount someone actually pays.

### Before committing

```bash
git diff --cached | grep -nEi '<names of the people in your life>'
```

Worth keeping a personal grep list outside the repo. `config/local.jsonc` is gitignored and holds your real
`akno_path` and folder rules — check that a folder name from it has not travelled into a test.

If real data does reach a commit, it must be removed from **history**, not just from the tip: rewrite with
`git filter-branch` or `git-filter-repo`, expire the reflog, and `git gc --prune=now`. If the branch was
already pushed, treat it as disclosed — the data has to be considered public, and rotating anything secret
matters more than the rewrite.

---

## Other things that are easy to get wrong

These are covered in [CONTRIBUTING.md](CONTRIBUTING.md) under "Things that are load-bearing", and are repeated here because they
are the ones that have actually broken:

- **Never mix score scales in one array.** bm25, cosine, reciprocal rank and cross-encoder logits are four
  different units. Fuse by rank; normalise before comparing. A reranker whose logits were compared against
  fusion scores ran, cost its latency, and changed nothing.
- **Degradation must be reported as a typed value**, not inferred from an error message. Producing a
  `DegradedReason` at the source is why there is no longer a layer matching `includes('rerank')` against its own
  strings.
- **Absence has three answers.** `empty`, `degraded` and `unavailable` are different results and must never be
  collapsed — an agent uses the distinction to decide whether it may say "not recorded".
- **The knowledge base is the user's.** With `write_ids: false` Akno must leave every file byte-identical, and
  a test asserts it.
- **A comment should say why**, especially where the obvious implementation is wrong. `git blame` covers what
  changed.
