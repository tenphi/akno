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

Note what is _not_ on that list: `documents/car-insurance-2026`, "renewal date", "lease" — the _shapes_ of a
personal knowledge base. Those are the point of the project and must stay. What has to be invented is the
**content**.

### How to write a fixture from a real failure

When something breaks on a real page, the reproduction is almost never the specific words. It is the
_structure_ — a bold-key line, a table row, a hedge word, a line longer than the cap. Extract the structure and
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

A comment naming the real case leaks too. Describe the _shape_ — "a bold-key line", not "the passport page".

### The shared vocabulary

Use these across the repo so a reader can tell at a glance that a fixture is invented, and so grepping for a
real name never returns a false positive:

| For       | Use                                                         |
| --------- | ----------------------------------------------------------- |
| A person  | `Ada Marlow` (`people/ada-marlow`), `Bo Winters`            |
| A company | `Vulpine Mutual`                                            |
| A product | `Zephyr QX-100`                                             |
| Money     | `1111 EUR`, `2222 EUR`, `€33/month` — obviously placeholder |
| A place   | `Blackwater Bay`                                            |

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
- **The knowledge base is the user's.** With the defaults, an index pass must leave the _set_ of files and every
  file's bytes unchanged, and a test asserts it by hashing the whole tree either side of a pass. A setting may
  add a file — `write_ids`, `ingest.text_rendition` — but only one the user turned on, and never by default.
- **A comment should say why**, especially where the obvious implementation is wrong. `git blame` covers what
  changed.

---

## Applying a change — one command

```bash
pnpm akno redeploy            # build, restart the service, wait for its socket
pnpm akno redeploy --no-build # restart only
pnpm akno redeploy --no-restart # build only, for a checkout with no service
```

`pnpm akno` rather than `akno`: the binary is only on `PATH` once the package is installed, and
in a checkout it is `node packages/cli/src/bin.ts`, which that script wraps. The rest of this repo's
docs write `akno <cmd>` because that is the installed UX.

**Run it when you are done.** An agent working in this repo may redeploy on its own once the change
is finished and verified — typecheck, lint and the suite green. It is not a destructive action: the
service is `KeepAlive`, the index is derived and rebuilt from the Markdown, and the knowledge base is
not touched. What is destructive is _not_ doing it, because then the thing being tested is the code
that was already running.

**Both steps matter, and the build is not optional for the service.** This is the trap:

- launchd runs `packages/cli/src/bin.ts` directly and Node strips the types, so the CLI's _own_
  files are live at the next start. **`packages/core` is not one of them.** `serve-cmd.ts` imports
  `@tenphi/akno-core`, whose `exports` field points at `dist/index.js` — check it yourself with
  `node -e "console.log(require.resolve('@tenphi/akno-core'))"` from a CLI file. So an edit under
  `packages/core` is invisible to the running service until it is built, however many times the agent
  is restarted.
- A host importing `@tenphi/akno-client` imports `packages/*/dist` too. Skip the build and a host keeps
  calling the previous op registry: a newly added op is simply absent, and the failure reads
  `unknown op`, which looks like a wiring bug rather than a stale artifact.

So: build, then restart. Do one and not the other and half the system is on the old code.

**This paragraph used to say the service did not need the build, and that cost an afternoon.** A fix
to `models/client.ts` was committed, `launchctl kickstart` run, the identical failure reproduced —
and the conclusion drawn was that the fix was wrong, when it was merely not loaded. `pnpm build`
plus one more restart turned the same command from three warnings into none.

**A green suite is not evidence of a deployment.** `vitest` imports `./client.ts` — source, directly —
so the tests pass whether or not `dist` was ever rebuilt. The two facts a test cannot give you:

```bash
grep -c "<a token from your change>" packages/core/dist/<file>.js   # is it built?
ps -o lstart= -p "$(pgrep -f 'bin.ts serve' | head -1)"             # started after that build?
```

If you fixed a bug you could reproduce, **reproduce it again after redeploying.** That is the only
check that covers the whole path, and it is the one that catches this.

**`redeploy` waits for the socket, and that is not decoration.** `launchctl kickstart` returns when
launchd has spawned the process, not when it is listening — the socket is created last, after the
write lock, the store and the watcher. A command run immediately after a bare `kickstart` fails with
"no Akno service at …", which reads like a broken deploy rather than an impatient one.

A failed build restarts nothing, on purpose: restarting anyway puts the previous code back into
service and reports success.
