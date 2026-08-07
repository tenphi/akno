/**
 * One SQLite file. Deleting it costs one re-index and no data — that
 * property is the design, and it is why nothing here is a source of truth.
 * Only the journal is irreplaceable, which is why it is the one table that
 * records content rather than pointing at it.
 *
 * Migrations are append-only and idempotent. `user_version` tracks the applied
 * count, so a rebuild and an upgrade take the same path.
 */
export const MIGRATIONS: string[] = [
  // ── 1 ──────────────────────────────────────────────────────────────────────
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Identity lives here rather than in the page, in sidecar mode. 'slug' is
  -- derived from the path and changes on a rename; 'id' never does.
  CREATE TABLE pages (
    id                    TEXT PRIMARY KEY,
    slug                  TEXT NOT NULL UNIQUE,
    rel_path              TEXT NOT NULL UNIQUE,
    title                 TEXT NOT NULL,
    type                  TEXT,
    tags                  TEXT NOT NULL DEFAULT '[]',
    class                 TEXT NOT NULL DEFAULT 'full',
    frontmatter           TEXT NOT NULL DEFAULT '{}',
    body_hash             TEXT NOT NULL,
    summary               TEXT,
    keywords              TEXT,
    reference_fence_line  INTEGER,
    body_line             INTEGER NOT NULL DEFAULT 1,
    line_count            INTEGER NOT NULL DEFAULT 0,
    bytes                 INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT,
    updated_at            TEXT,
    indexed_at            TEXT NOT NULL,
    -- Which model-backed derivations are current for this body_hash. Lets an
    -- index pass run structurally now and fill in summaries later without
    -- forgetting which pages still owe one.
    derived_hash          TEXT
  );
  CREATE INDEX pages_class    ON pages(class);
  CREATE INDEX pages_type     ON pages(type);
  CREATE INDEX pages_updated  ON pages(updated_at DESC);

  -- The stat fast path. mtime+size decide whether to hash at all; sha256 is
  -- the correctness path that catches a sync client preserving mtime.
  CREATE TABLE files (
    rel_path    TEXT PRIMARY KEY,
    size        INTEGER NOT NULL,
    mtime_ns    TEXT NOT NULL,
    sha256      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    page_id     TEXT,
    indexed_at  TEXT NOT NULL
  );
  CREATE INDEX files_sha ON files(sha256);

  CREATE TABLE chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id       TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    ord           INTEGER NOT NULL,
    -- 'full' or 'reference' — a page can switch class mid-body at the
    -- <!-- reference --> fence, so class is a property of the chunk.
    kind          TEXT NOT NULL DEFAULT 'full',
    heading_path  TEXT NOT NULL DEFAULT '',
    text          TEXT NOT NULL,
    line_start    INTEGER NOT NULL,
    line_end      INTEGER NOT NULL,
    -- Set once the chunk's vector is present, so a partial embed is visible
    -- rather than looking like a complete index with poor recall.
    embedded      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX chunks_page ON chunks(page_id, ord);
  CREATE INDEX chunks_embedded ON chunks(embedded);

  -- External-content FTS5: the text lives in 'chunks' and is never duplicated.
  -- Porter stemming means "renewing" finds "renews" without a model.
  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    text,
    heading_path,
    content='chunks',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 2'
  );

  -- A fact is a pointer into Markdown, not a record beside it. Edit the
  -- line, the hash breaks, the fact is re-derived. Delete the line, it is gone.
  CREATE TABLE facts (
    id                TEXT PRIMARY KEY,
    page_id           TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    claim             TEXT NOT NULL,
    subject           TEXT,
    attribute         TEXT,
    value             TEXT,
    line_start        INTEGER NOT NULL,
    line_end          INTEGER NOT NULL,
    source_line_hash  TEXT NOT NULL,
    confidence        REAL NOT NULL DEFAULT 0.5,
    valid_from        TEXT,
    -- Set when a value is replaced. A superseded fact is returned *as*
    -- superseded, never as a second competing current answer.
    valid_to          TEXT,
    first_seen        TEXT NOT NULL,
    last_seen         TEXT NOT NULL
  );
  CREATE INDEX facts_page    ON facts(page_id, line_start);
  CREATE INDEX facts_subject ON facts(subject, attribute);
  CREATE INDEX facts_live    ON facts(valid_to);

  -- Dated lines are indexed from any page, not just the ledger, so events typed
  -- into someone's own daily notes are found for free.
  CREATE TABLE events (
    id           TEXT PRIMARY KEY,
    date         TEXT NOT NULL,
    summary      TEXT NOT NULL,
    -- The page the event *links to*, when it has one.
    target_slug  TEXT,
    -- The page the line was *written on*.
    source_slug  TEXT NOT NULL,
    source_page  TEXT REFERENCES pages(id) ON DELETE CASCADE,
    line         INTEGER
  );
  CREATE INDEX events_date    ON events(date DESC);
  CREATE INDEX events_target  ON events(target_slug);

  CREATE TABLE links (
    from_page  TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    to_slug    TEXT NOT NULL,
    to_page    TEXT,
    kind       TEXT NOT NULL DEFAULT 'wikilink',
    line       INTEGER,
    broken     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX links_from ON links(from_page);
  CREATE INDEX links_to   ON links(to_slug);

  -- A stored document is a memory object with its own row: bytes on disk
  -- beside its page, plus extracted text, so a PDF is searchable by its content.
  CREATE TABLE documents (
    id          TEXT PRIMARY KEY,
    page_id     TEXT REFERENCES pages(id) ON DELETE SET NULL,
    rel_path    TEXT NOT NULL UNIQUE,
    mime        TEXT,
    sha256      TEXT NOT NULL,
    label       TEXT,
    text        TEXT,
    summary     TEXT,
    page_count  INTEGER,
    ocr         INTEGER NOT NULL DEFAULT 0,
    bytes       INTEGER NOT NULL DEFAULT 0,
    indexed_at  TEXT NOT NULL
  );
  CREATE INDEX documents_page ON documents(page_id);
  CREATE INDEX documents_sha  ON documents(sha256);

  -- The one irreplaceable table: it records the previous bytes, not a pointer to
  -- them, so undo survives a full rebuild of everything else.
  CREATE TABLE journal (
    id             TEXT PRIMARY KEY,
    at             TEXT NOT NULL,
    actor          TEXT NOT NULL,
    action         TEXT NOT NULL,
    slug           TEXT,
    rel_path       TEXT,
    before         TEXT,
    after          TEXT,
    snapshot_path  TEXT,
    status         TEXT NOT NULL DEFAULT 'applied'
  );
  CREATE INDEX journal_at ON journal(at DESC);

  -- A declined proposal is remembered, so an agent stops re-asking for the
  -- same folder.
  CREATE TABLE proposals (
    id        TEXT PRIMARY KEY,
    at        TEXT NOT NULL,
    kind      TEXT NOT NULL,
    reason    TEXT NOT NULL,
    payload   TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'pending',
    resolved_at TEXT
  );
  CREATE INDEX proposals_status ON proposals(status);
  `,

  // ── 2 ──────────────────────────────────────────────────────────────────────
  // The journal as shipped had one row per change, which cannot describe the
  // changes the write path actually makes: a single 'write' can touch a page, the
  // event ledger and an attachment, and 'undo' has to reverse all of them or none.
  // Nothing had written to it yet, so it is replaced rather than migrated.
  `
  DROP TABLE IF EXISTS journal;

  -- One row per change. The unit 'undo' takes.
  CREATE TABLE changes (
    id       TEXT PRIMARY KEY,
    at       TEXT NOT NULL,
    -- Who asked: 'agent', 'user', 'akno' (the observe tier), 'inbox'.
    actor    TEXT NOT NULL,
    op       TEXT NOT NULL,
    summary  TEXT NOT NULL,
    -- 'applied' | 'undone'. An undone change is kept: it is the record that
    -- something was reversed, which a reader needs as much as the change itself.
    status   TEXT NOT NULL DEFAULT 'applied',
    undone_at TEXT
  );
  -- Ordering is by rowid, which SQLite increments monotonically. 'at' has
  -- millisecond resolution and two changes can share one, so it cannot order them.
  CREATE INDEX changes_at ON changes(at DESC);

  -- One row per file the change touched, in application order. 'before' holds the
  -- previous bytes rather than a pointer to them, which is why undo survives a
  -- full rebuild of every other table: only the journal is irreplaceable.
  CREATE TABLE change_files (
    change_id  TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    ord        INTEGER NOT NULL,
    rel_path   TEXT NOT NULL,
    action     TEXT NOT NULL,
    before     TEXT,
    after      TEXT,
    -- Set instead of 'before' for a binary: the bytes live in trash/<change>/.
    snapshot   TEXT,
    PRIMARY KEY (change_id, ord)
  );
  CREATE INDEX change_files_path ON change_files(rel_path);

  -- A declined proposal is remembered, so an agent stops re-asking for the
  -- same folder. The pending content is held here, so approving completes the
  -- write rather than asking the caller to repeat it.
  DROP TABLE IF EXISTS proposals;
  CREATE TABLE proposals (
    id          TEXT PRIMARY KEY,
    at          TEXT NOT NULL,
    kind        TEXT NOT NULL,
    reason      TEXT NOT NULL,
    -- What is being asked for, e.g. the top-level folder a write would create.
    subject     TEXT NOT NULL,
    -- The op input, replayed verbatim on approval.
    payload     TEXT NOT NULL,
    nearest     TEXT NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'pending',
    resolved_at TEXT,
    -- Set when approving produced a change, so a proposal can be traced to it.
    change_id   TEXT
  );
  CREATE INDEX proposals_status  ON proposals(status);
  CREATE INDEX proposals_subject ON proposals(subject, status);
  `,

  // ── 3. A document's own text, indexed as the document ──────────────────────
  //
  // A stored PDF is searchable by its own content, and the card points at the page, the
  // document, and *the page number within it*. Document text is derived from the attachment
  // and invalidated when the file hash changes — which is only true if the
  // text is indexed against the document rather than pasted into someone's Markdown.
  //
  // Document chunks live in `chunks` on purpose: FTS, the vector table and rank fusion all
  // read that one table, so a document's text is searched by the same machinery as a page's
  // with nothing new to keep in step. They carry the owning page's id as well, which is
  // what lets a hit inside a PDF surface as a card for the page it belongs to.
  `
  ALTER TABLE chunks ADD COLUMN document_id TEXT REFERENCES documents(id) ON DELETE CASCADE;
  -- The page number *within the document*. NULL for a format with no pages: a .txt file
  -- has none, and inventing "page 1" would be a claim rather than a fact.
  ALTER TABLE chunks ADD COLUMN doc_page INTEGER;
  CREATE INDEX chunks_document ON chunks(document_id, ord);

  -- The file hash the current text was extracted from. The invalidation rule, written
  -- down: text is re-extracted when this stops matching the file.
  ALTER TABLE documents ADD COLUMN extracted_sha TEXT;
  `,

  // ── 4. Multi-part documents ────────────────────────────────────────────────
  //
  // A scanner that produced `passport.pdf` and `passport-2.pdf` did not produce two
  // documents. Parts share a `group_key` — the rel_path of part one — which is what gives
  // them one owning page, one summary, and page numbers that run through the whole thing
  // rather than restarting at 1 halfway.
  `
  ALTER TABLE documents ADD COLUMN group_key TEXT;
  ALTER TABLE documents ADD COLUMN part INTEGER NOT NULL DEFAULT 1;
  -- Pages in the parts before this one, so a citation can say "page 5 of the passport"
  -- rather than "page 2 of the second file", which is not a thing a reader can look up.
  ALTER TABLE documents ADD COLUMN page_offset INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX documents_group ON documents(group_key, part);
  `,
];

/**
 * The vector table is created separately: its dimension is fixed at creation
 * and comes from the configured embedding model. Changing models triggers a
 * re-embed rather than silently corrupting the index.
 */
export function vectorTableDdl(dimensions: number): string {
  return `CREATE VIRTUAL TABLE vec_chunks USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding float[${dimensions}] distance_metric=cosine
  )`;
}

/**
 * Fallback when the sqlite-vec extension cannot be loaded on this platform.
 * Cosine is computed in JS. Slower, but memory stays available: degrade,
 * never fail.
 */
export const VECTOR_FALLBACK_DDL = `
  CREATE TABLE IF NOT EXISTS vec_fallback (
    chunk_id   INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    embedding  BLOB NOT NULL,
    norm       REAL NOT NULL
  )
`;
