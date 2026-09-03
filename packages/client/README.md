# @tenphi/akno-client

A thin typed client for a running [Akno](https://github.com/tenphi/akno) service — the same interface as
`@tenphi/akno-core`, with **no native dependencies**.

It requires Node 22.18 or newer and is portable across operating systems.

That is the point of it. A Linux container can reach another host over the HTTP door, or a local
process can reach the Unix socket, and neither one pulls `better-sqlite3` into its build. The knowledge base
and the index never enter the caller's sandbox, which is also what keeps Akno's single-writer property
intact.

```ts
import { connect, isTimelineMemory } from '@tenphi/akno-client';

const akno = await connect(); // Uses the platform Akno runtime socket by default.
const result = await akno.call('recall', {
  query: 'What is planned for the Zephyr QX-100?',
  memory_view: 'planning',
});

// A host may conservatively prepare evidence before its own model handles a turn.
const context = await akno.context({
  profile: 'auto_recall',
  query: 'When does the Zephyr QX-100 warranty end?',
  budget: 1200,
});

// One explicit clock covers authored events, retained world time, and document evidence.
const timeline = await akno.timeline({
  scope: 'future',
  view: 'actionable',
  timezone: 'Europe/Amsterdam',
  order: 'nearest',
});
const retained = timeline.results.filter(isTimelineMemory);

const exact = await akno.read({ slug: 'products/zephyr-qx-100' });
if (exact.status === 'degraded' && exact.degraded?.includes('source_conflict')) {
  // Repair the Markdown conflict and re-index before treating this page as current evidence.
}

// A stable external source can be retained replay-safely without copying stored source bytes.
await akno.retain({
  sources: [
    {
      source_id: 'manual:1111',
      revision: '1',
      input: { page_slug: 'sources/zephyr-manual' },
      retention: { mode: 'extract' },
    },
  ],
});

// HTTP is public read-only on loopback by default. A configured bearer identity
// grants exactly its server-owned actor and operation set.
const remote = await connect({
  http: 'memory.vulpine.test:7777',
  token: process.env.AKNO_HTTP_AGENT_TOKEN,
});
```

Schemas and error codes come from
[`@tenphi/akno-protocol`](https://www.npmjs.com/package/@tenphi/akno-protocol), so a call that is invalid
here is invalid in-process too, and fails the same way.

Full documentation: [github.com/tenphi/akno](https://github.com/tenphi/akno#readme)

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
