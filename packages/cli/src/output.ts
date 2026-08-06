/**
 * Terminal formatting. Deliberately dependency-free: a memory tool that pulls in
 * a colour library is a memory tool with a supply chain.
 */

const useColour = process.stdout.isTTY === true && !process.env.NO_COLOR;

function wrap(code: string): (text: string) => string {
  return (text: string): string => (useColour ? `\u001b[${code}m${text}\u001b[0m` : text);
}

export const style = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  cyan: wrap('36'),
  grey: wrap('90'),
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
  process.stderr.write(`${style.red('error')} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${style.yellow('warning')} ${message}\n`);
}

/** Aligned key/value block. `-` in the value column reads better than empty. */
export function kv(entries: [string, string | number | null | undefined][], indent = '  '): void {
  const width = Math.max(...entries.map(([key]) => key.length));
  for (const [key, value] of entries) {
    line(`${indent}${style.grey(key.padEnd(width))}  ${value ?? '-'}`);
  }
}

/**
 * §9. A status is not decoration — `empty` and `unavailable` mean different things
 * to the caller, and the colour is there so a human scanning output does not have
 * to read the word to notice which one happened.
 */
export function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return style.green('ok');
    case 'empty':
      return style.yellow('empty');
    case 'degraded':
      return style.yellow('degraded');
    case 'unavailable':
      return style.red('unavailable');
    default:
      return status;
  }
}

/** In-place progress on a TTY; one line per phase otherwise, so logs stay readable. */
export function progressWriter(): (phase: string, done: number, total: number, detail?: string) => void {
  let lastPhase = '';
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
    process.stderr.write(`\r\u001b[2K${style.grey(phase.padEnd(10))} ${bar}${style.grey(label)}`);
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
