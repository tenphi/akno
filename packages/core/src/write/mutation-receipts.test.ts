import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AknoContext } from '../context.ts';
import { openStore } from '../store/db.ts';
import { Journal } from './journal.ts';
import {
  beginMutation,
  executeReplaySafeMutation,
  recoverInterruptedMutationReceipts,
} from './mutation-receipts.ts';

describe('live mutation receipt coordination', () => {
  it('does not recover a call that is active through another handle in this process', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-live-receipt-'));
    const dbPath = path.join(directory, 'akno.db');
    const firstStore = openStore({ dbPath, embeddingDimensions: 8 });
    const firstContext = {
      store: firstStore,
      config: { dbPath },
      actor: 'agent',
      writable: true,
    } as AknoContext;

    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const input = {
      slug: 'home/bo-winters',
      content: 'Bo Winters visited Blackwater Bay.',
      idempotency_key: 'same-process-handle-1',
    };

    const first = executeReplaySafeMutation(firstContext, 'write', input, async (context) => {
      beginMutation(context);
      started();
      await releasePromise;
      const changeId = new Journal(firstStore, directory, path.join(directory, 'trash')).record({
        actor: 'agent',
        op: 'write',
        summary: 'invented concurrency fixture',
        files: [],
        receipt: context.mutationReceipt,
      });
      return { status: 'ok', outcome: 'ok', change_id: changeId };
    });
    await startedPromise;

    const secondStore = openStore({ dbPath, embeddingDimensions: 8 });
    const secondContext = {
      store: secondStore,
      config: { dbPath },
      actor: 'agent',
      writable: true,
    } as AknoContext;
    recoverInterruptedMutationReceipts(secondContext);
    await expect(
      executeReplaySafeMutation(secondContext, 'write', input, async () => ({
        status: 'ok',
        outcome: 'noop',
      })),
    ).rejects.toMatchObject({ code: 'busy' });

    release();
    await expect(first).resolves.toMatchObject({ status: 'ok', outcome: 'ok' });
    secondStore.close();
    firstStore.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
