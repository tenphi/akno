import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SpawnSyncReturns } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  installSystemdService,
  isCompatibleAknoHello,
  readSystemdInstallTarget,
  systemdInstallPlan,
  systemdPaths,
  systemdUnit,
  systemdTimer,
  uninstallSystemdService,
  type SystemdServiceDefinition,
} from './service-systemd.ts';

const definition: SystemdServiceDefinition = {
  label: 'dev.akno-test',
  node: '/invented/$runtime/bin/node',
  script: '/invented/bin/akno $service with spaces',
  args: [
    'serve',
    '--akno-path',
    '/invented/base %h/$notes',
    '--http',
    '127.0.0.1:4111',
    'quote"slash\\line/$value',
  ],
  environment: { AKNO_CONFIG: '/invented/$config/config.jsonc' },
};

describe('systemd user service definitions', () => {
  it('renders a restarting service with safely escaped explicit arguments', () => {
    const rendered = systemdUnit(definition);

    expect(rendered).toContain('Restart=always');
    expect(rendered).toContain('WantedBy=default.target');
    expect(rendered).toContain(
      'ExecStart="/invented/$$runtime/bin/node" "/invented/bin/akno $$service with spaces" "serve" "--akno-path" "/invented/base %%h/$$notes" "--http" "127.0.0.1:4111" "quote\\"slash\\\\line/$$value"',
    );
    expect(rendered).toContain('Environment="AKNO_CONFIG=/invented/$config/config.jsonc"');
  });

  it('requires a compatible Akno hello rather than treating any listener as ready', () => {
    expect(isCompatibleAknoHello('not Akno\n')).toBe(false);
    expect(
      isCompatibleAknoHello(
        `${JSON.stringify({
          hello: 'akno',
          protocol: 1,
          version: '0.1.0',
          writable: true,
          akno_path: '/invented/base',
          ops: [],
        })}\n`,
      ),
    ).toBe(true);
    expect(
      isCompatibleAknoHello(
        `${JSON.stringify({
          hello: 'akno',
          protocol: 999,
          version: '0.1.0',
          writable: true,
          akno_path: '/invented/base',
          ops: [],
        })}\n`,
      ),
    ).toBe(false);
  });

  it('renders persistent nightly and missed-run timers at exact local times', () => {
    expect(systemdTimer('dev.akno-test.dream', 3, 0)).toContain('OnCalendar=*-*-* 03:00:00');
    const health = systemdTimer('dev.akno-test.dream-health', 5, 5);
    expect(health).toContain('OnCalendar=*-*-* 05:05:00');
    expect(health).toContain('Persistent=true');
    expect(health).toContain('Unit=dev.akno-test.dream-health.service');
    expect(health).toContain('WantedBy=timers.target');
  });

  it('rejects control characters instead of emitting ambiguous directives', () => {
    expect(() => systemdUnit({ ...definition, args: ['serve\nExecStart=/invented/other'] })).toThrow(
      /control character/,
    );
  });
});

