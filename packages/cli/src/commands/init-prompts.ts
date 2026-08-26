import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';
import type { SetupMaintenanceMode } from '@tenphi/akno-core';

const OPERATIONAL_FOLDERS = new Set(['inbox', 'journal', 'node_modules', 'observations', 'timeline']);

export interface InitPromptSession {
  ask(question: string): Promise<string>;
  say(message: string): void;
  close(): void;
}

export interface InteractiveInitAnswers {
  aknoPath: string;
  setup: InitSetupChoice;
  maintenance: SetupMaintenanceMode;
  folderSetup?: InteractiveFolderSetup;
}

export type InitSetupChoice = 'openai-luna' | 'no-model' | 'manual';

type SetupFolderRule = {
  role: 'knowledge' | 'source';
  remember: 'integrate' | 'deny';
};

export interface InteractiveFolderSetup {
  rules: Record<string, SetupFolderRule>;
  fallbackPage: string | null;
  counts: {
    managed: number;
    readOnly: number;
    source: number;
  };
}

interface InteractiveInitOptions {
  aknoPath?: string;
  setup?: InitSetupChoice;
  maintenance?: SetupMaintenanceMode;
  configExists?: boolean;
  readablePath(target: string): boolean;
}

export function terminalInitPrompt(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): InitPromptSession {
  const terminal = createInterface({ input, output, terminal: true });
  return {
    ask: (question) => terminal.question(question),
    say: (message) => output.write(`${message}\n`),
    close: () => terminal.close(),
  };
}

export async function collectInteractiveInitAnswers(
  prompt: InitPromptSession,
  options: InteractiveInitOptions,
): Promise<InteractiveInitAnswers> {
  prompt.say('Akno guided setup');
  prompt.say('The recommended setup uses one OpenAI endpoint and credential with two model IDs.');
  prompt.say('Setup writes only the machine configuration; it does not modify the knowledge base.');

  const aknoPath = await knowledgeBasePath(prompt, options.aknoPath, options.readablePath);
  let setup = options.setup;
  if (!setup) {
    prompt.say('Choose a model setup:');
    prompt.say('  1. OpenAI minimum (recommended: embeddings + GPT-5.6 Luna)');
    prompt.say('  2. No models (lexical retrieval; no content is sent to a model)');
    prompt.say('  3. Specialist/manual roles (preserve them and configure the model blocks yourself)');
    const selected = await choice(prompt, 'Model setup [1]: ', ['1', '2', '3'], '1');
    setup = selected === '1' ? 'openai-luna' : selected === '2' ? 'no-model' : 'manual';
  }
  let maintenance: SetupMaintenanceMode;
  if (options.maintenance) {
    maintenance = options.maintenance;
  } else {
    prompt.say('How will this memory be used?');
    prompt.say('  1. Connected to a trusted agent (recommended: autonomous maintenance)');
    prompt.say('  2. Standalone or human-reviewed (recommended: review maintenance)');
    prompt.say('  3. Read-only evaluation (recommended: audit maintenance)');
    const usage = await choice(prompt, 'Usage [1]: ', ['1', '2', '3'], '1');
    const recommended: SetupMaintenanceMode =
      usage === '1' ? 'autonomous' : usage === '2' ? 'review' : 'audit';
    maintenance = await choice<SetupMaintenanceMode>(
      prompt,
      `Maintenance profile [${recommended}]: `,
      ['audit', 'review', 'autonomous'],
      recommended,
    );
  }
  const folderSetup = await collectInteractiveFolderSetup(prompt, {
    aknoPath,
    maintenance,
    configExists: options.configExists ?? false,
  });
  return { aknoPath, setup, maintenance, ...(folderSetup ? { folderSetup } : {}) };
}

interface InteractiveFolderSetupOptions {
  aknoPath: string;
  maintenance: SetupMaintenanceMode;
  configExists: boolean;
}

/**
 * Make fact-injection authority an explicit setup choice. Discovery reads only immediate directory names;
 * it does not inspect page text, and setup writes only the machine configuration.
 */
