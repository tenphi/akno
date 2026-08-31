import { describe, expect, it } from 'vitest';
import type { AknoConfig, ResolvedModelRole, ResolvedProvider } from '@tenphi/akno-core';
import { configForOutput, redactSecrets } from './config-cmd.ts';

const provider: ResolvedProvider = {
  name: 'vulpine',
  baseUrl: 'https://models.example.test/v1',
  apiKey: 'sk-invented-fixture-key',
  headers: {
    Authorization: 'Bearer invented-header-secret',
    'X-Fixture-Key': 'invented-gateway-secret',
  },
  api: 'responses',
  configuredApi: 'responses',
  apiResolution: 'explicit',
  apiResolutionError: null,
  maxRetries: 2,
};

const maintenance: ResolvedModelRole = {
  role: 'maintenance',
  provider,
  id: 'zephyr-fixture-model',
  enabled: true,
  requested: true,
  timeoutMs: 120_000,
  unavailableReason: null,
};

describe('config output redaction', () => {
  it('projects nested maintenance providers without their credentials', () => {
    const config = {
      providers: { vulpine: provider },
      models: { derive: { ...maintenance, role: 'derive' } },
      maintenance: { model: maintenance },
    } as unknown as AknoConfig;

    const output = configForOutput(config) as {
      providers: Record<string, Record<string, unknown>>;
      models: Record<string, Record<string, unknown>>;
      maintenance: { model: Record<string, unknown> };
    };
    const serialized = JSON.stringify(output);

    expect(output.providers.vulpine).toMatchObject({
      apiKey: '<set>',
      headers: ['Authorization', 'X-Fixture-Key'],
    });
    expect(output.models.derive.provider).toBe('vulpine');
    expect(output.maintenance.model.provider).toBe('vulpine');
    expect(serialized).not.toContain('sk-invented-fixture-key');
    expect(serialized).not.toContain('invented-header-secret');
    expect(serialized).not.toContain('invented-gateway-secret');
  });

  it('fails closed for future nested secret-shaped fields', () => {
    expect(
      redactSecrets({
        plugin: {
          access_token: 'invented-access-token',
          clientSecret: 'invented-client-secret',
          password: null,
          label: 'safe label',
        },
      }),
    ).toEqual({
      plugin: {
        access_token: '<set>',
        clientSecret: '<set>',
        password: null,
        label: 'safe label',
      },
    });
  });

  it('redacts resolved HTTP bearer credentials', () => {
    const output = configForOutput({
      providers: {},
      models: {},
      maintenance: { model: null },
      server: {
        httpAccess: [
          {
            name: 'vulpine-agent',
            token: 'invented-http-secret-1111',
            tokenEnv: 'AKNO_HTTP_AGENT_TOKEN',
            actor: 'agent',
            allow: ['recall'],
          },
        ],
      },
    } as unknown as AknoConfig) as { server: { httpAccess: { token: string }[] } };

    expect(output.server.httpAccess[0]!.token).toBe('<set>');
    expect(JSON.stringify(output)).not.toContain('invented-http-secret-1111');
  });
});
