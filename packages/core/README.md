# @tenphi/akno-core

The memory layer itself: config, store, indexer, models, recall, the write path, the watcher and the
maintenance cycle. This is the engine behind the [`@tenphi/akno`](https://www.npmjs.com/package/@tenphi/akno)
CLI, published separately so a host can embed it in-process.

The runtime supports macOS and Linux (`"os": ["darwin", "linux"]`) and carries native dependencies —
`better-sqlite3` and `sqlite-vec`. Document extraction uses PDFKit, Vision, and `textutil` on macOS or external
Poppler, Tesseract, and LibreOffice tools on Linux. Missing platform tools produce typed degradation. A host
that only needs to _talk_ to a running Akno should depend on
[`@tenphi/akno-client`](https://www.npmjs.com/package/@tenphi/akno-client) instead, which is portable and
has no native code.

```ts
import { open } from '@tenphi/akno-core';

const akno = await open({ aknoPath: '~/Notes' });
const result = await akno.call('recall', {
  query: 'What did Bo Winters report about the warranty?',
  memory_view: 'reports',
});
```

Exactly one process may hold the write handle. A second `open` on the same state directory returns a
read-only handle and says so, rather than racing a live watcher.

`akno.changes(limit)` lists recent journal entries without page contents. `akno.change(changeId)`
returns one entry with its original committed `before` / `after` text and file actions, even after
a later write or undo. Binary snapshots stay private to the journal. Trusted socket hosts can use
`client.command('changes', { change_id: changeId })` when the handshake advertises `change_details`;
the ordinary list form of that command is unchanged. This operator surface is not an agent MCP tool.

The index boundary quarantines complete Markdown merge blocks, configured sync-conflict paths, and duplicate
stable page identities before they can reach chunks, facts, graph state, maintenance, or automatic writes.
Classification is derived from current files and owner configuration; Akno never rewrites a conflicting file.

Full documentation: [github.com/tenphi/akno](https://github.com/tenphi/akno#readme)

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
