/**
 * One SQLite file. Deleting it costs one re-index and no data — that
 * property is the design, and it is why nothing here is a source of truth.
 * The journal, live maintenance plans, and content-safe run receipts are the durable exceptions. The journal
 * keeps prior bytes for undo; a sealed plan keeps exact proposed bytes so a decision survives a restart and
 * never has to regenerate a possibly different rewrite; the receipt explains the lifecycle around them.
 *
 * The first entry is the canonical 0.1.0 schema, compacted from historical versions
 * 1–8. Later entries add durable exceptions or new rebuildable index capabilities.
 * `user_version` therefore uses the historical schema number, not this array's length.
 * Upgrade code capability-checks durable tables and columns so databases created before
 * or after the compaction converge on the same schema.
 */
export const SCHEMA_VERSION = 26;
export const MAINTENANCE_PLANS_MIGRATION_INDEX = 1;
export const MAINTENANCE_EVIDENCE_MIGRATION_INDEX = 2;
export const CONFLICT_VERDICTS_MIGRATION_INDEX = 3;
export const CONFLICT_QUALIFICATION_MIGRATION_INDEX = 4;
export const MAINTENANCE_RUNS_MIGRATION_INDEX = 5;
export const ORPHAN_DOCUMENT_CHUNKS_MIGRATION_INDEX = 6;
export const DOCUMENT_AVAILABILITY_MIGRATION_INDEX = 7;
export const DOCUMENT_FILE_DATES_MIGRATION_INDEX = 8;
export const MAINTENANCE_ITEM_POLICY_MIGRATION_INDEX = 9;
export const MAINTENANCE_ITEM_STATUS_CODE_MIGRATION_INDEX = 10;
export const STRUCTURAL_GRAPH_MIGRATION_INDEX = 11;
export const ENTITY_GRAPH_MIGRATION_INDEX = 12;
export const FACT_GRAPH_MIGRATION_INDEX = 13;
export const CONTEXTUAL_ENTITY_MIGRATION_INDEX = 14;
export const MAINTENANCE_PLAN_PAYLOAD_RETENTION_MIGRATION_INDEX = 15;
export const MAINTENANCE_ITEM_COMPONENT_COUNT_MIGRATION_INDEX = 16;
export const SEMANTIC_MERGE_VERDICTS_MIGRATION_INDEX = 17;
export const SEMANTIC_MERGE_EMBEDDINGS_MIGRATION_INDEX = 18;
export const MANAGED_ITEM_PLACEMENT_VERDICTS_MIGRATION_INDEX = 19;

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
  -- card for the page it belongs to. Migration 7 relaxes this for orphan documents.
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
  // ── 4. Content-addressed typed conflict verdicts ──────────────────────────
  // A verdict is derived state, but caching it is what makes an unchanged nightly cycle converge
  // instead of paying a classifier to reach the same decision forever.
  `
  CREATE TABLE conflict_verdicts (
    fingerprint    TEXT NOT NULL,
    model_id       TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    verdict        TEXT NOT NULL,
    current_slug   TEXT,
    reason         TEXT,
    updated_at     TEXT NOT NULL,
    PRIMARY KEY (fingerprint, model_id, prompt_version)
  );
  `,
  // ── 5. Evidence-backed qualified conflict verdicts ────────────────────────
  // The JSON contains exact claim references and the verbatim scope phrase. Keeping it with the
  // cached verdict avoids rerunning a classifier while preserving everything needed by planning.
  `
  ALTER TABLE conflict_verdicts ADD COLUMN qualification TEXT;
  `,
  // ── 6. Content-safe dream lifecycle receipts ─────────────────────────────
  // Exact page content belongs in sealed plan items and the opt-in private log. This table is
  // deliberately safe for routine status output: fingerprints, counts, ids, and typed outcomes.
  `
  CREATE TABLE maintenance_runs (
    id          TEXT PRIMARY KEY,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    status      TEXT NOT NULL,
    receipt     TEXT NOT NULL,
    error_code  TEXT
  );
  CREATE INDEX maintenance_runs_status ON maintenance_runs(status, started_at DESC);
  `,
  // ── 7. First-class orphan document chunks ────────────────────────────────
  // Chunks are derived, but preserving their ids keeps FTS citations stable through the migration.
  // Existing vectors are re-embedded because the fallback table follows the renamed parent table.
  `
  DROP TABLE IF EXISTS vec_fallback;
  DROP TABLE chunks_fts;
  ALTER TABLE chunks RENAME TO chunks_page_only;

  CREATE TABLE chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id       TEXT REFERENCES pages(id) ON DELETE CASCADE,
    ord           INTEGER NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'knowledge',
    heading_path  TEXT NOT NULL DEFAULT '',
    text          TEXT NOT NULL,
    line_start    INTEGER NOT NULL,
    line_end      INTEGER NOT NULL,
    embedded      INTEGER NOT NULL DEFAULT 0,
    document_id   TEXT REFERENCES documents(id) ON DELETE CASCADE,
    doc_page      INTEGER,
    CHECK (page_id IS NOT NULL OR document_id IS NOT NULL)
  );
  INSERT INTO chunks(id, page_id, ord, kind, heading_path, text, line_start, line_end,
                     embedded, document_id, doc_page)
       SELECT id, page_id, ord, kind, heading_path, text, line_start, line_end,
              0, document_id, doc_page
         FROM chunks_page_only;
  DROP TABLE chunks_page_only;

  CREATE INDEX chunks_page     ON chunks(page_id, ord);
  CREATE INDEX chunks_embedded ON chunks(embedded);
  CREATE INDEX chunks_document ON chunks(document_id, ord);
  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    text,
    heading_path,
    content='chunks',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 2'
  );
  INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');
  `,
  // ── 8. Durable document availability ─────────────────────────────────────
  // Extracted text may outlive an original file. Preserve that evidence and say
  // that it is a retained copy instead of silently turning a missing file into
  // "nothing recorded". Explicit forget remains the operation that removes rows.
  `
  ALTER TABLE documents ADD COLUMN availability TEXT NOT NULL DEFAULT 'available';
  ALTER TABLE documents ADD COLUMN missing_since TEXT;
  CREATE INDEX documents_availability ON documents(availability, page_id);
  `,
  // ── 9. Document filesystem date evidence ─────────────────────────────────
  // Copied onto the document row because `files` is removed when an original
  // disappears. Timeline can then keep saying exactly which metadata date it
  // knows instead of turning a missing source into an empty result.
  `
  ALTER TABLE documents ADD COLUMN file_created_at TEXT;
  ALTER TABLE documents ADD COLUMN file_modified_at TEXT;
  UPDATE documents
     SET file_modified_at = (
       SELECT datetime(CAST(files.mtime_ns AS INTEGER) / 1000000000.0, 'unixepoch')
         FROM files WHERE files.rel_path = documents.rel_path
     )
   WHERE file_modified_at IS NULL;
  `,
  // ── 10. Per-item maintenance authority ──────────────────────────────────
  // Mixed plans need the curator and recovery path to know which exact items are autonomous.
  // Existing sealed items inherit their plan's historical mode byte-for-byte.
  `
  ALTER TABLE maintenance_items ADD COLUMN policy TEXT NOT NULL DEFAULT 'audit';
  UPDATE maintenance_items
     SET policy = COALESCE(
       (SELECT mode FROM maintenance_plans WHERE maintenance_plans.id = maintenance_items.plan_id),
       'audit'
     );
  `,
  // ── 11. Typed maintenance deferral reasons ──────────────────────────────
  // Human-readable detail remains in decision_reason; automation must not parse prose to detect backlog.
  `
  ALTER TABLE maintenance_items ADD COLUMN status_code TEXT;
  `,
  // ── 12. Rebuildable structural evidence graph ───────────────────────────
  // These rows are pointers into the canonical page/document/event tables, never another
  // knowledge store. The indexer replaces the complete structural graph transactionally.
  `
  CREATE TABLE graph_nodes (
    id                 TEXT PRIMARY KEY,
    kind               TEXT NOT NULL,
    source_id          TEXT NOT NULL,
    source_hash        TEXT NOT NULL,
    derivation_version TEXT NOT NULL,
    UNIQUE(kind, source_id)
  );
  CREATE INDEX graph_nodes_kind ON graph_nodes(kind, source_id);

  CREATE TABLE graph_edges (
    id                 TEXT PRIMARY KEY,
    from_node          TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    to_node            TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    relation           TEXT NOT NULL,
    predicate          TEXT,
    source_kind        TEXT NOT NULL,
    source_page        TEXT REFERENCES pages(id) ON DELETE CASCADE,
    source_document    TEXT REFERENCES documents(id) ON DELETE CASCADE,
    source_event       TEXT REFERENCES events(id) ON DELETE CASCADE,
    line_start         INTEGER,
    line_end           INTEGER,
    source_field       TEXT,
    source_hash        TEXT NOT NULL,
    derivation         TEXT NOT NULL,
    resolution         TEXT NOT NULL,
    confidence         REAL NOT NULL,
    derivation_version TEXT NOT NULL,
    CHECK (confidence >= 0 AND confidence <= 1)
  );
  CREATE INDEX graph_edges_from ON graph_edges(from_node, relation);
  CREATE INDEX graph_edges_to ON graph_edges(to_node, relation);
  CREATE INDEX graph_edges_source_page ON graph_edges(source_page);
  CREATE INDEX graph_edges_source_document ON graph_edges(source_document);
  CREATE INDEX graph_edges_source_event ON graph_edges(source_event);
  `,
  // ── 13. Canonical graph entities and conservative mention resolution ──
  // An entity is anchored to one canonical knowledge page. Names and mention outcomes stay
  // separate so an ambiguous name is inspectable without becoming a traversable graph edge.
  `
  CREATE TABLE graph_entities (
    id                 TEXT PRIMARY KEY,
    canonical_page     TEXT NOT NULL UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
    entity_type        TEXT NOT NULL,
    label              TEXT NOT NULL,
    normalized_label   TEXT NOT NULL,
    source_hash        TEXT NOT NULL,
    derivation_version TEXT NOT NULL
  );
  CREATE INDEX graph_entities_type ON graph_entities(entity_type, canonical_page);

  CREATE TABLE graph_entity_names (
    entity_id          TEXT NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    normalized_name    TEXT NOT NULL,
    signal             TEXT NOT NULL,
    source_page        TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    source_hash        TEXT NOT NULL,
    derivation_version TEXT NOT NULL,
    PRIMARY KEY(entity_id, normalized_name, signal)
  );
  CREATE INDEX graph_entity_names_normalized
    ON graph_entity_names(normalized_name, signal, entity_id);

  CREATE TABLE graph_mentions (
    id                 TEXT PRIMARY KEY,
    mention            TEXT NOT NULL,
    normalized_mention TEXT NOT NULL,
    source_page        TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    source_field       TEXT NOT NULL,
    source_line        INTEGER,
    source_hash        TEXT NOT NULL,
    resolved_entity    TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    resolution         TEXT NOT NULL,
    signal             TEXT,
    candidates         TEXT NOT NULL DEFAULT '[]',
    derivation_version TEXT NOT NULL,
    CHECK (resolution IN ('exact', 'ambiguous', 'unresolved'))
  );
  CREATE INDEX graph_mentions_source ON graph_mentions(source_page, source_field);
  CREATE INDEX graph_mentions_entity ON graph_mentions(resolved_entity);
  CREATE INDEX graph_mentions_normalized ON graph_mentions(normalized_mention, resolution);
  `,
  // ── 14. Provenance-bound fact relationships and eligibility ────────────
  // All derived facts remain inspectable, but only exact, current, conflict-eligible claims
  // become default-traversable edges. Direct entity relationships retain their fact locator.
  `
  ALTER TABLE graph_edges ADD COLUMN source_fact TEXT REFERENCES facts(id) ON DELETE CASCADE;
  ALTER TABLE graph_edges ADD COLUMN valid_from TEXT;
  ALTER TABLE graph_edges ADD COLUMN valid_to TEXT;
  CREATE INDEX graph_edges_source_fact ON graph_edges(source_fact);
  CREATE INDEX graph_edges_current ON graph_edges(valid_to, relation);

  CREATE TABLE graph_fact_status (
    fact_id              TEXT PRIMARY KEY REFERENCES facts(id) ON DELETE CASCADE,
    subject_entity       TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    object_entity        TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    subject_resolution   TEXT NOT NULL,
    subject_candidates   TEXT NOT NULL DEFAULT '[]',
    object_resolution    TEXT NOT NULL,
    object_candidates    TEXT NOT NULL DEFAULT '[]',
    predicate            TEXT,
    eligibility          TEXT NOT NULL,
    traversable          INTEGER NOT NULL DEFAULT 0,
    conflict_fingerprint TEXT,
    source_hash          TEXT NOT NULL,
    derivation_version   TEXT NOT NULL,
    CHECK (subject_resolution IN ('missing', 'exact', 'ambiguous', 'unresolved')),
    CHECK (object_resolution IN ('scalar', 'exact', 'ambiguous')),
    CHECK (eligibility IN (
      'eligible', 'superseded', 'low_confidence', 'conflict_unverified',
      'conflict_unresolved', 'conflict_qualified', 'conflict_superseded'
    )),
    CHECK (traversable IN (0, 1))
  );
  CREATE INDEX graph_fact_status_subject ON graph_fact_status(subject_entity, traversable);
  CREATE INDEX graph_fact_status_object ON graph_fact_status(object_entity, traversable);
  CREATE INDEX graph_fact_status_eligibility ON graph_fact_status(eligibility, traversable);
  `,
  // ── 15. Provenance-bound contextual entity verdicts ───────────────────
  // Verdicts are a cache over authored evidence, not knowledge. Rebuilding the graph applies
  // only a verdict whose source and candidate fingerprints still match.
  `
  DROP INDEX graph_fact_status_subject;
  DROP INDEX graph_fact_status_object;
  DROP INDEX graph_fact_status_eligibility;
  DROP INDEX graph_mentions_source;
  DROP INDEX graph_mentions_entity;
  DROP INDEX graph_mentions_normalized;
  ALTER TABLE graph_fact_status RENAME TO graph_fact_status_v21;
  ALTER TABLE graph_mentions RENAME TO graph_mentions_v21;

  CREATE TABLE graph_mentions (
    id                   TEXT PRIMARY KEY,
    mention              TEXT NOT NULL,
    normalized_mention   TEXT NOT NULL,
    source_page          TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    source_field         TEXT NOT NULL,
    source_line          INTEGER,
    source_hash          TEXT NOT NULL,
    resolved_entity      TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    resolution           TEXT NOT NULL,
    signal               TEXT,
    candidates           TEXT NOT NULL DEFAULT '[]',
    decision_fingerprint TEXT,
    model_id             TEXT,
    prompt_version       TEXT,
    confidence           REAL,
    derivation_version   TEXT NOT NULL,
    CHECK (resolution IN ('exact', 'contextual', 'ambiguous', 'unresolved')),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
  );
  INSERT INTO graph_mentions(
    id, mention, normalized_mention, source_page, source_field, source_line, source_hash,
    resolved_entity, resolution, signal, candidates, confidence, derivation_version
  )
  SELECT id, mention, normalized_mention, source_page, source_field, source_line, source_hash,
         resolved_entity, resolution, signal, candidates,
         CASE WHEN resolution = 'exact' THEN 1 ELSE NULL END,
         derivation_version
    FROM graph_mentions_v21;
  DROP TABLE graph_mentions_v21;
  CREATE INDEX graph_mentions_source ON graph_mentions(source_page, source_field);
  CREATE INDEX graph_mentions_entity ON graph_mentions(resolved_entity);
  CREATE INDEX graph_mentions_normalized ON graph_mentions(normalized_mention, resolution);

  CREATE TABLE graph_fact_status (
    fact_id                        TEXT PRIMARY KEY REFERENCES facts(id) ON DELETE CASCADE,
    subject_entity                 TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    object_entity                  TEXT REFERENCES graph_entities(id) ON DELETE SET NULL,
    subject_resolution             TEXT NOT NULL,
    subject_candidates             TEXT NOT NULL DEFAULT '[]',
    subject_resolution_fingerprint TEXT,
    object_resolution              TEXT NOT NULL,
    object_candidates              TEXT NOT NULL DEFAULT '[]',
    object_resolution_fingerprint  TEXT,
    predicate                      TEXT,
    eligibility                    TEXT NOT NULL,
    traversable                    INTEGER NOT NULL DEFAULT 0,
    conflict_fingerprint           TEXT,
    source_hash                    TEXT NOT NULL,
    derivation_version             TEXT NOT NULL,
    CHECK (subject_resolution IN ('missing', 'exact', 'contextual', 'ambiguous', 'unresolved')),
    CHECK (object_resolution IN ('scalar', 'exact', 'contextual', 'ambiguous')),
    CHECK (eligibility IN (
      'eligible', 'superseded', 'low_confidence', 'conflict_unverified',
      'conflict_unresolved', 'conflict_qualified', 'conflict_superseded'
    )),
    CHECK (traversable IN (0, 1))
  );
  INSERT INTO graph_fact_status(
    fact_id, subject_entity, object_entity, subject_resolution, subject_candidates,
    object_resolution, object_candidates, predicate, eligibility, traversable,
    conflict_fingerprint, source_hash, derivation_version
  )
  SELECT fact_id, subject_entity, object_entity, subject_resolution, subject_candidates,
         object_resolution, object_candidates, predicate, eligibility, traversable,
         conflict_fingerprint, source_hash, derivation_version
    FROM graph_fact_status_v21;
  DROP TABLE graph_fact_status_v21;
  CREATE INDEX graph_fact_status_subject ON graph_fact_status(subject_entity, traversable);
  CREATE INDEX graph_fact_status_object ON graph_fact_status(object_entity, traversable);
  CREATE INDEX graph_fact_status_eligibility ON graph_fact_status(eligibility, traversable);

  CREATE TABLE graph_resolution_verdicts (
    fingerprint           TEXT NOT NULL,
    model_id              TEXT NOT NULL,
    prompt_version        TEXT NOT NULL,
    outcome               TEXT NOT NULL,
    selected_entity       TEXT,
    grades                TEXT NOT NULL,
    rationale             TEXT NOT NULL,
    source_hash           TEXT NOT NULL,
    candidate_fingerprint TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    PRIMARY KEY(fingerprint, model_id, prompt_version),
    CHECK (outcome IN ('resolved', 'unresolved'))
  );
  CREATE INDEX graph_resolution_verdicts_model
    ON graph_resolution_verdicts(model_id, prompt_version, created_at);
  `,
  // ── 23. Two-stage maintenance-plan retention ─────────────────────────────
  // Terminal exact payloads can be stripped while compact decisions and receipts remain
  // inspectable. The timestamp makes an empty operation list unambiguous to every caller.
  `
  ALTER TABLE maintenance_plans ADD COLUMN payload_pruned_at TEXT;
  `,
  // Component identity lives in private evidence, but its count is part of the compact receipt
  // that survives payload pruning. Backfill it before any old evidence can expire.
  `
  ALTER TABLE maintenance_items ADD COLUMN component_count INTEGER NOT NULL DEFAULT 1;
  UPDATE maintenance_items
     SET component_count = max(1, (
       SELECT count(*) FROM json_each(
         CASE WHEN json_valid(maintenance_items.evidence) THEN maintenance_items.evidence ELSE '[]' END
       )
        WHERE json_extract(json_each.value, '$.type') = 'component'
  ));
  `,
  // Model decisions are derived cache, not knowledge. Binding them to exact page hashes,
  // endpoints, and prompt/signature versions prevents a stale rejection or acceptance from
  // surviving any input or runtime-contract change. No page text or model rationale is stored.
  `
  CREATE TABLE semantic_merge_verdicts (
    fingerprint         TEXT PRIMARY KEY,
    left_page           TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    right_page          TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    score               REAL NOT NULL,
    outcome             TEXT NOT NULL,
    embedding_endpoint  TEXT NOT NULL,
    classifier_endpoint TEXT NOT NULL,
    prompt_version      TEXT NOT NULL,
    signature_version   TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    CHECK (outcome IN ('same_subject', 'keep_separate')),
    CHECK (left_page != right_page)
  );
  CREATE INDEX semantic_merge_verdicts_pages
    ON semantic_merge_verdicts(left_page, right_page, created_at);
  `,
  // Complete-page embeddings are derived cache, not knowledge. The source hash binds the
  // vector to the exact classifier input without retaining its text, and the endpoint/signature
  // fields invalidate it when the model or input contract changes.
  `
  CREATE TABLE semantic_merge_embeddings (
    fingerprint        TEXT PRIMARY KEY,
    page_id            TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    source_hash        TEXT NOT NULL,
    embedding_endpoint TEXT NOT NULL,
    signature_version  TEXT NOT NULL,
    dimensions         INTEGER NOT NULL,
    embedding          BLOB NOT NULL,
    created_at         TEXT NOT NULL,
    CHECK (dimensions > 0)
  );
  CREATE INDEX semantic_merge_embeddings_page
    ON semantic_merge_embeddings(page_id, created_at);
  `,
  // Managed-item placement is a semantic qualification over exact current page bytes. The
  // verdict cache stores only item ids, outcomes, and opaque destination-heading fingerprints;
  // page text, headings, and model rationale remain absent from derived state.
  `
  CREATE TABLE managed_item_placement_verdicts (
    fingerprint         TEXT PRIMARY KEY,
    page_id             TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    source_hash         TEXT NOT NULL,
    classifier_endpoint TEXT NOT NULL,
    prompt_version      TEXT NOT NULL,
    signature_version   TEXT NOT NULL,
    verdicts            TEXT NOT NULL,
    created_at          TEXT NOT NULL
  );
  CREATE INDEX managed_item_placement_verdicts_page
    ON managed_item_placement_verdicts(page_id, created_at);
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
