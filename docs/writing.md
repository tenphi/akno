# Writing and ingestion

Akno has separate operations for exact edits, retaining raw material, importing documents, correcting the
record, and applying maintenance plans. Choosing the narrowest operation keeps authority visible.

## Choose the right write operation

| Intent                                                      | Operation  |
| ----------------------------------------------------------- | ---------- |
| Put exact wording at an exact destination                   | `write`    |
| Hand over unstructured text and keep its durable claims     | `remember` |
| Retain identified source revisions with provided candidates | `retain`   |
| Declare what belongs in a folder                            | `folder`   |
| Import a file, folder, or URL                               | `ingest`   |
| Process configured drop folders                             | `inbox`    |
| Give an orphan document a page                              | `adopt`    |
| Retract a sentence or trash an object                       | `forget`   |
| Relocate a page and its documents                           | `move`     |
| Reverse a journalled change                                 | `undo`     |

If you know both wording and destination, use `write`. If Akno must decide what is durable and where it belongs,
use `remember`.

## Exact writes

`write` creates, appends, patches, or replaces one page. It can include tags, events, links, and document
attachments. A write into an undeclared gated folder returns `requires_folder` with nearby alternatives; it
does not silently invent taxonomy.

```bash
akno folder warranties \
  --description "Appliance and electronics warranties, with expiry dates."
```

Every accepted mutation records previous bytes and returns a change id. External edits remain valid: the
watcher re-indexes them like any Akno write.

Frontmatter is preserved byte-for-byte unless a complete frontmatter block is deliberately supplied in a
create or whole-content write. Append, patch, and replace-body operations do not reinterpret a pasted block as
page policy.

## Remember

```bash
akno remember "Ada Marlow confirmed that the Zephyr QX-100 warranty lasts five years."
akno remember "..." --dry-run
akno remember "The inspection is due tomorrow." \
  --mentioned-at 2031-03-04T10:00:00Z --timezone UTC
```

`remember` is for conversation excerpts, rough notes, or other raw material. It uses the current folder
taxonomy and explicitly admitted pages to decide whether the input should:

- update an existing canonical page;
- create a page in an existing or declared eligible folder;
- append a loose dated event; or
- remain a proposal because routing or confidence is insufficient.

Searchability is not write permission: an unmarked Markdown page defaults to `knowledge` for recall and to
`remember: deny` for injection. A page or folder must explicitly set `remember: integrate`; pages Akno creates
for retained memory carry that declaration themselves. When the strongest semantic match is read-only, Akno
does not silently use a weaker writable page. It creates a dedicated managed page in an admitted folder when
the retain result supplies one, uses `maintenance.retain.fallback_page` when that exact destination is configured
and admitted, or holds the claim for a destination decision. The fallback is tried only after ordinary routing
and managed-page creation; its config value never grants write authority. A missing fallback page may be created
only under an exact parent-folder rule that permits it, while an existing unindexed file is never overwritten.

The response makes that boundary machine-readable. Each `considered` claim reports `destination` as
`existing_admitted_page`, `new_managed_page`, `configured_fallback`, or `no_writable_destination`. When the
configured page was needed, top-level `fallback` reports whether it was `used` or `unavailable` with a stable
reason. The top-level
`no_writable_destination` outcome means at least one retained claim had no authorized home; its approval carries
the same stable `reason_code`, so an agent can ask for a destination without parsing explanatory prose. Ordinary
semantic ambiguity remains `requires_approval`, while an undeclared target folder remains `requires_folder`.
`--dry-run` computes these same destination and outcome classes without writing a page or creating a proposal.

It does not create pages in unexplained or read-only folders. `adopt` and immediate index reconciliation make
accepted memory visible without another manual step.

Relative dates are resolved only when the caller supplies the source's RFC 3339 `--mentioned-at` time. An IANA
`--timezone` supplies calendar context without licensing a location guess. When source time is absent, Akno does
not substitute its processing clock.

### Evidence and later maintenance

For each sentence extracted by `remember`, the model also identifies one bounded exact quote from the input.
Akno validates the quote before storing it privately alongside the managed-item id and keeps only a hash of the
complete input. The dream cycle can therefore re-check generated wording even when the page has no
`dream: hygiene` or `dream: synthesize` permission. A safe correction may change only that one generated payload
line and still passes the ordinary sealed plan and curator or human decision path. Older items and new items for
which no valid exact quote was returned remain readable but report `source_unavailable`; Akno will not guess a
semantic correction for them. Explicitly forgetting the fact or page retires its retained quote from active
verification; a complete maintenance scan also prunes quotes whose managed marker no longer exists.