describe('systemd install orchestration', () => {
  it('atomically replaces the install target with mode 0600', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-manifest-test-'));
    const target = systemdPaths('dev.akno-test', root).target;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'old target\n', { mode: 0o644 });
    const renameSync = fs.renameSync.bind(fs);
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
      expect(path.dirname(source.toString())).toBe(path.dirname(target));
      expect(destination).toBe(target);
      expect(JSON.parse(fs.readFileSync(source, 'utf8'))).toEqual({
        aknoPath: '/invented/base',
        stateDir: '/invented/state',
        socketPath: '/invented/state/akno.sock',
        configPath: null,
      });
      expect(fs.statSync(source).mode & 0o777).toBe(0o600);
      expect(fs.readFileSync(target, 'utf8')).toBe('old target\n');
      renameSync(source, destination);
    });

    try {
      await installSystemdService({
        label: 'dev.akno-test',
        node: '/invented/bin/node',
        script: '/invented/bin/akno',
        serviceArgs: ['serve'],
        dreamArgs: ['dream'],
        healthArgs: ['dream', 'notify'],
        dreamHour: 3,
        dream: false,
        socketPath: '/invented/state/akno.sock',
        target: {
          aknoPath: '/invented/base',
          stateDir: '/invented/state',
          socketPath: '/invented/state/akno.sock',
          configPath: null,
        },
        configHome: root,
        systemctl: (args) =>
          ({ status: args[0] === 'is-active' ? 3 : 0, stdout: '', stderr: '' }) as SpawnSyncReturns<string>,
        waitForReady: async () => true,
      });

      expect(rename).toHaveBeenCalledOnce();
      expect(fs.statSync(target).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(path.dirname(target)).some((entry) => entry.endsWith('.tmp'))).toBe(false);
    } finally {
      rename.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reloads, enables schedules, restarts the main service, and waits for readiness', () => {
    expect(systemdInstallPlan('dev.akno-test', true)).toEqual([
      ['daemon-reload'],
      ['enable', 'dev.akno-test.service'],
      ['restart', 'dev.akno-test.service'],
      ['enable', '--now', 'dev.akno-test.dream.timer', 'dev.akno-test.dream-health.timer'],
    ]);
  });

  it('disables stale schedules when installing with --no-dream', () => {
    expect(systemdInstallPlan('dev.akno-test', false)).toEqual([
      ['disable', '--now', 'dev.akno-test.dream.timer', 'dev.akno-test.dream-health.timer'],
      ['daemon-reload'],
      ['enable', 'dev.akno-test.service'],
      ['restart', 'dev.akno-test.service'],
    ]);
  });

  it('is idempotent in an isolated config and enables timers only after readiness', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-test-'));
    const events: string[] = [];
    const systemctl = vi.fn((args: string[]) => {
      events.push(args.join(' '));
      return { status: 0, stdout: '', stderr: '' } as SpawnSyncReturns<string>;
    });
    const options = {
      label: 'dev.akno-test',
      node: '/invented/bin/node',
      script: '/invented/bin/akno',
      serviceArgs: ['serve', '--akno-path', '/invented/base'],
      dreamArgs: ['dream', '--scheduled', '--akno-path', '/invented/base'],
      healthArgs: ['dream', 'notify', '--schedule-health', '--akno-path', '/invented/base'],
      dreamHour: 3,
      dream: true,
      socketPath: '/invented/state/akno.sock',
      target: {
        aknoPath: '/invented/base',
        stateDir: '/invented/state',
        socketPath: '/invented/state/akno.sock',
        configPath: '/invented/$config/config.jsonc',
      },
      configHome: root,
      systemctl,
      waitForReady: async () => {
        events.push('ready');
        return true;
      },
    };

    await installSystemdService(options);
    await installSystemdService(options);
    const paths = systemdPaths(options.label, root);
    expect(fs.readFileSync(paths.service, 'utf8')).toContain('"--akno-path" "/invented/base"');
    expect(fs.readFileSync(paths.service, 'utf8')).toContain(
      'Environment="AKNO_CONFIG=/invented/$config/config.jsonc"',
    );
    expect(readSystemdInstallTarget(options.label, root)).toEqual(options.target);
    expect(events.slice(0, 5)).toEqual([
      'daemon-reload',
      'enable dev.akno-test.service',
      'restart dev.akno-test.service',
      'ready',
      'enable --now dev.akno-test.dream.timer dev.akno-test.dream-health.timer',
    ]);

    uninstallSystemdService(options.label, root, systemctl);
    uninstallSystemdService(options.label, root, systemctl);
    expect(fs.existsSync(paths.service)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not fail a first --no-dream install because absent timers cannot be disabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-no-timers-test-'));
    const systemctl = vi.fn((args: string[]) => ({
      status: args[0] === 'disable' ? 1 : args[0] === 'is-active' ? 3 : 0,
      stdout: '',
      stderr: args[0] === 'disable' ? 'unit does not exist' : '',
    })) as unknown as (args: string[]) => SpawnSyncReturns<string>;
    await expect(
      installSystemdService({
        label: 'dev.akno-test',
        node: '/invented/bin/node',
        script: '/invented/bin/akno',
        serviceArgs: ['serve'],
        dreamArgs: ['dream'],
        healthArgs: ['dream', 'notify'],
        dreamHour: 3,
        dream: false,
        socketPath: '/invented/state/akno.sock',
        target: {
          aknoPath: '/invented/base',
          stateDir: '/invented/state',
          socketPath: '/invented/state/akno.sock',
          configPath: null,
        },
        configHome: root,
        systemctl,
        waitForReady: async () => true,
      }),
    ).resolves.toBeDefined();
    expect(systemctl).not.toHaveBeenCalledWith(expect.arrayContaining(['disable']));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps schedule units when disabling them fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-disable-test-'));
    const paths = systemdPaths('dev.akno-test', root);
    fs.mkdirSync(paths.directory, { recursive: true });
    fs.writeFileSync(paths.dreamService, 'invented unit');
    const systemctl = vi.fn((args: string[]) => ({
      status: args[0] === 'disable' ? 1 : 0,
      stdout: '',
      stderr: args[0] === 'disable' ? 'invented disable failure' : '',
    })) as unknown as (args: string[]) => SpawnSyncReturns<string>;

    await expect(
      installSystemdService({
        label: 'dev.akno-test',
        node: '/invented/bin/node',
        script: '/invented/bin/akno',
        serviceArgs: ['serve'],
        dreamArgs: ['dream'],
        healthArgs: ['dream', 'notify'],
        dreamHour: 3,
        dream: false,
        socketPath: '/invented/state/akno.sock',
        target: {
          aknoPath: '/invented/base',
          stateDir: '/invented/state',
          socketPath: '/invented/state/akno.sock',
          configPath: null,
        },
        configHome: root,
        systemctl,
        waitForReady: async () => true,
      }),
    ).rejects.toThrow(/disable.*failed/);
    expect(fs.existsSync(paths.dreamService)).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not fail cleanup by resetting units that have no failed state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-reset-test-'));
    const paths = systemdPaths('dev.akno-test', root);
    fs.mkdirSync(paths.directory, { recursive: true });
    fs.writeFileSync(paths.service, 'invented unit');
    const systemctl = vi.fn((args: string[]) => ({
      status: args[0] === 'reset-failed' ? 1 : args[0] === 'is-failed' ? 1 : 0,
      stdout: '',
      stderr: args[0] === 'reset-failed' ? 'unit not loaded' : '',
    })) as unknown as (args: string[]) => SpawnSyncReturns<string>;

    expect(() => uninstallSystemdService('dev.akno-test', root, systemctl)).not.toThrow();
    expect(systemctl).not.toHaveBeenCalledWith(expect.arrayContaining(['reset-failed']));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps installed files when uninstall cannot stop the units', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-systemd-uninstall-test-'));
    const paths = systemdPaths('dev.akno-test', root);
    fs.mkdirSync(paths.directory, { recursive: true });
    fs.writeFileSync(paths.service, 'invented unit');
    const systemctl = vi.fn(() => ({
      status: 1,
      stdout: '',
      stderr: 'invented stop failure',
    })) as unknown as (args: string[]) => SpawnSyncReturns<string>;

    expect(() => uninstallSystemdService('dev.akno-test', root, systemctl)).toThrow(/disable.*failed/);
    expect(fs.existsSync(paths.service)).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
