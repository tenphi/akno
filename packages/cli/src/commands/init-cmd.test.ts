import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAiLunaPreset, type OpenAiLunaPreflightReport } from '@tenphi/akno-core';
import { initCommand, openAiInitPreview, readableKnowledgeBasePath } from './init-cmd.ts';
import type { InitPromptSession } from './init-prompts.ts';

const temporary: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('guided init', () => {
  it('is explicit about authority, model count, and preflight failure', () => {
    const config = openAiLunaPreset({
      aknoPath: '/invented/knowledge-base',
      maintenance: 'autonomous',
    });
    const preview = openAiInitPreview('/invented/knowledge-base', 'autonomous', config, failedPreflight());

    expect(preview).toMatchObject({
      preset: 'openai-luna',
      presetStatus: 'recommended',
      writable: true,
      writeBlocker: 'the requested model preflight did not pass',
      knowledgeBase: { readable: true, willModify: false },
      maintenance: 'autonomous',
      endpointCount: 1,
      modelCount: 2,
      credential: { env: 'AKNO_OPENAI_API_KEY', present: true },
    });
    expect(JSON.stringify(preview)).not.toContain('sk-invented-fixture-key');
  });

  it('rejects a missing knowledge-base folder without throwing', () => {
    expect(readableKnowledgeBasePath('/invented/missing-knowledge-base')).toBe(false);
    expect(readableKnowledgeBasePath('.')).toBe(true);
  });

  it('reports an invalid knowledge-base folder as a usage error', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand([
      '--preset',
      'openai-luna',
      '--akno-path',
      '/invented/missing-knowledge-base',
      '--dry-run',
    ]);

    expect(result).toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('akno_path does not exist: /invented/missing-knowledge-base'),
    );
  });

  it('creates a new machine config without requiring force', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'state', 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const followUps = inertFollowUps();
    const result = await initCommand(
      ['--preset', 'openai-luna', '--akno-path', knowledgeBase, '--maintenance', 'autonomous'],
      { followUps },
    );

    expect(result).toBe(0);
    expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toMatchObject({
      akno_path: knowledgeBase,
      models: {
        embedding: { id: 'text-embedding-3-small' },
        reranker: { id: 'gpt-5.6-luna', top_k: 10, reasoning_effort: 'none' },
      },
      maintenance: { profile: 'autonomous' },
    });
    expect(followUps.index).not.toHaveBeenCalled();
    expect(followUps.recall).not.toHaveBeenCalled();
    expect(followUps.service).not.toHaveBeenCalled();
  });

  it('requires force for an existing config and preserves unrelated keys', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    const original = `${JSON.stringify(
      {
        akno_path: knowledgeBase,
        providers: { local: { base_url: 'http://127.0.0.1:41111/v1' } },
        models: { reranker: { id: 'invented-native-reranker', mode: 'endpoint' } },
        maintenance: { policies: { merge: 'audit' } },
        invented_extension: { keep: true },
      },
      null,
      2,
    )}\n`;
    fs.writeFileSync(target, original, 'utf8');
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const argv = ['--preset', 'openai-luna', '--akno-path', knowledgeBase, '--maintenance', 'review'];

    expect(await initCommand(argv)).toBe(2);
    expect(fs.readFileSync(target, 'utf8')).toBe(original);
    expect(await initCommand([...argv, '--force'])).toBe(0);
    const written = JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, unknown>;
    expect(written).toMatchObject({
      invented_extension: { keep: true },
      providers: { openai: { base_url: 'https://api.openai.com/v1' } },
      models: { reranker: { id: 'gpt-5.6-luna', mode: 'llm' } },
      maintenance: { profile: 'review', policies: { merge: 'audit' } },
    });
    expect(Object.keys(written.providers as Record<string, unknown>)).toEqual(['openai']);
  });

  it('does not write when a requested preflight fails', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.stubEnv('AKNO_OPENAI_API_KEY', '');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand(['--preset', 'openai-luna', '--akno-path', knowledgeBase, '--check']);

    expect(result).toBe(1);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('guides a trusted-agent setup and confirms before writing', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.stubEnv('AKNO_OPENAI_API_KEY', 'sk-invented-fixture-key');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prompt = scriptedPrompt([knowledgeBase, '', '', '', 'n', '', 'n', 'n']);

    const result = await initCommand([], { prompt, platform: 'darwin' });

    expect(result).toBe(0);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toMatchObject({
      akno_path: knowledgeBase,
      maintenance: { profile: 'autonomous' },
    });
    expect(prompt.questions).toEqual([
      'Knowledge-base folder: ',
      'Model setup [1]: ',
      'Usage [1]: ',
      'Maintenance profile [autonomous]: ',
      'Run the content-safe model preflight now? [Y/n]: ',
      'Write this configuration? [Y/n]: ',
      'Build the searchable index now? [y/N]: ',
      'Install the background service and nightly schedule now? [y/N]: ',
    ]);
    expect(prompt.messages).toContain(
      'AKNO_OPENAI_API_KEY is available. Its value will not be printed or stored.',
    );
    expect(JSON.stringify({ questions: prompt.questions, messages: prompt.messages })).not.toContain(
      'sk-invented-fixture-key',
    );
  });

  it('runs separately approved index, recall, and service follow-ups in order', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    const stateDir = path.join(root, 'state');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.stubEnv('AKNO_STATE_DIR', stateDir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prompt = scriptedPrompt([
      knowledgeBase,
      '2',
      '',
      '',
      '',
      'y',
      'y',
      'What is the Zephyr QX-100 warranty?',
      'y',
    ]);
    const calls: string[] = [];
    const followUps = {
      index: vi.fn(async (_argv: string[]) => {
        calls.push('index');
        return 0;
      }),
      recall: vi.fn(async (_argv: string[]) => {
        calls.push('recall');
        return 0;
      }),
      service: vi.fn(async (_argv: string[]) => {
        calls.push('service');
        return 0;
      }),
    };

    const result = await initCommand([], { prompt, followUps, platform: 'darwin' });

    expect(result).toBe(0);
    expect(calls).toEqual(['index', 'recall', 'service']);
    const targetArgs = ['--akno-path', knowledgeBase, '--state-dir', stateDir];
    expect(followUps.index).toHaveBeenCalledWith(targetArgs);
    expect(followUps.recall).toHaveBeenCalledWith(['What is the Zephyr QX-100 warranty?', ...targetArgs]);
    expect(followUps.service).toHaveBeenCalledWith(['install', ...targetArgs]);
    expect(prompt.questions.slice(-4)).toEqual([
      'Build the searchable index now? [y/N]: ',
      'Run a first recall now? [y/N]: ',
      'Recall query: ',
      'Install the background service and nightly schedule now? [y/N]: ',
    ]);
  });

  it('keeps the written config when an approved optional action fails', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prompt = scriptedPrompt([knowledgeBase, '2', '', '', '', 'y']);
    const followUps = inertFollowUps();
    followUps.index.mockResolvedValue(1);

    const result = await initCommand([], { prompt, followUps, platform: 'darwin' });

    expect(result).toBe(1);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toMatchObject({
      akno_path: knowledgeBase,
      maintenance: { profile: 'autonomous' },
    });
    expect(followUps.recall).not.toHaveBeenCalled();
    expect(followUps.service).not.toHaveBeenCalled();
  });

  it('leaves an existing config unchanged when an interactive update is declined', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    const original = `${JSON.stringify({ akno_path: knowledgeBase, invented_extension: true }, null, 2)}\n`;
    fs.writeFileSync(target, original, 'utf8');
    vi.stubEnv('AKNO_CONFIG', target);
    vi.stubEnv('AKNO_OPENAI_API_KEY', '');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prompt = scriptedPrompt([knowledgeBase, '2', '', '', '']);

    const result = await initCommand([], { prompt, platform: 'darwin' });

    expect(result).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe(original);
    expect(prompt.questions.at(-1)).toBe('Apply this configuration update? [y/N]: ');
  });

  it('does not prompt or hang when required arguments are missing outside a terminal', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand([], { interactive: false });

    expect(result).toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining(
        'guided setup requires a terminal; provide --preset <openai-luna|no-model> and --akno-path',
      ),
    );
  });

  it('disables all model roles while retaining dormant provider definitions', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    fs.writeFileSync(
      target,
      `${JSON.stringify(
        {
          akno_path: knowledgeBase,
          providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
          models: { derive: { provider: 'invented', id: 'invented-generative-model' } },
          maintenance: { model: { provider: 'invented', id: 'invented-maintenance-model' } },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    vi.stubEnv('AKNO_CONFIG', target);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const result = await initCommand([
      '--preset',
      'no-model',
      '--akno-path',
      knowledgeBase,
      '--maintenance',
      'audit',
      '--force',
    ]);

    expect(result).toBe(0);
    const written = JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, unknown>;
    expect(written).toMatchObject({
      providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
      models: {
        embedding: { id: null, enabled: false },
        reranker: { id: null, enabled: false },
        derive: { id: null, enabled: false },
        expansion: { id: null, enabled: false },
        answer: { id: null, enabled: false },
        vision: { id: null, enabled: false },
      },
      maintenance: { profile: 'audit', model: null },
    });
    expect(stdout.mock.calls.flat().join('')).toContain(
      'lexical retrieval; every model role disabled; existing provider definitions retained',
    );
    expect(stdout.mock.calls.flat().join('')).toContain(
      'reports only; model-dependent phases are unavailable',
    );
  });

  it('preserves specialist roles when manual setup is selected', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    fs.writeFileSync(
      target,
      `${JSON.stringify(
        {
          akno_path: knowledgeBase,
          write_ids: true,
          providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
          models: { derive: { provider: 'invented', id: 'invented-generative-model' } },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prompt = scriptedPrompt([knowledgeBase, '3', '2', '', 'y', 'n', 'n']);

    const result = await initCommand([], { prompt, platform: 'darwin' });

    expect(result).toBe(0);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toMatchObject({
      providers: { invented: { base_url: 'http://127.0.0.1:41111/v1' } },
      models: { derive: { provider: 'invented', id: 'invented-generative-model' } },
      maintenance: { profile: 'review' },
    });
    expect(prompt.messages).toContain(
      'Indexing reads the knowledge base and invokes any configured models. It will also honor configured metadata or rendition write opt-ins.',
    );
  });

  it('rejects an OpenAI model preflight for a model-free setup', async () => {
    const root = inventedDirectory();
    const knowledgeBase = path.join(root, 'knowledge-base');
    const target = path.join(root, 'config.json');
    fs.mkdirSync(knowledgeBase);
    vi.stubEnv('AKNO_CONFIG', target);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = await initCommand(['--preset', 'no-model', '--akno-path', knowledgeBase, '--check']);

    expect(result).toBe(2);
    expect(fs.existsSync(target)).toBe(false);
  });
});

function failedPreflight(): OpenAiLunaPreflightReport {
  return {
    kind: 'openai_luna_preflight',
    preset: 'openai-luna',
    presetStatus: 'recommended',
    passed: false,
    credentialPresent: true,
    embedding: {
      status: 'failed',
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: null,
      error: 'embedding endpoint returned 403',
    },
    generative: {
      status: 'ok',
      provider: 'openai',
      model: 'gpt-5.6-luna',
      promptVersion: 'invented-prompt-v1',
      schemaVersion: 'invented-schema-v1',
      latencyMs: 111,
      error: null,
    },
  };
}

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-init-command-'));
  temporary.push(target);
  return target;
}

function scriptedPrompt(answers: string[]): InitPromptSession & { questions: string[]; messages: string[] } {
  return {
    questions: [],
    messages: [],
    async ask(question) {
      this.questions.push(question);
      const answer = answers.shift();
      if (answer === undefined) throw new Error(`missing invented prompt answer for: ${question}`);
      return answer;
    },
    say(message) {
      this.messages.push(message);
    },
    close() {},
  };
}

function inertFollowUps() {
  return {
    index: vi.fn(async (_argv: string[]) => 0),
    recall: vi.fn(async (_argv: string[]) => 0),
    service: vi.fn(async (_argv: string[]) => 0),
  };
}
