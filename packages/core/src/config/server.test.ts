import { describe, expect, it } from 'vitest';
import { ConfigDoc } from './schema.ts';

describe('server configuration', () => {
  it('lets the public HTTP policy narrow to reads but never grant a write', () => {
    expect(ConfigDoc.safeParse({ server: { http_public_allow: ['recall', 'read'] } }).success).toBe(true);
    expect(ConfigDoc.safeParse({ server: { http_public_allow: ['read', 'write'] } }).success).toBe(false);
  });
});
