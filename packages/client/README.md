# @tenphi/akno-client

A thin typed client for a running [Akno](https://github.com/tenphi/akno) service — the same interface as
`@tenphi/akno-core`, with **no native dependencies**.

That is the point of it. A Linux container can reach a macOS host over the loopback HTTP door, or a local
process can reach the Unix socket, and neither one pulls `better-sqlite3` into its build. The knowledge base
and the index never enter the caller's sandbox, which is also what keeps Akno's single-writer property
intact.

```ts
import { connect } from '@tenphi/akno-client';

const akno = await connect({ socket: '~/.akno/akno.sock' });
const result = await akno.call('recall', { query: 'car insurance renewal' });

// A host may conservatively prepare evidence before its own model handles a turn.
const context = await akno.context({
  profile: 'auto_recall',
  query: 'When does the Zephyr QX-100 warranty end?',
  budget: 1200,
});
```

Schemas and error codes come from
[`@tenphi/akno-protocol`](https://www.npmjs.com/package/@tenphi/akno-protocol), so a call that is invalid
here is invalid in-process too, and fails the same way.

Full documentation: [github.com/tenphi/akno](https://github.com/tenphi/akno#readme)

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
