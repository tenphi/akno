import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('platform-aware configuration paths', () => {
  it('uses Linux XDG state and runtime defaults when no Akno override is set', () => {
    const root = inventedDirectory('akno-paths-kb-');
    const xdgRoot = inventedDirectory('akno-paths-xdg-');
    const config = loadConfig({
      isolated: true,
      platform: 'linux',
      homeDir: '/home/invented',
      env: {
        XDG_STATE_HOME: path.join(xdgRoot, 'state'),
        XDG_RUNTIME_DIR: path.join(xdgRoot, 'run'),
      },
      overrides: { akno_path: root },
    });

    expect(config.stateDir).toBe(path.join(xdgRoot, 'state', 'akno'));
    expect(config.socketPath).toBe(path.join(xdgRoot, 'run', 'akno', 'akno.sock'));
  });

  it('discovers the Linux machine config under XDG_CONFIG_HOME', () => {
    const root = inventedDirectory('akno-paths-kb-');
    const xdgRoot = inventedDirectory('akno-paths-xdg-');
    const configDir = path.join(xdgRoot, 'config', 'akno');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ akno_path: root }), 'utf8');

    const config = loadConfig({
      platform: 'linux',
      homeDir: '/home/invented',
      // Keep the assertion about discovery while preventing a real checkout-local
      // `akno_path` from becoming this test's resolved value.
      overrides: { akno_path: root },
      env: {
        // Machine-config discovery is the subject of this test. A checkout's gitignored
        // `.env` must not select a different config, path, or isolation mode first.
        AKNO_CONFIG: '',
        AKNO_ISOLATED: '',
        AKNO_PATH: '',
        AKNO_STATE_DIR: '',
        XDG_CONFIG_HOME: path.join(xdgRoot, 'config'),
        XDG_STATE_HOME: path.join(xdgRoot, 'state'),
      },
    });

    expect(config.aknoPath).toBe(root);
    expect(config.sources).toContain(path.join(configDir, 'config.json'));
  });

  it('keeps explicit environment paths above machine config and platform defaults', () => {
    const root = inventedDirectory('akno-paths-kb-');
    const files = inventedDirectory('akno-paths-config-');
    const configPath = path.join(files, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        akno_path: '/invented/file-knowledge-base',
        state_dir: '/invented/file-state',
        server: { socket: '/invented/file.sock' },
      }),
      'utf8',
    );

    const config = loadConfig({
      platform: 'linux',
      homeDir: '/home/invented',
      env: {
        AKNO_CONFIG: configPath,
        AKNO_PATH: root,
        AKNO_STATE_DIR: '/invented/env-state',
        AKNO_SOCKET: '/invented/env.sock',
        XDG_RUNTIME_DIR: '/invented/run',
      },
    });

    expect(config.aknoPath).toBe(root);
    expect(config.stateDir).toBe('/invented/env-state');
    expect(config.socketPath).toBe('/invented/env.sock');
  });

  it('resolves an explicit relative socket against the configured state directory', () => {
    const root = inventedDirectory('akno-paths-kb-');
    const config = loadConfig({
      isolated: true,
      platform: 'linux',
      env: {},
      overrides: {
        akno_path: root,
        state_dir: '/invented/state',
        server: { socket: 'custom.sock' },
      },
    });

    expect(config.socketPath).toBe('/invented/state/custom.sock');
  });
});

function inventedDirectory(prefix: string): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(target);
  return target;
}
