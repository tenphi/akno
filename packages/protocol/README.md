# @tenphi/akno-protocol

The [Akno](https://github.com/tenphi/akno) op registry, zod schemas and wire format — the single source of
truth every door is generated from.

Akno exposes the same operations three ways: in-process, over a Unix socket, and over MCP. All three are
generated from this registry, so an op's input schema, output schema, description and error codes are stated
once. A call that is invalid over MCP is invalid in-process, and fails identically.

This package exists so `@tenphi/akno-client` can share schemas with `@tenphi/akno-core` without pulling
`better-sqlite3` and `sqlite-vec` into a host's build. Its only dependency is `zod`.

```ts
import { OPS, OP_NAMES, AknoError } from '@tenphi/akno-protocol';

OPS.recall.input.parse({ query: 'car insurance renewal' });
```

Full documentation: [github.com/tenphi/akno](https://github.com/tenphi/akno#readme)

## License

PolyForm Noncommercial License 1.0.0 © Andrey Yamanov — noncommercial use only.
