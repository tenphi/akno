import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectInteractiveFolderSetup,
  discoverSetupFolders,
  type InitPromptSession,
} from './init-prompts.ts';

const temporary: string[] = [];

afterEach(() => {
  for (const target of temporary.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe('guided folder admission', () => {
  it('discovers only visible user folders in stable order', () => {
    const root = inventedDirectory();
    for (const folder of [
      'sources',
      '.editor',
      'memory',
      'inbox',
      'node_modules',
      'journal',
      'observations',
    ]) {
      fs.mkdirSync(path.join(root, folder));
    }
    fs.writeFileSync(path.join(root, 'top-level.md'), '# Top level\n', 'utf8');

    expect(discoverSetupFolders(root)).toEqual(['memory', 'sources']);
  });

  it('re-prompts invalid selections and creates a managed namespace for a safe fallback', async () => {
    const root = inventedDirectory();
    fs.mkdirSync(path.join(root, 'manual'));
    fs.mkdirSync(path.join(root, 'sources'));
    const prompt = scriptedPrompt([
      '9',
      '1',
      '1',
      'all',
      '',
      '../outside',
      'inbox/catch-all',
      'memory/catch-all',
    ]);

    const result = await collectInteractiveFolderSetup(prompt, {
      aknoPath: root,
      maintenance: 'autonomous',
      configExists: false,
    });

    expect(result).toEqual({
      rules: {
        'manual/**': { role: 'knowledge', remember: 'integrate' },
        'sources/**': { role: 'source', remember: 'deny' },
        'memory/**': { role: 'knowledge', remember: 'integrate' },
      },
      fallbackPage: 'memory/catch-all',
      counts: { managed: 2, readOnly: 0, source: 1 },
    });
    expect(prompt.messages).toContain('Choose comma-separated folder numbers, all, or none.');
    expect(prompt.messages).toContain('Choose comma-separated remaining folder numbers, all, or none.');
    expect(prompt.messages).toContain(
      'Use a relative page slug inside a folder, without an extension or dot segments.',
    );
  });

  it('leaves an existing configuration untouched by default', async () => {
    const root = inventedDirectory();
    fs.mkdirSync(path.join(root, 'memory'));
    const prompt = scriptedPrompt(['']);

    await expect(
      collectInteractiveFolderSetup(prompt, {
        aknoPath: root,
        maintenance: 'autonomous',
        configExists: true,
      }),
    ).resolves.toBeUndefined();
    expect(prompt.questions).toEqual(['Review folder write boundaries and remember fallback now? [y/N]: ']);
  });
});

function inventedDirectory(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-init-folders-'));
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
