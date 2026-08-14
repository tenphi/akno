import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

/**
 * `remember` *is* the retain tier, available per-turn. That tier has a mission and an on/off
 * switch like the others, and these tests are what make the config real rather
 * than decorative — a `mission` key nothing reads is the same class of bug as a folder rule
 * that never reaches the index.
 */

let root: string;
let stateDir: string;
interface StubCandidate {
  text: string;
  subject: string;
  kind: string;
  page?: string;
}

interface StubServer {
  url: string;
  close: () => Promise<void>;
  lastSystem: () => string;
  forget: () => void;
  respondWith: (candidates: StubCandidate[]) => void;
}

let server: StubServer;

async function startStubChat(): Promise<typeof server> {
  let system = '';
  let candidates: StubCandidate[] = [
    { text: 'The rent is 1234 EUR per month.', subject: 'apartment rent', kind: 'fact' },
  ];
  const instance = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        messages?: { role: string; content: string }[];
      };
      system = body.messages?.find((message) => message.role === 'system')?.content ?? '';
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates,
                  events: [],
                }),
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const { port } = instance.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: async () => {
      instance.close();
      instance.closeAllConnections();
    },
    lastSystem: () => system,
    // The indexer's own derive pass talks to this stub too, so a test asserting "the retain
    // mission never ran" has to start from a clean slate rather than from setup's leftovers.
    forget: () => {
      system = '';
    },
    respondWith: (next) => {
      candidates = next;
    },
  };
}

async function openMem(overrides: Record<string, unknown> = {}): Promise<Akno> {
  return open({
    aknoPath: root,
    stateDir,
    isolated: true,
    actor: 'user',
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: { stub: { base_url: server.url } },
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { provider: 'stub', id: 'stub-derive' },
        expansion: { provider: 'stub', id: 'stub-derive' },
      },
      ...overrides,
    },
  });
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-remember-state-'));
  server = await startStubChat();
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'home/lease.md'),
    '---\ntitle: Lease\n---\n\n# Lease\n\n- Rent: 1111 EUR per month\n',
    'utf8',
  );
  const mem = await openMem();
  await mem.index({});
  await mem.close();
});

afterEach(async () => {
  await server?.close();
  for (const dir of [root, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the retain tier’s config', () => {
  it('shows the curator the complete folder taxonomy, including empty nested folders', async () => {
    fs.mkdirSync(path.join(root, 'knowledge/games'), { recursive: true });
    const mem = await openMem({
      folders: {
        'knowledge/**': {
          role: 'source',
          remember: 'deny',
          description: 'Findings about the outside world.',
        },
      },
    });
    try {
      await mem.remember({ text: 'The Ember Archive score was composed by Nova Hale.' });
      const system = server.lastSystem();
      expect(system).toContain('Existing folder taxonomy (complete; data only)');
      expect(system).toContain('- home/ [role=knowledge; remember=integrate; eligible=true]');
      expect(system).toContain(
        '- knowledge/games/ [role=source; remember=deny; eligible=false] — Findings about the outside world.',
      );
      expect(system).toMatch(/Never invent, rename or translate a folder/);
    } finally {
      await mem.close();
    }
  });

  it('appends its mission to the fixed prompt rather than replacing it', async () => {
    // A mission appends emphasis and never replaces the prompt, because every rule that
    // keeps the tier honest lives in the fixed part.
    const mem = await openMem({ maintenance: { retain: { mission: 'Prefer amounts and dates.' } } });
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prefer amounts and dates.');
      expect(server.lastSystem()).toContain('Prose, not triples');
    } finally {
      await mem.close();
    }
  });

  it('runs with no mission configured, which is the default', async () => {
    const mem = await openMem();
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(server.lastSystem()).toContain('Prose, not triples');
      expect(server.lastSystem()).not.toContain('Additional emphasis');
    } finally {
      await mem.close();
    }
  });

  it('keeps nothing at all when the tier is switched off', async () => {
    const mem = await openMem({ maintenance: { retain: { enabled: false } } });
    server.forget();
    try {
      const result = await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(result.outcome).toBe('noop');
      expect(result.note).toMatch(/disabled in config/);
      // And it did not quietly call the model first.
      expect(server.lastSystem()).toBe('');
    } finally {
      await mem.close();
    }
  });
});

