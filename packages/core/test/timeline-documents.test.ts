import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../src/index.ts';

let root: string;
let stateDir: string;
let mem: Akno;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-timeline-doc-kb-'));
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-timeline-doc-state-'));
  fs.writeFileSync(
    path.join(root, 'timeline.md'),
    '# Timeline\n\n## 2026\n- **2026-08-03** | Ada Marlow inspected the Zephyr QX-100.\n',
    'utf8',
  );
  mem = await open({
    aknoPath: root,
    stateDir,
    isolated: true,
    overrides: {
      akno_path: root,
      state_dir: stateDir,
      providers: {},
      models: {
        embedding: { id: null },
        reranker: { id: null, enabled: false },
        derive: { id: null },
        expansion: { id: null },
      },
    },
  });
});

afterEach(async () => {
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function write(relPath: string, content: string | Buffer): void {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

describe('orphan document timeline evidence', () => {
  it('keeps extracted document dates distinct from authored events', async () => {
    write(
      'documents/zephyr-service.txt',
      'Service completed on 4 August 2026.\nThe verification phrase is Blackwater silver.',
    );
    await mem.index({});

    const result = await mem.timeline({
      since: '2026-08-04',
      until: '2026-08-04',
      match: 'Service completed',
    });
    expect(result.status).toBe('ok');
    expect(result.events).toEqual([]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: 'document_evidence',
      date: '2026-08-04',
      date_basis: 'extracted',
      path: 'documents/zephyr-service.txt',
      quote: expect.stringContaining('Service completed'),
      text_source: { kind: 'original_text', via: 'plain' },
      availability: { status: 'available' },
    });

    const mixed = await mem.timeline({ since: '2026-08-03', until: '2026-08-04', order: 'oldest' });
    expect(mixed.results.map((entry) => entry.type)).toEqual(['event', 'document_evidence']);
    expect(mixed.events).toHaveLength(1);
    const limited = await mem.timeline({
      since: '2026-08-03',
      until: '2026-08-04',
      order: 'oldest',
      limit: 1,
    });
    expect(limited.total).toBe(2);
    expect(limited.results).toHaveLength(1);
    expect(limited.results[0]?.type).toBe('event');
    expect((await mem.timeline({ source: 'event' })).results.every((entry) => entry.type === 'event')).toBe(
      true,
    );

    const context = await mem.context({ budget: 2000, timeline_days: 1000, structure: false });
    expect(context.timeline.some((entry) => entry.type === 'document_evidence')).toBe(true);
    expect(context.events.every((event) => !('date_basis' in event))).toBe(true);
  });

  it('uses visibly labelled file metadata only when the document states no date', async () => {
    const relPath = 'documents/vulpine-record.bin';
    write(relPath, Buffer.from([1, 2, 3, 4]));
    const modified = new Date('2031-04-05T12:00:00.000Z');
    fs.utimesSync(path.join(root, relPath), modified, modified);
    await mem.index({});

    const result = await mem.timeline({
      source: 'document',
      since: '2031-04-05',
      until: '2031-04-05',
      subject: relPath,
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: 'document_evidence',
      date: '2031-04-05',
      date_basis: 'file_modified',
      path: relPath,
      availability: { status: 'available' },
    });
    expect(result.results[0]?.type === 'document_evidence' ? result.results[0].quote : null).toBeUndefined();
  });

  it('reports retained extracted evidence as degraded and metadata-only identity as unavailable', async () => {
    const extractedPath = 'documents/zephyr-inspection.txt';
    const metadataPath = 'documents/vulpine-sealed.bin';
    write(extractedPath, 'Inspected on 2026-08-06 at Blackwater Bay.');
    write(metadataPath, Buffer.from([5, 6, 7, 8]));
    const modified = new Date('2031-04-07T12:00:00.000Z');
    fs.utimesSync(path.join(root, metadataPath), modified, modified);
    await mem.index({});

    fs.rmSync(path.join(root, extractedPath));
    fs.rmSync(path.join(root, metadataPath));
    await mem.index({});

    const degraded = await mem.timeline({
      source: 'document',
      since: '2026-08-06',
      until: '2026-08-06',
    });
    expect(degraded.status).toBe('degraded');
    expect(degraded.degraded).toContain('document_source_missing');
    expect(degraded.results[0]).toMatchObject({
      type: 'document_evidence',
      date_basis: 'extracted',
      availability: { status: 'degraded', available_from: ['indexed_text'] },
    });

    const unavailable = await mem.timeline({
      source: 'document',
      since: '2031-04-07',
      until: '2031-04-07',
    });
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.results[0]).toMatchObject({
      type: 'document_evidence',
      date_basis: 'file_modified',
      availability: { status: 'unavailable', available_from: [] },
    });
  });

  it('excludes documents once a page owns them', async () => {
    write('documents/zephyr-owned.txt', 'Recorded on 2026-08-08.');
    write('documents/zephyr-owned.md', '# Zephyr owned\n\n![[zephyr-owned.txt]]\n');
    await mem.index({});

    const result = await mem.timeline({
      source: 'document',
      since: '2026-08-08',
      until: '2026-08-08',
    });
    expect(result.status).toBe('empty');
    expect(result.results).toEqual([]);
  });
});
