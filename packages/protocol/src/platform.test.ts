import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultPlatformPaths } from './platform.ts';

describe('platform defaults', () => {
  it('preserves the macOS state, config, and socket locations', () => {
    expect(defaultPlatformPaths({ platform: 'darwin', env: {}, homeDir: '/Users/invented' })).toEqual({
      configDir: '/Users/invented/.akno',
      stateDir: '/Users/invented/.akno',
      socketPath: '/Users/invented/.akno/akno.sock',
    });
  });

  it('uses Linux XDG config, state, and runtime locations', () => {
    expect(
      defaultPlatformPaths({
        platform: 'linux',
        env: {
          XDG_CONFIG_HOME: '/invented/config',
          XDG_STATE_HOME: '/invented/state',
          XDG_RUNTIME_DIR: '/invented/run',
        },
        homeDir: '/home/invented',
      }),
    ).toEqual({
      configDir: path.join('/invented/config', 'akno'),
      stateDir: path.join('/invented/state', 'akno'),
      socketPath: path.join('/invented/run', 'akno', 'akno.sock'),
    });
  });

  it('uses Linux XDG home fallbacks and keeps the socket in private state without a runtime directory', () => {
    expect(defaultPlatformPaths({ platform: 'linux', env: {}, homeDir: '/home/invented' })).toEqual({
      configDir: '/home/invented/.config/akno',
      stateDir: '/home/invented/.local/state/akno',
      socketPath: '/home/invented/.local/state/akno/akno.sock',
    });
  });

  it('ignores empty and relative XDG values instead of resolving them from cwd', () => {
    expect(
      defaultPlatformPaths({
        platform: 'linux',
        env: {
          XDG_CONFIG_HOME: '',
          XDG_STATE_HOME: 'relative-state',
          XDG_RUNTIME_DIR: 'relative-run',
        },
        homeDir: '/home/invented',
      }),
    ).toEqual({
      configDir: '/home/invented/.config/akno',
      stateDir: '/home/invented/.local/state/akno',
      socketPath: '/home/invented/.local/state/akno/akno.sock',
    });
  });
});
