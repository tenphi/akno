import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';
import type { SetupMaintenanceMode } from '@tenphi/akno-core';

export interface InitPromptSession {
  ask(question: string): Promise<string>;
  say(message: string): void;
  close(): void;
}

export interface InteractiveInitAnswers {
  aknoPath: string;
  maintenance: SetupMaintenanceMode;
}

interface InteractiveInitOptions {
  aknoPath?: string;
  maintenance?: SetupMaintenanceMode;
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
  if (options.maintenance) return { aknoPath, maintenance: options.maintenance };

  prompt.say('How will this memory be used?');
  prompt.say('  1. Connected to a trusted agent (recommended: autonomous maintenance)');
  prompt.say('  2. Standalone or human-reviewed (recommended: review maintenance)');
  prompt.say('  3. Read-only evaluation (recommended: audit maintenance)');
  const usage = await choice(prompt, 'Usage [1]: ', ['1', '2', '3'], '1');
  const recommended: SetupMaintenanceMode = usage === '1' ? 'autonomous' : usage === '2' ? 'review' : 'audit';
  const maintenance = await choice(
    prompt,
    `Maintenance profile [${recommended}]: `,
    ['audit', 'review', 'autonomous'],
    recommended,
  );
  return { aknoPath, maintenance };
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
