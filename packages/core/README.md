# @tenphi/akno-core

The memory layer itself: config, store, indexer, models, recall, the write path, the watcher and the
maintenance cycle. This is the engine behind the [`@tenphi/akno`](https://www.npmjs.com/package/@tenphi/akno)
CLI, published separately so a host can embed it in-process.

The runtime supports macOS and Linux (`"os": ["darwin", "linux"]`) and carries native dependencies —
`better-sqlite3` and `sqlite-vec`. Document extraction and managed background installation remain macOS-only. A
host that only needs to _talk_ to a running Akno should depend on
[`@tenphi/akno-client`](https://www.npmjs.com/package/@tenphi/akno-client) instead, which is portable and
has no native code.

```ts
import { open } from '@tenphi/akno-core';

const akno = await open({ aknoPath: '~/Notes' });
const result = await akno.call('recall', { query: 'car insurance renewal' });
```

Exactly one process may hold the write handle. A second `open` on the same state directory returns a
read-only handle and says so, rather than racing a live watcher.

Full documentation: [github.com/tenphi/akno](https://github.com/tenphi/akno#readme)

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
