import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { plist } from './serve-cmd.ts';
import {
  inspectLaunchdJob,
  parseLaunchdPlist,
  parseLoadedLaunchdDefinition,
  reloadLaunchdJob,
  type Launchctl,
} from './service-launchd.ts';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('launchd effective definitions', () => {
  it('parses exact escaped arguments and calendar intervals', () => {
    const definition = parseLaunchdPlist(
      plist({
        label: 'dev.akno.dream',
        node: '/invented/node&runtime',
        script: '/invented/akno<current>.js',
        args: ['dream', '--state-dir', '/invented/private state'],
        logDir: '/invented/logs',
        calendarHour: 3,
        calendarMinute: 15,
      }),
    );
    expect(definition).toEqual({
      arguments: [
        '/invented/node&runtime',
        '/invented/akno<current>.js',
        'dream',
        '--state-dir',
        '/invented/private state',
      ],
      calendar: { hour: 3, minute: 15 },
    });
  });

  it('reads the effective arguments, schedule, and pid from launchctl', () => {
    expect(parseLoadedLaunchdDefinition(loadedOutput('/invented/current.js'))).toEqual({
      arguments: ['/invented/node', '/invented/current.js', 'dream'],
      calendar: { hour: 3, minute: 0 },
      pid: 4242,
    });
  });

  it('detects matching files with stale loaded jobs', () => {
    const target = writeFixture();
    const launchctl = stubLaunchctl({ output: loadedOutput('/invented/stale.js') });
    expect(inspectLaunchdJob('dev.akno.dream', target, launchctl, 501).status).toBe('drifted');
  });

  it('avoids an unnecessary reload when the loaded job already matches', () => {
    const target = writeFixture();
    const calls: string[][] = [];
    const launchctl = stubLaunchctl({ output: loadedOutput('/invented/current.js'), calls });
    const inspected = inspectLaunchdJob('dev.akno.dream', target, launchctl, 501);
    expect(reloadLaunchdJob(inspected, launchctl, 501)).toMatchObject({ reloaded: false, error: null });
    expect(calls).toEqual([['print', 'gui/501/dev.akno.dream']]);
  });

  it('reloads stale jobs and verifies the replacement definition', () => {
    const target = writeFixture();
    const calls: string[][] = [];
    let current = loadedOutput('/invented/stale.js');
    const launchctl: Launchctl = (args) => {
      calls.push(args);
      if (args[0] === 'bootstrap') current = loadedOutput('/invented/current.js');
      return result(0, args[0] === 'print' ? current : '');
    };
    const inspected = inspectLaunchdJob('dev.akno.dream', target, launchctl, 501);
    expect(reloadLaunchdJob(inspected, launchctl, 501)).toMatchObject({
      reloaded: true,
      error: null,
      inspection: { status: 'matching' },
    });
    expect(calls.map((entry) => entry[0])).toEqual(['print', 'bootout', 'bootstrap', 'print']);
  });

  it('never reports a failed replacement as a successful reload', () => {
    const target = writeFixture();
    const launchctl: Launchctl = (args) =>
      args[0] === 'print' ? result(0, loadedOutput('/invented/stale.js')) : result(1, '', 'denied');
    const inspected = inspectLaunchdJob('dev.akno.dream', target, launchctl, 501);
    expect(reloadLaunchdJob(inspected, launchctl, 501)).toMatchObject({
      reloaded: false,
      error: 'dev.akno.dream could not unload',
    });
  });
});

function writeFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-launchd-'));
  roots.push(root);
  const target = path.join(root, 'dev.akno.dream.plist');
  fs.writeFileSync(
    target,
    plist({
      label: 'dev.akno.dream',
      node: '/invented/node',
      script: '/invented/current.js',
      args: ['dream'],
      logDir: '/invented/logs',
      calendarHour: 3,
    }),
  );
  return target;
}

function loadedOutput(script: string): string {
  return `gui/501/dev.akno.dream = {
  state = running
  arguments = {
    /invented/node
    ${script}
    dream
  }
  pid = 4242
  event triggers = {
    trigger => {
      descriptor = {
        "Minute" => 0
        "Hour" => 3
      }
    }
  }
}`;
}

function stubLaunchctl(options: { output: string; calls?: string[][] }): Launchctl {
  return (args) => {
    options.calls?.push(args);
    return result(0, options.output);
  };
}

function result(status: number, stdout = '', stderr = ''): SpawnSyncReturns<string> {
  return { pid: 1, output: [null, stdout, stderr], stdout, stderr, status, signal: null };
}
