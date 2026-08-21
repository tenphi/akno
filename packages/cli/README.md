# @tenphi/akno

**A two-way memory layer for agents, on top of a Markdown knowledge base you already have.**

Point it at a folder of notes. It indexes what is there, keeps watching, and gives agents a small set of
operations for reading and writing that knowledge — while you keep editing the same files by hand, in
Obsidian or any editor, with no import step and no proprietary store.

Delete the index and the folder is untouched. `akno index` rebuilds every chunk, embedding, summary, fact,
event and link from the Markdown.

macOS only, [on purpose](https://github.com/tenphi/akno#platform). Requires Node 22.18+.

```bash
npm install -g @tenphi/akno
```

Akno refuses to start until you tell it which folder holds your notes — there is no sensible default for
that. Point it at one and give it a model endpoint:

```bash
mkdir -p ~/.akno && cat > ~/.akno/config.json <<'JSON'
{
  "akno_path": "~/Notes",
  "providers": { "local": { "base_url": "http://127.0.0.1:8080/v1" } },
  "models": {
    "embedding": { "id": "text-embedding-qwen3-embedding-0.6b", "dimensions": 1024 },
    "derive":    { "id": "gemma-4-12b-it" },
    "expansion": { "id": "llama-3.2-3b-instruct" }
  }
}
JSON
akno index
akno doctor
akno recall "when does the car insurance renew?"
```

`index` before `doctor`: most of what `doctor` reports is counted out of the index.

No notes to point it at yet? The repo ships a small invented one —
[`examples/demo-brain`](https://github.com/tenphi/akno/tree/main/examples).

Every model role is optional and degrades rather than fails: with no embedding model you get lexical search,
with no derive model you get no summaries or facts, and recall still works. `akno doctor` reports which
roles resolved and what each missing one costs.

## What you get

```
akno recall <query>       Search memory. Returns cited page and document cards.
akno read <slug>          One exact page or document, in full.
akno adopt <document-id>  Organize one orphan document through its trust policy.
akno context <query>      The whole pre-turn bundle against one budget.
akno remember <text>      Hand over notes; Akno decides what to keep and where.
akno write                Create, append, patch or replace a page.
akno ingest <path|url>    Extract, OCR, name, summarize and route a file or folder.
akno dream                The nightly maintenance cycle.
akno plan                 Inspect, decide and apply durable curation plans.
akno serve                Hold the index, watcher and models in one process.
```

`akno dream` prints a content-free operational summary by default, including progress for long model calls.
Use `--private-details` only when page names, source diagnostics, and full JSON content are appropriate for the
current terminal or log destination. `akno plan diff` is always an explicit private-content inspection.

`akno --help` lists all of them. Three doors — in-process, a Unix socket, and MCP — are generated from one
op registry, so a caller gets the same schemas and the same errors however it connects.

## Documentation

- [README](https://github.com/tenphi/akno#readme) — why it is built this way
- [HOW-IT-WORKS](https://github.com/tenphi/akno/blob/main/HOW-IT-WORKS.md) — every command and background
  process in plain language, with examples

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