export async function collectInteractiveFolderSetup(
  prompt: InitPromptSession,
  options: InteractiveFolderSetupOptions,
): Promise<InteractiveFolderSetup | undefined> {
  if (
    options.configExists &&
    !(await confirmInitAction(prompt, 'Review folder write boundaries and remember fallback now?', false))
  ) {
    return undefined;
  }

  const folders = discoverSetupFolders(options.aknoPath);
  prompt.say('Choose where remembered facts may be written. Setup reads folder names only.');
  if (folders.length > 0) {
    prompt.say('Top-level folders:');
    folders.forEach((folder, index) => prompt.say(`  ${index + 1}. ${folder}/`));
    prompt.say('Unselected folders become searchable read-only knowledge; their files stay intact.');
  } else {
    prompt.say('No classifiable top-level folders were found; existing and future folders remain read-only.');
  }

  const managed =
    folders.length > 0
      ? await folderSelection(prompt, 'Managed-memory folders (numbers; blank = none): ', folders)
      : new Set<number>();
  const source =
    folders.length > 0
      ? await folderSelection(
          prompt,
          'Source/reference folders (remaining numbers; blank = none): ',
          folders,
          managed,
        )
      : new Set<number>();
  const rules: Record<string, SetupFolderRule> = {};
  const counts = { managed: 0, readOnly: 0, source: 0 };
  folders.forEach((folder, index) => {
    const key = `${folder}/**`;
    if (managed.has(index)) {
      rules[key] = { role: 'knowledge', remember: 'integrate' };
      counts.managed++;
    } else if (source.has(index)) {
      rules[key] = { role: 'source', remember: 'deny' };
      counts.source++;
    } else {
      rules[key] = { role: 'knowledge', remember: 'deny' };
      counts.readOnly++;
    }
  });

  prompt.say(
    'A remember fallback is a last-resort managed page. It is used only after normal routing and cannot make other folders writable.',
  );
  const useFallback = await confirmInitAction(
    prompt,
    'Configure a managed fallback page?',
    options.maintenance === 'autonomous',
  );
  if (!useFallback) return { rules, fallbackPage: null, counts };

  const fallbackPage = await fallbackPagePrompt(prompt);
  const parent = fallbackPage.slice(0, fallbackPage.lastIndexOf('/'));
  const parentGlob = `${parent}/**`;
  const parentRule = rules[parentGlob];
  if (!parentRule || parentRule.remember !== 'integrate') {
    rules[parentGlob] = { role: 'knowledge', remember: 'integrate' };
    counts.managed++;
    if (parentRule?.role === 'source') counts.source--;
    else if (parentRule) counts.readOnly--;
    prompt.say(`${parent}/ is now an explicit managed-memory namespace for that fallback.`);
  }
  return { rules, fallbackPage, counts };
}

export async function confirmInitAction(
  prompt: InitPromptSession,
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  const suffix = defaultValue ? ' [Y/n]: ' : ' [y/N]: ';
  while (true) {
    const answer = (await prompt.ask(`${question}${suffix}`)).trim().toLowerCase();
    if (!answer) return defaultValue;
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    prompt.say('Enter yes or no.');
  }
}

async function knowledgeBasePath(
  prompt: InitPromptSession,
  initialValue: string | undefined,
  readablePath: (target: string) => boolean,
): Promise<string> {
  let candidate = initialValue?.trim() ?? '';
  while (true) {
    if (!candidate) candidate = (await prompt.ask('Knowledge-base folder: ')).trim();
    if (candidate && readablePath(candidate)) return candidate;
    prompt.say(candidate ? `Folder is not readable: ${candidate}` : 'A knowledge-base folder is required.');
    candidate = '';
  }
}

async function choice<T extends string>(
  prompt: InitPromptSession,
  question: string,
  allowed: readonly T[],
  defaultValue: T,
): Promise<T> {
  while (true) {
    const answer = (await prompt.ask(question)).trim().toLowerCase();
    if (!answer) return defaultValue;
    const selected = allowed.find((value) => value === answer);
    if (selected) return selected;
    prompt.say(`Choose one of: ${allowed.join(', ')}.`);
  }
}

/** Immediate visible directories only; hidden and Akno-owned operational paths are not policy candidates. */
export function discoverSetupFolders(aknoPath: string): string[] {
  return fs
    .readdirSync(aknoPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !OPERATIONAL_FOLDERS.has(entry.name.toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function folderSelection(
  prompt: InitPromptSession,
  question: string,
  folders: string[],
  unavailable: Set<number> = new Set(),
): Promise<Set<number>> {
  while (true) {
    const answer = (await prompt.ask(question)).trim().toLowerCase();
    if (!answer || answer === 'none') return new Set();
    const values =
      answer === 'all'
        ? folders.flatMap((_, index) => (unavailable.has(index) ? [] : [index + 1]))
        : answer.split(',').map(Number);
    const invalid = values.some(
      (value) =>
        !Number.isInteger(value) || value < 1 || value > folders.length || unavailable.has(value - 1),
    );
    if (!invalid) return new Set(values.map((value) => value - 1));
    prompt.say(
      unavailable.size > 0
        ? 'Choose comma-separated remaining folder numbers, all, or none.'
        : 'Choose comma-separated folder numbers, all, or none.',
    );
  }
}

async function fallbackPagePrompt(prompt: InitPromptSession): Promise<string> {
  while (true) {
    const answer = (await prompt.ask('Fallback page [memory/inbox]: ')).trim();
    const value = answer || 'memory/inbox';
    if (safeFallbackPage(value)) return value;
    prompt.say('Use a relative page slug inside a folder, without an extension or dot segments.');
  }
}

function safeFallbackPage(value: string): boolean {
  const segments = value.split('/');
  return (
    value === value.trim() &&
    value.includes('/') &&
    !path.isAbsolute(value) &&
    !value.startsWith('~') &&
    !/^[a-zA-Z]:/.test(value) &&
    !/\.(?:md|markdown)$/i.test(value) &&
    !value.includes('\\') &&
    !value.includes('\0') &&
    value.length <= 512 &&
    segments.every((segment) => segment.length > 0 && !segment.startsWith('.')) &&
    !OPERATIONAL_FOLDERS.has(segments[0]!.toLowerCase())
  );
}
