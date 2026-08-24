import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AknoError, MCP_SERVER_NAME, OPS, type OpName } from '@tenphi/akno-protocol';
import type { OpInput, OpResult } from '@tenphi/akno-protocol';

/**
 * The stdio MCP door, for third-party agents that speak it:
 *
 *   { "mcpServers": { "memory": { "command": "akno", "args": ["serve", "--mcp"] } } }
 *
 * Every tool is generated from the op registry, so an op cannot exist over the
 * socket and be missing here. Trust is a parameter: `server.mcp_allow` in config
 * decides which ops this door exposes, and denying `forget` to a sandboxed agent
 * needs no second code path.
 */
export async function serveMcp(
  // Ops, not an `Akno`: this door is equally happy in front of an in-process index or of a
  // socket connection to the service that holds the write handle. Nothing here needs more.
  akno: { call<N extends OpName>(op: N, input: OpInput<N>): Promise<OpResult<N>> },
  options: { allow?: string[]; log?: (message: string) => void } = {},
): Promise<{ close(): Promise<void> }> {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: '0.1.0' },
    {
      // Named "memory" and described as memory, deliberately. A model reasons better about a
      // faculty it has than about a product it has been integrated with, and the brand is not
      // a fact it can use: what it needs is that recall is where knowledge of this user lives,
      // and what the status fields mean.
      instructions:
        'This is the user’s long-term memory, stored as a Markdown knowledge base. Use `answer` for a direct ' +
        'factual response grounded entirely in memory, or `recall` when evidence must be inspected, compared, ' +
        'or quoted. Do not call both by default: answer already performs bounded recall and returns compact ' +
        'related identities. Recall’s typed page and document results carry source addresses, so a claim you ' +
        'take from them can be cited and a claim you cannot find in them should not be made. Read `status` on ' +
        'every result: "empty" means the knowledge base ' +
        'genuinely has nothing and you may say so; "degraded" means part of the search stack was ' +
        'missing, so absence is not proven; "unavailable" means the index could not be read. In ' +
        'question mode, `coverage` tells you which parts of the question the results actually cover — ' +
        'do not answer the parts marked false. Values returned under `superseded` are historical, not ' +
        'current.',
    },
  );

  const allowed = (options.allow ?? Object.keys(OPS)) as OpName[];

  for (const name of allowed) {
    const definition = OPS[name];
    if (!definition) continue;

    server.registerTool(
      name,
      {
        title: name,
        description: definition.implemented
          ? definition.description
          : `${definition.description} NOT AVAILABLE in this build — calling it returns not_implemented.`,
        inputSchema: definition.input,
      },
      async (input: unknown) => {
        try {
          const started = performance.now();
          const result = await akno.call(name, input as never);
          options.log?.(`mcp ${name} ${(performance.now() - started).toFixed(1)}ms`);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          const error = AknoError.from(err);
          options.log?.(`mcp ${name} ${error.code}: ${error.message}`);
          // An error returned as content rather than thrown lets the agent read
          // the code and react — the whole point of `degraded` vs `empty`.
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ status: 'error', ...error.toJSON() }, null, 2),
              },
            ],
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return {
    async close(): Promise<void> {
      await server.close();
    },
  };
}