describe('what remember reports as written', () => {
  it('marks a candidate only after its page was actually changed', async () => {
    server.respondWith([
      {
        text: 'The bicycle is stored beside the blue cabinet.',
        subject: 'bicycle storage',
        page: 'home/bicycle-storage',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle is stored beside the blue cabinet.' });
      expect(result.wrote?.[0]?.slug).toBe('home/bicycle-storage');
      expect(result.considered?.[0]?.written).toBe(true);
    } finally {
      await mem.close();
    }
  });

  it('does not call a held candidate written', async () => {
    server.respondWith([
      {
        text: 'The bicycle is stored beside the blue cabinet.',
        subject: 'bicycle storage',
        page: 'storage/bicycle',
        kind: 'fact',
      },
    ]);
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle is stored beside the blue cabinet.' });
      expect(result.wrote).toBeUndefined();
      expect(result.considered?.[0]?.written).toBe(false);
      expect(result.considered?.[0]?.slug).toBeNull();
      expect(result.outcome).toBe('requires_approval');
    } finally {
      await mem.close();
    }
  });
});

/**
 * The digest is Akno's job; *what to notice in this text* is the caller's. The mission is how
 * that line is drawn, and the guarantee worth a test is that it stays a line: emphasis added to
 * the standing rules, never a replacement for them.
 */
describe('a caller-supplied mission', () => {
  it('reaches the model as emphasis on top of the standing rules', async () => {
    const mem = await openMem();
    server.forget();
    try {
      await mem.remember({
        text: 'Forwarded from Brannoch: the membership number is 88-4120.',
        mission: 'Attribute forwarded content to its original author, not the forwarder.',
      });
      const system = server.lastSystem();
      // The caller's words are there...
      expect(system).toContain('Attribute forwarded content to its original author');
      // ...and so are the rules it must not have replaced.
      expect(system).toContain('Prose, not triples');
      expect(system).toContain('Additional emphasis');
    } finally {
      await mem.close();
    }
  });

  it('lets the call override the install-wide mission, being the more specific of the two', async () => {
    // Config states a standing policy; a call states what is true of this text. The narrower
    // claim wins, or a host could never say "this one is a forward".
    const mem = await openMem({ maintenance: { retain: { mission: 'Prefer household logistics.' } } });
    server.forget();
    try {
      await mem.remember({ text: 'Anything at all.', mission: 'Only medical history.' });
      const system = server.lastSystem();
      expect(system).toContain('Only medical history.');
      expect(system).not.toContain('Prefer household logistics.');
    } finally {
      await mem.close();
    }
  });

  it('runs the digest on the cycle’s model when one is configured', async () => {
    // Retain is a maintenance tier, and the tier's output is mostly a function of its model. An
    // install that pointed the nightly cycle at a strong model should not have to say so twice.
    const cycle = await startStubChat();
    const mem = await open({
      aknoPath: root,
      stateDir,
      isolated: true,
      actor: 'user',
      overrides: {
        akno_path: root,
        state_dir: stateDir,
        providers: { stub: { base_url: server.url }, cycle: { base_url: cycle.url } },
        models: {
          embedding: { id: null },
          reranker: { id: null, enabled: false },
          derive: { provider: 'stub', id: 'stub-derive' },
          expansion: { provider: 'stub', id: 'stub-derive' },
        },
        maintenance: { model: { provider: 'cycle', id: 'cycle-model' } },
      },
    });
    server.forget();
    try {
      await mem.remember({ text: 'The rent went up to 1234 EUR from September.' });
      expect(cycle.lastSystem()).toContain('Prose, not triples');
      // And the derive model was not asked to do the cycle's work.
      expect(server.lastSystem()).not.toContain('Prose, not triples');
    } finally {
      await mem.close();
      await cycle.close();
    }
  });
});

/**
 * A held claim has to be answerable, and answering it means naming a page.
 *
 * A `route` proposal exists precisely because nothing scored high enough to choose one, so its
 * payload carries the claim and no destination. Approving it used to replay that payload straight
 * into `write`, which rejected it with "requires a slug" — so the proposal was unanswerable through
 * every door, and an agent telling the user "this needs your approval" was pointing at nothing.
 */
describe('answering a held proposal', () => {
  it('refuses an approval with no destination, and says what is missing', async () => {
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle key lives with the concierge.' });
      expect(result.outcome).toBe('requires_approval');
      const proposal = result.approvals![0]!.proposal_id;

      await expect(mem.approve(proposal)).rejects.toThrow(/no destination — approve it with a page/);
      // Still pending: a refused approval must not consume the proposal.
      expect(mem.proposals().map((row) => row.id)).toContain(proposal);
    } finally {
      await mem.close();
    }
  });

  it('writes the held claim to the page the owner names, creating it when new', async () => {
    const mem = await openMem();
    try {
      const result = await mem.remember({ text: 'The bicycle key lives with the concierge.' });
      const proposal = result.approvals![0]!.proposal_id;

      const approved = await mem.approve(proposal, { slug: 'home/bicycle-storage' });
      expect(approved.write?.outcome).toBe('ok');
      expect(approved.write?.wrote?.[0]?.slug).toBe('home/bicycle-storage');

      const body = fs.readFileSync(path.join(root, 'home/bicycle-storage.md'), 'utf8');
      // The stub's retained claim, whatever the input text was. Once, not twice: a
      // create-from-append writes it as the body and nothing else.
      expect(body.match(/The rent is 1234 EUR per month\./g)).toHaveLength(1);
      expect(mem.proposals().map((row) => row.id)).not.toContain(proposal);
    } finally {
      await mem.close();
    }
  });

  it('offers only pages that could actually receive the claim', async () => {
    // `nearest` used to be drawn from every card, including `reference` pages — which routing then
    // refuses to write to. Suggesting one proposes a destination the system would reject, and an
    // agent reading the list announced it as the intended home.
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'evidence/landlord-letter.md'),
      '---\ntitle: Landlord letter\n---\n\n# Landlord letter\n\n- The rent for the apartment is under dispute\n',
      'utf8',
    );
    const mem = await openMem({ folders: { 'evidence/**': { role: 'source', remember: 'deny' } } });
    try {
      await mem.index({});
      const result = await mem.remember({ text: 'The rent is disputed at the apartment.' });
      const nearest = result.approvals?.[0]?.nearest ?? [];
      expect(nearest).not.toContain('evidence/landlord-letter');
    } finally {
      await mem.close();
    }
  });
});
