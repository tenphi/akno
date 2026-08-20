/**
 * One SQLite file. Deleting it costs one re-index and no data — that
 * property is the design, and it is why nothing here is a source of truth.
 * The journal and live maintenance plans are the durable exceptions. The journal keeps prior bytes for undo;
 * a sealed plan keeps exact proposed bytes so a decision survives a restart and never has to regenerate a
 * possibly different rewrite.
 *
 * The first entry is the canonical 0.1.0 schema, compacted from historical versions
 * 1–8. Later entries add durable state that cannot be recovered by rebuilding the index.
 * `user_version` therefore uses the historical schema number, not this array's length.
 * Upgrade code capability-checks durable tables and columns so databases created before
 * or after the compaction converge on the same schema.
 */
export const SCHEMA_VERSION = 10;
export const MAINTENANCE_PLANS_MIGRATION_INDEX = 1;
export const MAINTENANCE_EVIDENCE_MIGRATION_INDEX = 2;

export const MIGRATIONS: string[] = [
  // ── 1. The schema as of 0.1.0 ─────────────────────────────────────────────
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
    -- What the page contributes: 'knowledge', 'source' or 'ignored'. Distinct from
    -- management below, which says what an automatic curator may do to it — one
    -- column governing both meant recall shape, fact eligibility and edit authority
    -- could not be set independently.
    role                  TEXT NOT NULL DEFAULT 'knowledge',
    frontmatter           TEXT NOT NULL DEFAULT '{}',
    body_hash             TEXT NOT NULL,
    summary               TEXT,
    keywords              TEXT,
    -- Where the <!-- source --> fence sits, when the page has one. Below it the
    -- page is quotable source rather than knowledge.
    source_fence_line     INTEGER,
    body_line             INTEGER NOT NULL DEFAULT 1,
    line_count            INTEGER NOT NULL DEFAULT 0,
    bytes                 INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT,
    updated_at            TEXT,
    indexed_at            TEXT NOT NULL,
    -- Which model-backed derivations are current for this body_hash. Lets an
    -- index pass run structurally now and fill in summaries later without
    -- forgetting which pages still owe one.
    derived_hash          TEXT,
    -- What automatic writers may do. 'remember' governs the per-turn retain tier;
    -- 'dream' opts a page into nightly hygiene or synthesis and defaults to neither,
    -- because a curator that edits pages nobody offered it is not a feature.
    remember_management   TEXT NOT NULL DEFAULT 'deny',
    dream_management      TEXT NOT NULL DEFAULT 'none',
    about                 TEXT NOT NULL DEFAULT '[]',
    aliases               TEXT NOT NULL DEFAULT '[]',
    -- Curation freshness, content-addressed. A page opting into hygiene or synthesis
    -- is permission, not a nightly work order: an unchanged input fingerprint skips
    -- the page without spending a model call. 'preview' is a distinct status because
    -- enabling writes must reconsider a previously accepted preview exactly once.
    curate_input_hash     TEXT,
    curate_status         TEXT,
    curated_at            TEXT
  );
  CREATE INDEX pages_role     ON pages(role);
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

  -- A stored document is a memory object with its own row: bytes on disk
  -- beside its page, plus extracted text, so a PDF is searchable by its content.
  CREATE TABLE documents (
    id             TEXT PRIMARY KEY,
    page_id        TEXT REFERENCES pages(id) ON DELETE SET NULL,
    rel_path       TEXT NOT NULL UNIQUE,
    mime           TEXT,
    sha256         TEXT NOT NULL,
    label          TEXT,
    text           TEXT,
    summary        TEXT,
    page_count     INTEGER,
    ocr            INTEGER NOT NULL DEFAULT 0,
    bytes          INTEGER NOT NULL DEFAULT 0,
    indexed_at     TEXT NOT NULL,
    -- The file hash the current text was extracted from. The invalidation rule, written
    -- down: text is re-extracted when this stops matching the file.
    extracted_sha  TEXT,
    -- A scanner that produced 'passport.pdf' and 'passport-2.pdf' did not produce two
    -- documents. Parts share a group_key — the rel_path of part one — which is what gives
    -- them one owning page, one summary, and page numbers that run through the whole
    -- thing rather than restarting at 1 halfway.
    group_key      TEXT,
    part           INTEGER NOT NULL DEFAULT 1,
    -- Pages in the parts before this one, so a citation can say "page 5 of the passport"
    -- rather than "page 2 of the second file", which is not a thing a reader can look up.
    page_offset    INTEGER NOT NULL DEFAULT 0,
    -- Set on a *rendition*: 'contract.pdf.txt' is the same document in a format a reader
    -- can open, not a second half of one. Parts concatenate; a rendition does not, and
    -- treating one as the other returns every phrase in a contract twice against one
    -- budget. A rendition carries no text of its own for that reason — the text is the
    -- source's and is already indexed there. What it carries is the pointer back.
    renders        TEXT,
    -- On the *source* row: the hash the rendition was last decided against. Set after a
    -- write and after a decline, so a photo that earns no rendition is not reconsidered
    -- every pass.
    rendition_sha  TEXT,
    -- How the text was obtained: 'plain', 'textutil', 'text-layer', 'ocr', 'vision' or
    -- 'none'. Recorded rather than reconstructed from the ocr flag, which cannot express
    -- the case the distinction exists for — an image a model *described* rather than read.
    extract_via    TEXT,
    confidence     REAL
  );
  CREATE INDEX documents_page    ON documents(page_id);
  CREATE INDEX documents_sha     ON documents(sha256);
  CREATE INDEX documents_group   ON documents(group_key, part);
  CREATE INDEX documents_renders ON documents(renders);

  -- A page's chunks and a document's chunks live in one table on purpose: FTS, the
  -- vector table and rank fusion all read it, so a PDF's text is searched by the same
  -- machinery as a note's with nothing new to keep in step. A document chunk carries
  -- the owning page's id as well, which is what lets a hit inside a PDF surface as a
  -- card for the page it belongs to.
  CREATE TABLE chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id       TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    ord           INTEGER NOT NULL,
    -- 'knowledge' or 'source' — a page can switch role mid-body at the
    -- <!-- source --> fence, so this is a property of the chunk.
    kind          TEXT NOT NULL DEFAULT 'knowledge',
    heading_path  TEXT NOT NULL DEFAULT '',
    text          TEXT NOT NULL,
    line_start    INTEGER NOT NULL,
    line_end      INTEGER NOT NULL,
    -- Set once the chunk's vector is present, so a partial embed is visible
    -- rather than looking like a complete index with poor recall.
    embedded      INTEGER NOT NULL DEFAULT 0,
    document_id   TEXT REFERENCES documents(id) ON DELETE CASCADE,
    -- The page number *within the document*. NULL for a format with no pages: a .txt
    -- file has none, and inventing "page 1" would be a claim rather than a fact.
    doc_page      INTEGER
  );
  CREATE INDEX chunks_page     ON chunks(page_id, ord);
  CREATE INDEX chunks_embedded ON chunks(embedded);
  CREATE INDEX chunks_document ON chunks(document_id, ord);

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
    last_seen         TEXT NOT NULL,
    -- Managed content carries this stable id in Markdown. A fact derived from a reworded
    -- or moved unit follows it instead of manufacturing a supersession on the night the
    -- page was merely reformatted.
    item_id           TEXT
  );
  CREATE INDEX facts_page    ON facts(page_id, line_start);
  CREATE INDEX facts_subject ON facts(subject, attribute);
  CREATE INDEX facts_live    ON facts(valid_to);
  CREATE INDEX facts_item    ON facts(item_id);

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

  -- One row per change. The unit 'undo' takes: a single 'write' can touch a page, the
  -- event ledger and an attachment, and undo has to reverse all of them or none.
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
    -- Where a moved file went. Without it undo reverses "no prior content" by deleting,
    -- which for an attachment ate the binary; with it the reversal is a rename, which
    -- is what the change was.
    moved_to   TEXT,
    PRIMARY KEY (change_id, ord)
  );
  CREATE INDEX change_files_path ON change_files(rel_path);

  -- A declined proposal is remembered, so an agent stops re-asking for the
  -- same folder. The pending content is held here, so approving completes the
  -- write rather than asking the caller to repeat it.
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
  // ── 2. Durable maintenance plans ──────────────────────────────────────────
  // Full proposed bytes live here rather than in the human-gate proposal table. A maintenance
  // item is independently decidable, may outlive the process that planned it, and points to the
  // journal change that eventually applied it.
  `
  CREATE TABLE maintenance_plans (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    mode         TEXT NOT NULL,
    phase        TEXT NOT NULL,
    status       TEXT NOT NULL,
    fingerprint  TEXT NOT NULL,
    summary      TEXT NOT NULL,
    error        TEXT
  );
  CREATE INDEX maintenance_plans_status ON maintenance_plans(status, created_at DESC);
  CREATE INDEX maintenance_plans_fingerprint ON maintenance_plans(fingerprint, mode, status);

  CREATE TABLE maintenance_items (
    id                 TEXT PRIMARY KEY,
    plan_id            TEXT NOT NULL REFERENCES maintenance_plans(id) ON DELETE CASCADE,
    ord                INTEGER NOT NULL,
    revision           INTEGER NOT NULL DEFAULT 1,
    kind               TEXT NOT NULL,
    risk               TEXT NOT NULL,
    status             TEXT NOT NULL,
    subject            TEXT NOT NULL,
    rationale          TEXT NOT NULL,
    input_hash         TEXT NOT NULL,
    operations         TEXT NOT NULL,
    checks             TEXT NOT NULL DEFAULT '[]',
    decision_actor     TEXT,
    decision_outcome   TEXT,
    decision_reason    TEXT,
    decided_at         TEXT,
    change_id          TEXT,
    verification       TEXT,
    updated_at         TEXT NOT NULL,
    UNIQUE(plan_id, ord)
  );
  CREATE INDEX maintenance_items_plan ON maintenance_items(plan_id, ord);
  CREATE INDEX maintenance_items_status ON maintenance_items(status, updated_at DESC);
  `,
  // ── 3. Evidence supplied to the independent maintenance curator ──────────
  // Exact page operations were already durable. Synthesis decisions also need the bounded
  // evidence graph that justified new knowledge, kept in state_dir with the private plan.
  `
  ALTER TABLE maintenance_items ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]';
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
