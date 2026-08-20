# examples/demo-brain

A small invented knowledge base, so a first run has something to index. Eleven pages, an event ledger, one
folder of quotable source material, and an `akno.json` that declares what belongs where.

Every name, number, address and body of text in it is made up — see
[AGENTS.md](../AGENTS.md#never-use-real-data-in-tests-fixtures-docs-or-comments) for why that rule is
absolute here. The _shapes_ are real, though, and they are the point: a superseded premium, a value stated on
two pages, a source page that may be quoted but never written to, dated lines on the page they belong to
rather than only in the ledger.

There is no `inbox/` in the folder. Akno creates one when `create_reserved_paths` is on, which is a better
demonstration than a checked-in empty directory.

## Trying it

**Copy it first.** Akno writes: `remember` files new claims, the maintenance cycle adds pages under
`observations/`, and `ingest` renames what it files. Pointed at the copy in this repo it would show up as a
dirty git tree.

```bash
cp -R examples/demo-brain ~/akno-demo
export AKNO_STATE_DIR=~/akno-demo-state
akno --akno-path ~/akno-demo index
akno --akno-path ~/akno-demo doctor
akno --akno-path ~/akno-demo recall "what does the car insurance cost per month?"
```

`index` comes before `doctor`: most of what `doctor` reports is counted out of the index, so it
needs one to exist.

With no models configured this still works — you get lexical search, no summaries and no facts. `akno
doctor` reports which roles resolved and what each missing one costs.

Things worth trying once it is indexed:

| Try                                                 | What it shows                                            |
| --------------------------------------------------- | -------------------------------------------------------- |
| `recall "who services the boiler?" --mode question` | Coverage: which parts of the question the results answer |
| `recall "what did the letting agent say?"`          | A `source` page quoted, with line addresses              |
| `timeline`                                          | Dated lines from every page, not only the ledger         |
| `read people/ada-marlow`                            | One page in full, with its backlinks                     |
| `rules household/boiler.md`                         | Which rule governs a path, and why                       |
| `list --kind tree`                                  | The folder taxonomy as Akno understands it             |
| `context "who pays for the boiler service?"`        | The whole pre-turn bundle against one token budget       |
| `dream --dry-run`                                   | What the nightly cycle would do, without doing it        |

### Watching a value get superseded

This one takes two steps, because supersession is something Akno _notices_ rather than something a
file can state. Edit the premium on `household/car-insurance.md`:

```diff
-- Premium: 44 EUR/month (raised at the 2031 renewal; was 33 EUR/month).
+- Premium: 66 EUR/month (raised at the 2032 renewal; was 44 EUR/month).
```

Re-index, and `recall "car insurance premium"` returns the old value labelled `superseded:` with the
date it stopped being true — beside the new one, not competing with it.

### Watching the write path

```bash
akno remember "The excess on the car insurance changed to 333 EUR at the 2032 renewal."
```

It appends to `household/car-insurance.md` with a stable item id and its provenance, and tells you
which page it chose and how confident it was. `akno undo --list` shows the change; `akno undo
<id>` puts the file back byte for byte.
