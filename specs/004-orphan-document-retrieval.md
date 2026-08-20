# Orphan-document retrieval

- **Status:** proposed
- **Depends on:** current document extraction and search index

## Problem

Akno extracts and indexes readable documents, but recall assembles page cards. A document with no owning page
can therefore match search internally and still have no result container. The current `adopt` phase creates a
minimal page to make that document reachable.

This makes organization a prerequisite for retrieval. It also creates unnecessary Markdown pages when a user
only needs to find a document, and makes a nightly write phase feel mandatory even though the information is
already indexed.

## Outcome

`recall` returns relevant orphan documents immediately. An owning page improves context, navigation, and filing,
but is not required for visibility. `adopt` remains available as an eager organization operation that makes
future recall and browsing faster and richer.

The product promise becomes:

> If Akno successfully extracted searchable text from a document, recall can return that document regardless
> of whether a knowledge page owns it.

## Result model

Recall results need a first-class document variant rather than a synthetic page hidden from the user:

```ts
type RecallResult = PageCard | DocumentCard;

interface DocumentCard {
  type: 'document';
  id: string;
  path: string;
  label: string;
  mime: string;
  summary?: string;
  quote?: string;
  parts?: DocumentPartRef[];
  source: DocumentSource;
  ownership: {
    status: 'orphan';
    suggestedPage?: { slug: string; title: string; confidence: number };
  };
  score: NormalizedRecallScore;
}
```

`PageCard` remains the preferred result when a matched document already belongs to a page. Akno must not
return the same evidence twice as both a page card and a standalone document card.

Every client surface can tell result variants apart through `type`. The text rendering labels standalone
results as documents and explains that they are not yet filed; it does not invent a page title or slug.

## Retrieval pipeline

Document chunks already participate in lexical and, when configured, vector search. The recall pipeline should:

1. retrieve and rank page and document candidates using their native indexed identities;
2. fuse result lists by rank without mixing BM25, cosine, or model score scales;
3. rerank candidate passages when a reranker is configured;
4. group owned document hits beneath their page;
5. group orphan document parts by document id into a `DocumentCard`;
6. deduplicate page and document evidence;
7. fit both result types into the shared output budget.

Standalone document results compete for the same recall budget as page cards. A configuration limit may prevent
them from crowding out authored pages, but the default must allow at least one high-ranking orphan result.

When optional vector search or reranking is unavailable, lexical document recall remains functional and the
response reports the typed degradation just as page recall does.

## Filtering and modes

Existing filters apply consistently:

- folder/path filters match the document's relative path;
- page-role filters exclude orphans because they have no page role;
- an explicit `ownership: orphan|owned|any` filter controls ownership;
- time filters use indexed document dates and clearly distinguish file metadata from dates extracted from text;
- source filters can select `page`, `document`, or both.

Default recall uses `ownership: any` and `source: both`. A user should not need to know the document is orphaned
before they can find it.

`lookup` mode may favor an exact filename or exact extracted field. `question` mode favors passages that answer
the query. `explore` mode may return a broader mix. None of these modes silently excludes orphan documents.

## Citations and reading

A document card cites the original relative path, extraction source, page or part number when available, and a
bounded quote. If text came from OCR or a vision description, the result says so. A model-generated description
is not presented as verbatim document text.

`read` already accepts an exact document identity. Recall must return enough stable identity for a client to
call `read` without first adopting the document.

If the original file is unavailable but a configured rendition remains, the result is `degraded`, not empty.
If neither source nor rendition can be read, it is `unavailable`. These states must not be collapsed.

## The new role of `adopt`

Adoption becomes optional organization:

- create a durable page with a human-readable title and document embed;
- place it according to folder rules;
- attach page role and management policy;
- make the item browsable through page lists and navigable from other pages;
- provide a home for later synthesis or authored notes.

Adoption may improve recall latency by avoiding a separate result path, but recall correctness cannot depend on
it. Running `adopt` is an optimization and filing shortcut, not a repair for missing search results.

Adoption uses the maintenance plan lifecycle. In audit or review mode it proposes exact new pages. In automatic
mode a policy may authorize clear, collision-free cases. A collision, ambiguous destination, or folder boundary
creates a review item and never hides the original document result.

## Index and schema changes

The search layer needs a ranked candidate identity that can represent `page` or `document` before assembly. The
public recall schema then returns a discriminated union.

Compatibility options:

- bump the operation schema version and return `results: RecallResult[]`; or
- retain `cards` as the field name while allowing both variants and adding `type` to page cards.

The second option is less disruptive but must not leave older clients assuming every result has a page slug.
The client package should provide type guards and a legacy adapter that drops document cards only when an older
host explicitly requests it.

Document ranking metadata belongs in the index/store. No hidden Markdown page should be created merely to fit
the result schema.

## Acceptance criteria

- An indexed readable document with `page_id = null` is returned for a matching lexical query.
- The same document can be read using the stable identity returned by recall.
- An owned document hit appears under its page and is not duplicated as a document card.
- Results clearly identify original text, OCR text, and model descriptions.
- Page-role filtering has documented behavior for orphan documents.
- Exact filename lookup can find an orphan without model capabilities.
- Recall reports `empty`, `degraded`, and `unavailable` document states distinctly.
- Disabling `adopt` does not reduce which extracted documents are discoverable.
- Adopting a document changes its presentation/organization but preserves its recall evidence.
- A collision in adoption produces a plan item and leaves the orphan retrievable.

## Benchmark and migration

Add a benchmark corpus with invented page-owned and orphan documents, including Ada Marlow, Vulpine Mutual,
the Zephyr QX-100, and Blackwater Bay. Measure:

- recall of orphan evidence at `k`;
- duplicate result rate;
- change in page-result recall after mixed assembly;
- assembly and budget-fitting latency;
- lexical-only behavior and degraded model paths.

During migration, reindexing should be sufficient. Existing adopted pages remain ordinary pages; Akno does not
remove them or attempt to infer that they were machine-created unless durable metadata already proves it.

## Non-goals

- Replacing good knowledge pages with a flat document search interface.
- Automatically moving source files as part of recall.
- Treating a model summary as the only citation for a document.
- Creating ephemeral Markdown pages behind the user's back.

## Open questions

- Should mixed result limits reserve capacity for both pages and documents, or rely entirely on ranking?
- Should a document suggested for adoption expose an `adopt` action directly in recall responses?
- How should timeline represent a dated orphan before it has a page role or authored event semantics?
