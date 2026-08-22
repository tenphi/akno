import { styleText } from 'node:util';

/**
 * Terminal formatting on `node:util`'s `styleText`, which already does the two
 * things a colour library is usually pulled in for: it honours `NO_COLOR` and
 * `FORCE_COLOR`, and it returns plain text when the target stream is not a TTY.
 * A memory tool that pulls in a dependency for this is a memory tool with a
 * supply chain.
 */

type Format = Parameters<typeof styleText>[0];

function wrap(format: Format): (text: string) => string {
  return (text: string): string => styleText(format, text, { stream: process.stdout });
}

export const style = {
  bold: wrap('bold'),
  dim: wrap('dim'),
  red: wrap('red'),
  green: wrap('green'),
  yellow: wrap('yellow'),
  blue: wrap('blue'),
  cyan: wrap('cyan'),
  grey: wrap('gray'),
};

export function heading(text: string): void {
  process.stdout.write(`\n${style.bold(text)}\n`);
}

export function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

export function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function fail(message: string): void {
  process.stderr.write(`${styleText('red', 'error', { stream: process.stderr })} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${styleText('yellow', 'warning', { stream: process.stderr })} ${message}\n`);
}

/** Aligned key/value block. `-` in the value column reads better than empty. */
export function kv(entries: [string, string | number | null | undefined][], indent = '  '): void {
  const width = Math.max(...entries.map(([key]) => key.length));
  for (const [key, value] of entries) {
    line(`${indent}${style.grey(key.padEnd(width))}  ${value ?? '-'}`);
  }
}

/**
 * A status is not decoration — `empty` and `unavailable` mean different things
 * to the caller, and the colour is there so a human scanning output does not have
 * to read the word to notice which one happened.
 */
export function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return style.green('ok');
    case 'empty':
    case 'degraded':
      return style.yellow(status);
    case 'unavailable':
      return style.red('unavailable');
    case 'failed':
      return style.red('failed');
    default:
      return status;
  }
}

/** In-place progress on a TTY; one line per phase otherwise, so logs stay readable. */
export function progressWriter(): (phase: string, done: number, total: number, detail?: string) => void {
  let lastPhase = '';
  const dim = (text: string): string => styleText('gray', text, { stream: process.stderr });
  return (phase, done, total, detail): void => {
    if (!process.stderr.isTTY) {
      if (phase !== lastPhase) {
        lastPhase = phase;
        process.stderr.write(`${phase}: ${total}\n`);
      }
      return;
    }
    const label = detail ? ` ${truncate(detail, 46)}` : '';
    const bar = total > 0 ? `${done}/${total}` : `${done}`;
    process.stderr.write(`\r\u001b[2K${dim(phase.padEnd(10))} ${bar}${dim(label)}`);
    if (phase === 'done') process.stderr.write('\r\u001b[2K');
  };
}

export function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

export function ms(value: number): string {
  if (value < 1) return `${value.toFixed(2)}ms`;
  if (value < 1000) return `${value.toFixed(0)}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}
