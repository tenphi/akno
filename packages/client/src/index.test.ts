import { describe, expect, it } from 'vitest';
import { defaultSocketPath } from './index.ts';

describe('defaultSocketPath', () => {
  it('uses the same Linux runtime default as the service configuration', () => {
    expect(
      defaultSocketPath({
        platform: 'linux',
        homeDir: '/home/invented',
        env: { XDG_RUNTIME_DIR: '/invented/run' },
      }),
    ).toBe('/invented/run/akno/akno.sock');
  });

  it('keeps AKNO_SOCKET above the platform default', () => {
    expect(
      defaultSocketPath({
        platform: 'linux',
        homeDir: '/home/invented',
        env: { AKNO_SOCKET: '/invented/override.sock', XDG_RUNTIME_DIR: '/invented/run' },
      }),
    ).toBe('/invented/override.sock');
  });
});
