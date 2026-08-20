# Changelog

## 0.1.0 — first release

Akno is a two-way memory layer for agents over a Markdown knowledge base. Point it at a folder of notes;
it indexes what is there, keeps watching, and gives agents a small set of operations for reading and writing
that knowledge, while you keep editing the same files by hand.

Developed and measured against a real knowledge base of a few hundred pages. Two parts of the maintenance
cycle ship switched **off** for reasons measured on that base rather than guessed — see
[What ships switched off](README.md#what-ships-switched-off).

### Retrieval

- Hybrid search over FTS5 and vector embeddings, with rank fusion and an optional cross-encoder rerank.
- Results are **page cards with line addresses**, so every claim traces to a sentence in a file.
- Absence is a result, and it distinguishes _nothing matched_ from _the index is unavailable_.
- `question` mode reports coverage: which concepts of the question the results actually cover.
- A superseded value comes back labelled as superseded, never as a competing current claim.
- `context` assembles the whole pre-turn bundle — structure, timeline, cards — against one token budget.

### Writing

- `write`, `remember`, `forget`, `move`, `folder`, `undo`, `approve`/`decline`.
- Every change is journalled with the previous bytes, so `undo` survives a full rebuild of the index.
- Structure rules are enforced rather than requested: a write into an undeclared folder comes back
  `requires_folder` and the caller declares it first.
- `ingest` extracts, OCRs, names, summarizes and routes a file, a folder or a URL.
- An inbox folder files whatever is dropped in it — the only place Akno moves files from.

### Documents

- A stored PDF is searchable by its own content, and a hit cites the page number within it.
- Multi-part scans share one owning page and one continuous page numbering.
- Optional `.txt` renditions beside a document, recognised as the same document rather than a second one.

### The maintenance cycle

`dream` runs observe, reflect, curate, adopt, conflicts, repair and housekeeping. Each phase is independent,
safe to re-run, and reports what a guardrail refused. `observe`, `reflect`, `curate` and `repair` ship off.

### Three doors, one registry

In-process, a Unix socket, and MCP — all generated from one op registry, so schemas, descriptions and error
codes are stated once. Exactly one process holds the write handle; a second opens read-only and says so.

### Packages

| Package                   | What it is                                                       |
| ------------------------- | ---------------------------------------------------------------- |
| `@tenphi/akno`          | The CLI. `npm install -g @tenphi/akno`                         |
| `@tenphi/akno-core`     | The memory layer, for a host embedding it in-process             |
| `@tenphi/akno-client`   | Thin typed client over a running service; no native dependencies |
| `@tenphi/akno-protocol` | Op registry, zod schemas, wire format                            |

macOS only, [on purpose](README.md#platform) — except `@tenphi/akno-client`, which is portable.
