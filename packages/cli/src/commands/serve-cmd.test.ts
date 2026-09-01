import { describe, expect, it } from 'vitest';
import { effectiveMcpAllow, plist, resolvedServiceConfigPath, serviceTargetArgs } from './serve-cmd.ts';

describe('launchd service definitions', () => {
  it('persists the resolved knowledge base and state directory when no target flags were passed', () => {
    expect(
      serviceTargetArgs({
        aknoPath: '/invented/resolved-knowledge-base',
        stateDir: '/invented/resolved-state',
      }),
    ).toEqual([
      '--akno-path',
      '/invented/resolved-knowledge-base',
      '--state-dir',
      '/invented/resolved-state',
    ]);
  });

  it('resolves a custom config selector before persisting it', () => {
    expect(resolvedServiceConfigPath('config/custom.jsonc', '/invented/checkout', '/invented/home')).toBe(
      '/invented/checkout/config/custom.jsonc',
    );
    expect(resolvedServiceConfigPath('~/.akno/custom.jsonc', '/invented/checkout', '/invented/home')).toBe(
      '/invented/home/.akno/custom.jsonc',
    );
    expect(resolvedServiceConfigPath(undefined, '/invented/checkout', '/invented/home')).toBeNull();
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

describe('MCP forwarding policy', () => {
  it('inherits the service policy and lets an override only narrow it', () => {
    const service = ['recall', 'read'];
    expect(effectiveMcpAllow(service, undefined)).toEqual(service);
    expect(effectiveMcpAllow(service, ['read', 'write'])).toEqual(['read']);
  });

  it('fails closed when an older service did not announce an MCP policy', () => {
    expect(effectiveMcpAllow([], undefined)).toEqual([]);
  });
});
