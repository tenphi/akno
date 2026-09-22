import { describe, expect, it } from 'vitest';
import { FolderInput, ForgetInput, MoveInput, WriteInput } from './index.ts';

describe('mutation idempotency keys', () => {
  it.each([
    ['write', WriteInput, { slug: 'home/zephyr', content: 'Zephyr QX-100.' }],
    ['folder', FolderInput, { path: 'research', description: 'Invented research.' }],
    ['move', MoveInput, { from: 'home/zephyr', to: 'archive/zephyr' }],
    ['forget', ForgetInput, { slug: 'home/zephyr' }],
  ] as const)('accepts the shared key contract for %s', (_name, schema, input) => {
    expect(schema.parse({ ...input, idempotency_key: 'retry.2026-09-22:1111' })).toMatchObject({
      idempotency_key: 'retry.2026-09-22:1111',
    });
    expect(schema.safeParse({ ...input, idempotency_key: 'not allowed' }).success).toBe(false);
    expect(schema.safeParse({ ...input, idempotency_key: `x${'1'.repeat(200)}` }).success).toBe(false);
  });
});
