import http from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { parsePage } from '../kb/page.ts';
import { ModelClient } from '../models/client.ts';
import { derivePage } from './derive.ts';

let endpoint: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const server = http.createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Equipment memory.',
                  keywords: ['equipment'],
                  facts: [
                    {
                      line: 4,
                      claim: 'Bo Winters reports that the Zephyr QX-100 warranty lasts five years.',
                      subject: 'Zephyr QX-100',
                      attribute: 'warranty',
                      value: 'five years',
                    },
                    {
                      line: 7,
                      claim: 'Ada Marlow selected the five-year warranty.',
                      subject: 'Ada Marlow',
                      attribute: 'warranty selection',
                      value: 'five years',
                    },
                    {
                      line: 5,
                      claim: 'The fenced example names the quiet route.',
                      subject: 'fenced example',
                      attribute: 'route',
                      value: 'quiet',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('stub server did not bind');
  endpoint = `http://127.0.0.1:${address.port}/v1`;
  close = async () => {
    server.close();
    server.closeAllConnections();
  };
});

afterAll(async () => close());

it('keeps reports searchable but excludes them from ordinary derived facts', async () => {
  const page = parsePage(
    'memory/equipment.md',
    `# Equipment

<!-- akno:item mem_report v=2 supports=aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided level=1 kind=claim subject=unresolved source-role=external speaker=Bo%20Winters reports=0 commitment=asserted disposition=active polarity=affirmed basis=source_report -->
- **Reported by Bo Winters:** The Zephyr QX-100 warranty lasts five years.

<!-- akno:item mem_decision v=2 supports=dddddddddddd@eeeeeeeeeeee@ffffffffffff@provided level=1 kind=decision subject=unresolved source-role=user speaker=Ada%20Marlow reports=0 commitment=asserted disposition=accepted polarity=affirmed basis=self_attested -->
- Ada Marlow selected the five-year warranty.
`,
  );
  const model = new ModelClient({
    role: 'derive',
    provider: { name: 'stub', baseUrl: endpoint, apiKey: null, headers: {}, maxRetries: 0 },
    id: 'stub',
    enabled: true,
    requested: true,
    timeoutMs: 2000,
    unavailableReason: null,
  });

  const derived = await derivePage(page, model, { summaries: true, facts: true });

  expect(derived.facts.map((fact) => fact.itemId)).toEqual(['mem_decision']);
  expect(derived.facts[0]?.claim).toBe('Ada Marlow selected the five-year warranty.');
});

it('does not give marker semantics to an authored fenced example', async () => {
  const page = parsePage(
    'memory/examples.md',
    `# Examples

\`\`\`md
<!-- akno:observation obs_11111111 v=99 -->
- The fenced example names the quiet route.
\`\`\`
- Ada Marlow selected the five-year warranty.
`,
  );
  const model = new ModelClient({
    role: 'derive',
    provider: { name: 'stub', baseUrl: endpoint, apiKey: null, headers: {}, maxRetries: 0 },
    id: 'stub',
    enabled: true,
    requested: true,
    timeoutMs: 2000,
    unavailableReason: null,
  });

  const derived = await derivePage(page, model, { summaries: true, facts: true });

  expect(derived.facts.map((fact) => fact.line)).toEqual([7, 5]);
});
