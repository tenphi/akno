import { describe, expect, it } from 'vitest';
import { validateUnixSocketPath } from './socket.ts';

describe('Unix socket path limits', () => {
  it('accepts the macOS boundary and rejects one byte beyond it', () => {
    expect(() => validateUnixSocketPath(`/${'a'.repeat(102)}`, 'darwin')).not.toThrow();
    expect(() => validateUnixSocketPath(`/${'a'.repeat(103)}`, 'darwin')).toThrow(
      /105 bytes and macOS allows 104/,
    );
  });

  it('accepts the Linux boundary and rejects one byte beyond it', () => {
    expect(() => validateUnixSocketPath(`/${'a'.repeat(106)}`, 'linux')).not.toThrow();
    expect(() => validateUnixSocketPath(`/${'a'.repeat(107)}`, 'linux')).toThrow(
      /109 bytes and Linux allows 108/,
    );
  });

  it('counts UTF-8 bytes rather than JavaScript characters', () => {
    const socketPath = `/${'a'.repeat(99)}é`;
    expect(socketPath.length).toBe(101);
    expect(() => validateUnixSocketPath(socketPath, 'darwin')).not.toThrow();
    expect(() => validateUnixSocketPath(`${socketPath}é`, 'darwin')).toThrow(/105 bytes/);
  });
});
