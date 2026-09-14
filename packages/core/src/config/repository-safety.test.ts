import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('schema integer ceilings in the repository privacy scanner', () => {
  it.each([
    ['schema.json', `{"type":"integer",\n  "maximum": ${Number.MAX_SAFE_INTEGER}\n}`, true],
    ['schema.json', `{"type":"integer",\n  "maximum": ${Number.MAX_SAFE_INTEGER},\n "minimum": 0}`, true],
    ['schema.json', `{"maximum":\n "${Number.MAX_SAFE_INTEGER}"}`, false],
    ['schema.json', `{"value": ${Number.MAX_SAFE_INTEGER}}`, false],
    ['schema.txt', `  "maximum": ${Number.MAX_SAFE_INTEGER}`, false],
    ['schema.json', `  "maximum": ${['1111', '2222', '3333', '4444'].join('')}`, false],
  ] as const)('keeps the exception bound to a numeric maximum property: %s / %s', (name, contents, safe) => {
    const root = mkdtempSync(join(tmpdir(), 'akno-invented-safety-'));
    roots.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config/default.jsonc'), '{}');
    writeFileSync(join(root, 'config/local.example.jsonc'), '{}');
    writeFileSync(join(root, name), contents);
    execFileSync('git', ['add', '.'], { cwd: root });
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../../../../scripts/check-repository-safety.mjs', import.meta.url))],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status).toBe(safe ? 0 : 1);
    if (!safe) {
      expect(result.stderr).toContain('payment-number shape; content redacted');
      expect(result.stderr).not.toContain(String(Number.MAX_SAFE_INTEGER));
    }
  });
});