The dream cycle can also correct where an injected fact lives. It uses ordinary retrieval to nominate a small
set of existing writable knowledge pages, then asks a separate classifier whether the current page is clearly
wrong. A move is accepted only to one supplied page and section. If no existing unique `##` section fits, the
only creatable option is a short plain heading derived deterministically from the fact's current attribute; the
classifier cannot supply its own wording. Akno moves the exact marker and sentence together, seals the change as
a medium-risk maintenance item when it creates a section or touches two pages, and writes or undoes both pages
atomically. It never creates a page or rewrites the fact during this operation; ambiguity becomes a held routing
finding.

Use `approve` or `decline` for held routing proposals. These are separate from maintenance-plan decisions,
which use `akno plan decide`.

## Retain identified sources

`retain` is the host-facing path when source identity must survive retries. It currently accepts JSON with
provided candidates, exact source spans, and exact destinations, or an explicit retraction:

```bash
akno retain request.json
akno retain request.json --dry-run
akno retain - < request.json
```

Assuming `memory/**` is admitted as `knowledge + remember: integrate`, this complete request creates a managed
page when needed and places the decision under its deterministic `## Unsorted` section:

```json
{
  "sources": [
    {
      "source_id": "conversation:1111",
      "revision": "1",
      "source_group": "conversation:1111",
      "source_kind": "conversation",
      "mentioned_at": "2031-03-04T10:00:00Z",
      "timezone": "UTC",
      "locator": "conversation:1111#turn-1",
      "input": {
        "items": [
          {
            "item_id": "turn-1",
            "role": "user",
            "speaker": "Ada Marlow",
            "mentioned_at": "2031-03-04T10:00:00Z",
            "text": "I selected the five-year warranty for the Zephyr QX-100."
          }
        ]
      },
      "retention": {
        "mode": "provided",
        "placement": "exact",
        "candidates": [
          {
            "candidate_id": "warranty-selection",
            "kind": "decision",
            "text": "Ada Marlow selected the five-year warranty for the Zephyr QX-100.",
            "subject": "Zephyr QX-100 warranty",
            "attribution": {
              "source_role": "user",
              "source_speaker": "Ada Marlow"
            },
            "discourse": {
              "commitment": "asserted",
              "disposition": "accepted"
            },
            "epistemic": {
              "basis": "self_attested"
            },
            "support": [
              {
                "item_id": "turn-1",
                "quote": "I selected the five-year warranty for the Zephyr QX-100."
              }
            ],
            "discourse_frame": [
              {
                "item_id": "turn-1",
                "quote": "I selected the five-year warranty for the Zephyr QX-100."
              }
            ],
            "time": {
              "start": "2031-03-04",
              "precision": "day",
              "relation": "occurred",
              "status": "actual",
              "timezone": "UTC",
              "mentioned_at": "2031-03-04T10:00:00Z"
            },
            "destination": {
              "slug": "memory/zephyr-qx-100-warranty"
            }
          }
        ]
      }
    }
  ]
}
```

The tuple `source_id + revision` is immutable. Repeating identical source metadata, bytes, and retention
instructions returns the stored result without another write; changing any of them under the same tuple returns
`revision_conflict`. Exact support and discourse-frame spans must resolve uniquely inside the supplied text or
structured source item. Every accepted source has at most one journal change, and one failed source does not
erase successful siblings. On an existing page, a named exact section must already exist exactly once; omission
uses the deterministic `## Unsorted` fallback. Reports, hypotheses, proposals, plans, questions, and rejected
options stay searchable with visible status but are excluded from ordinary derived facts.

A later revision never implies deletion. Retraction names the earlier `target_revision` and, optionally, exact
candidate ids. When another source still supports the same memory, Akno removes only the addressed support and
keeps the readable item. An explicit user `forget` also retires keyed support, so replaying an old source
revision cannot resurrect memory the user removed; undo restores both the Markdown and its support state.

## Brain migration

Owned Markdown grammar changes are explicit:

