import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '../packages/core/src/kb/frontmatter.ts';
import {
  inferTemporalMetadata,
  readTemporalDeclaration,
  withTemporalMetadata,
} from '../packages/core/src/maintenance/temporal.ts';

const rootArg = process.argv.slice(2).find((argument) => argument !== '--' && !argument.startsWith('--'));
const root = path.resolve(rootArg ?? '');
const apply = process.argv.includes('--apply');
if (!root || root === path.parse(root).root) {
  throw new Error('pass the knowledge-base root as the first argument');
}

const changed: string[] = [];
const unresolved: string[] = [];
for (const relPath of await markdownFiles(root)) {
  const absPath = path.join(root, relPath);
  const before = await fsp.readFile(absPath, 'utf8');
  const fm = parseFrontmatter(before);
  const akno = objectValue(fm.data.akno);
  const management = objectValue(akno?.management);
  if (management?.dream !== 'synthesize') continue;

  const declaration = readTemporalDeclaration(fm.data);
  if (declaration.metadata || declaration.disabled) continue;
  if (declaration.invalid) {
    unresolved.push(`${relPath}: malformed akno.temporal`);
    continue;
  }

  const body = before.slice(fm.bodyOffset);
  const temporal = inferTemporalMetadata({
    slug: relPath.replace(/\.(?:md|markdown)$/i, '').replaceAll(path.sep, '/'),
    title: typeof fm.data.title === 'string' ? fm.data.title : (firstHeading(body) ?? path.basename(relPath)),
    frontmatter: fm.data,
    body,
  });
  if (!temporal) continue;

  const after = withTemporalMetadata(before, temporal);
  if (after === null) {
    unresolved.push(`${relPath}: inline or unusual akno frontmatter needs manual review`);
    continue;
  }
  if (after === before) continue;
  changed.push(relPath);
  if (apply) await fsp.writeFile(absPath, after, 'utf8');
}

process.stdout.write(
  `${apply ? 'migrated' : 'would migrate'} ${changed.length} temporal page(s)\n` +
    changed.join('\n') +
    (changed.length ? '\n' : '') +
    `unresolved ${unresolved.length}\n` +
    unresolved.join('\n') +
    (unresolved.length ? '\n' : ''),
);

async function markdownFiles(directory: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (current: string): Promise<void> => {
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (/\.(?:md|markdown)$/i.test(entry.name)) out.push(path.relative(directory, absolute));
    }
  };
  await visit(directory);
  return out.sort();
}

function firstHeading(body: string): string | null {
  return (
    body
      .split('\n')
      .map((line) => /^#\s+(.+?)\s*$/.exec(line)?.[1] ?? null)
      .find((line): line is string => line !== null) ?? null
  );
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
