import fsp from 'node:fs/promises';
import path from 'node:path';
import { AknoError, FolderInput, type FolderOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { KB_RULES_FILE } from '../config/load.ts';
import { readJsoncFile } from '../config/jsonc.ts';
import { addFolderRule, hasFolderRule } from '../config/write-rules.ts';
import { compileRules } from '../rules/compile.ts';
import { FolderRuleDoc, type FolderRule } from '../config/schema.ts';
import { fileEntry } from '../write/journal.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { isReserved } from '../reserved.ts';
import { normalizeSlug } from './write.ts';

/**
 * **Declare a folder and what belongs in it.** Never gated, on purpose.
 *
 * The arrangement this replaces asked the owner to approve every new top-level folder. It was
 * the wrong question put to the wrong person: an owner on a phone cannot usefully rule on
 * whether a research note needs a `research/` folder, and while they thought about it the
 * finding was lost. Worse, an agent that learns a folder request may be declined learns to
 * append to whatever page already exists instead — which is how claims end up on the pages of
 * unrelated subjects.
 *
 * So the human is out of the loop and the cost moves to the agent: a folder appears the moment
 * something says what it is for. `description` is required for that reason and no other. It is
 * not paperwork — `list` and the pre-turn bundle return it, so it is what the *next* caller
 * reads before filing a page, and it is the difference between a taxonomy and a pile of globs.
 *
 * The rule is written to `<akno_path>/akno.json`, which is where a taxonomy belongs: it
 * travels with the notes, it is readable by anything that can read a file, and it is under the
 * user's own git history. See `config/write-rules.ts` for why that write is textual.
 */
export async function folder(ctx: AknoContext, rawInput: unknown): Promise<FolderOutput> {
  const input = FolderInput.parse(rawInput);

  // The same validation a page slug gets. A folder is a slug prefix, so a `../` here would
  // put a rule — and a directory — outside the folder the user pointed Akno at.
  const folderPath = normalizeSlug(input.path).replace(/\/\*+$/, '');
  if (isReserved(folderPath, ctx.config)) {
    throw new AknoError(
      'invalid',
      `'${folderPath}' is one of Akno's own paths and already has its shape. ` +
        'Declare a folder for the subject instead.',
    );
  }

  const glob = `${folderPath}/**`;
  const relPath = KB_RULES_FILE;
  const absPath = path.join(ctx.config.aknoPath, relPath);
  const existingDoc = readJsoncFile<{ folders?: Record<string, unknown> }>(absPath);

  if (hasFolderRule(existingDoc?.folders, glob)) {
    // Not an error: two agents reaching the same conclusion about where research goes is the
    // system working. The existing rule comes back so the caller can see what it actually says
    // rather than assume its own description won.
    return {
      status: 'ok',
      outcome: 'noop',
      glob,
      path: folderPath,
      rule: existingDoc!.folders![glob] as Record<string, unknown>,
      rules_file: relPath,
      note: `'${folderPath}' is already declared — write the page.`,
    };
  }

  const rule = FolderRuleDoc.parse({
    description: input.description,
    ...(input.role ? { role: input.role } : {}),
    ...(input.remember ? { remember: input.remember } : {}),
    ...(input.about ? { about: input.about } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.ingest ? { ingest: input.ingest } : {}),
    ...(input.rank !== undefined ? { rank: input.rank } : {}),
    ...(input.route !== undefined ? { route: input.route } : {}),
  });

  if (input.dry_run) {
    return {
      status: 'ok',
      outcome: 'ok',
      glob,
      path: folderPath,
      rule,
      rules_file: relPath,
      note: 'dry run — nothing was written',
    };
  }

  let source: string | null = null;
  try {
    source = await fsp.readFile(absPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const written = await writeFileAtomic(ctx.config.aknoPath, relPath, addFolderRule(source, { glob, rule }));

  // The directory too. A rule for a folder nobody has created describes nothing, and the point
  // of this op is that the *next* write lands rather than being refused again.
  await fsp.mkdir(path.join(ctx.config.aknoPath, folderPath), { recursive: true });

  // In force now, not after a restart. `ctx.config` is the object every op holds, so pushing
  // the compiled rule into it is what makes "declare, then write" work inside one turn —
  // which is the whole flow this op exists to enable.
  applyRule(ctx, glob, rule, relPath);

  const changeId = ctx.journal.record({
    actor: ctx.actor,
    op: 'folder',
    summary: `declared ${folderPath}`,
    files: [fileEntry(written)],
  });

  return {
    status: 'ok',
    outcome: 'ok',
    change_id: changeId,
    glob,
    path: folderPath,
    rule,
    rules_file: relPath,
  };
}

/**
 * Recompiles one glob into the live rule list, keeping it sorted most-specific-first.
 *
 * Sorting is not cosmetic: `matchRules` takes the first match and stops, so a list that lost
 * its order would silently apply `**` where `research/**` was meant.
 */
function applyRule(ctx: AknoContext, glob: string, rule: FolderRuleDoc, source: string): void {
  const compiled = compileRules([{ folders: { [glob]: rule }, source }]);
  const next = ctx.config.rules.filter((existing) => existing.glob !== glob).concat(compiled);
  ctx.config.rules = next.sort(
    (a: FolderRule, b: FolderRule) => b.specificity - a.specificity || b.glob.length - a.glob.length,
  );
}
