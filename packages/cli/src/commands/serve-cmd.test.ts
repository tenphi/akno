import { describe, expect, it } from 'vitest';
import { plist, serviceTargetArgs } from './serve-cmd.ts';

describe('launchd service definitions', () => {
  it('persists an explicitly selected knowledge base and state directory', () => {
    expect(
      serviceTargetArgs({
        'akno-path': '/invented/knowledge-base',
        'state-dir': '/invented/state',
      }),
    ).toEqual(['--akno-path', '/invented/knowledge-base', '--state-dir', '/invented/state']);
  });

  it('marks the nightly cycle as scheduled without baking in maintenance authority', () => {
    const rendered = plist({
      label: 'dev.akno.dream',
      node: '/invented/bin/node',
      script: '/invented/bin/akno',
      args: ['dream', '--scheduled'],
      logDir: '/invented/state/logs',
      calendarHour: 3,
    });

    expect(rendered).toContain('<string>dream</string>');
    expect(rendered).toContain('<string>--scheduled</string>');
    expect(rendered).not.toContain('<string>auto</string>');
    expect(rendered).toContain('<key>Minute</key><integer>0</integer>');
  });

  it('can schedule the missed-cycle health check after the grace boundary', () => {
    const rendered = plist({
      label: 'dev.akno.dream-health',
      node: '/invented/bin/node',
      script: '/invented/bin/akno',
      args: ['dream', 'notify', '--schedule-health'],
      logDir: '/invented/state/logs',
      calendarHour: 5,
      calendarMinute: 5,
    });

    expect(rendered).toContain('<string>notify</string>');
    expect(rendered).toContain('<string>--schedule-health</string>');
    expect(rendered).toContain('<key>Hour</key><integer>5</integer>');
    expect(rendered).toContain('<key>Minute</key><integer>5</integer>');
  });
});