```bash
akno migrate --dry-run
akno migrate
```

The normal managed-memory parser reads only the current v2 grammar. The legacy decoder exists only in this
operator command. Migration rewrites strict owned blocks conservatively as attributed reports, holds malformed
or ambiguous blocks, journals the exact files, re-indexes changed paths, and can be reversed with `undo`.
Ordinary indexing never rewrites the knowledge base.

## Documents and ingestion

```bash
akno ingest /path/to/warranty.pdf
akno ingest /path/to/folder --limit 20
akno ingest https://example.com/invented-warranty.pdf
akno ingest /path/to/scan.pdf --folder warranties
```

Ingestion performs a guarded pipeline:

```text
extract or OCR
    ↓
is the content usable?
    ↓
name and summarize
    ↓
does naming clear its threshold?
    ↓
score eligible folders
    ↓
does routing clear its threshold?
    ↓
store, page, link, and index
```

It refuses three risky guesses:

- it does not rename a file whose existing name already carries intent;
- it does not name a file it could not read confidently;
- it does not file a document when no destination clears `route_threshold`.

Below a threshold, the original remains in place with a typed proposal. Ingesting identical bytes again is a
content-addressed no-op that reports the existing object.

On macOS, Akno uses PDFKit for text layers, Vision for OCR, and `textutil` for supported office formats. On
Linux, it uses Poppler for PDF text and page rasterization, Tesseract for scanned PDFs and images, and
LibreOffice for `.doc`, `.docx`, `.odt`, and `.rtf` files. Missing native tools produce an actionable degraded
result rather than failing ingestion. The vision model is reached only when an image has no readable text and
needs a visual description. Each indexed document records whether its content came from original text, OCR, or
a model description.

Document text is indexed as the document, with original page numbers where possible. It is not pasted into the
owning Markdown body. Optional text renditions let editors and command-line tools read extracted text beside the
file without creating duplicate search results.

## Inbox

An inbox is any folder rule with `route: true`; the folder name is not special.

```jsonc
{
  "folders": {
    "inbox/**": { "ingest": "auto", "route": true },
  },
}
```

```bash
akno inbox
```

A running service processes arrivals automatically. Above the threshold, the file and its generated page move
together. Below it, the file stays visibly in the inbox. This is the only workflow that automatically relocates
an existing user file; files manually placed elsewhere may be indexed but are not moved.

## Orphan documents and adoption

A readable document does not need a page before recall can find it. Orphan results include a stable id, relative
path, bounded quote, extraction method, availability, and page number where possible.

```bash
akno read --document doc_a1b2c3d4
akno adopt doc_a1b2c3d4
```

`adopt` is organization, not retrieval repair. It plans a minimal page from the existing indexed summary, seals
the source hashes, and uses the configured audit/review/auto policy. Apply confirms the document is still
readable and unowned, creates only the sealed page, re-indexes, and verifies ownership.

The nightly adopt phase is the bounded bulk form. A folder-level cap prevents hundreds of orphan files from
becoming hundreds of pages in one unattended run.

## Correcting and reversing changes

```bash
akno forget --slug products/zephyr-qx-100 --match "five years"
akno move products/zephyr-qx-100 products/zephyr-qx-100-warranty
akno undo <change-id>
akno undo --list
```

- `forget` removes the exact sentence that produced a fact or moves a page/document to recoverable trash.
- `move` relocates a page with its owned documents and reports inbound links rather than silently rewriting
  unrelated pages.
- `undo` restores journalled bytes and survives an index rebuild because the journal is durable state, not a
  search artifact. Before changing anything it verifies every affected path still matches the exact
  post-change state. A later edit, deletion, recreation, moved destination, source collision, or damaged trash
  snapshot returns a typed `conflict` with paths and reasons; the whole undo remains unapplied.

Akno's trash is recoverable within `trash_retention_days`. If an automated change is wrong, prefer its change
id and `undo` over manual reconstruction.

## Write safety

All normal writes share the same important boundaries:

- exactly one process holds the write handle;
- gated and plan-backed actions check current input bytes before mutation;
- file operations are journalled;
- affected paths are re-indexed after writes;
- maintenance items additionally verify their expected disk and index outcomes;
- no default index pass changes knowledge-base bytes.

For autonomous transformations and human review, continue with [The dream cycle](dream-cycle.md).
