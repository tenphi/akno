import type { FolderRequired } from '@tenphi/akno-protocol';
import type { Store } from '../store/db.ts';
import type { AknoConfig } from '../config/schema.ts';
import { physicalFolderExists } from '../kb/folders.ts';

/**
 * **A page may not appear in a folder nobody has described.**
 *
 * This used to be an approval: a new top-level folder became a proposal, an approval card, and
 * a decision the owner had to make from a phone. That was the wrong question put to the wrong
 * person. An owner cannot usefully rule on whether a research note needs a `research/` folder,
 * and while the question waited the finding was lost. The second-order damage was worse — an
 * agent that learns a folder request can be declined learns to append to whatever page already
 * exists, and claims start landing on the pages of unrelated subjects.
 *
 * So nothing here waits on a human any more. What is refused is not the folder but the
 * *silence*: the write comes back `requires_folder`, the caller declares the folder with the
 * `folder` op — ungated, one call, saying what belongs there — and repeats the write. The user
 * is never asked, and no folder appears that nothing can explain.
 *
 * `gate: "top-level"` (the default) requires a declaration for a new top-level folder and lets
 * subfolders of a described one through. The asymmetry is the same as it always was:
 * `medical/` appearing is a statement about how the knowledge base is organised;
 * `work/projects/atlas/` under an existing `work/projects/` is not.
 *
 * If the user makes a folder themselves, that folder exists and nothing is asked. This module
 * never sees a hand edit.
 */

export type GateDecision = { allowed: true } | { allowed: false; requiresFolder: FolderRequired };

export interface ProposalRow {
  id: string;
  at: string;
  kind: string;
  reason: string;
  subject: string;
  payload: string;
  nearest: string;
  status: 'pending' | 'approved' | 'declined';
}

export class Gate {
  readonly #store: Store;
  readonly #config: AknoConfig;

  constructor(store: Store, config: AknoConfig) {
    this.#store = store;
    this.#config = config;
  }

  /**
   * Checks a slug an agent wants to create.
   *
   * Nothing is recorded when this refuses. A proposal row existed to hold a question for the
   * user; there is no question now, so writing one would leave `akno proposals` full of
   * things nobody will ever answer — and an agent that re-asks after declaring the folder
   * would collect one per attempt.
   */
  check(slug: string, actor: string): GateDecision {
    if (actor === 'user' || this.#config.gate === 'none') return { allowed: true };

    const newFolder = this.#firstUndeclaredFolder(slug);
    if (!newFolder) return { allowed: true };
    if (this.#config.gate === 'top-level' && newFolder.includes('/')) return { allowed: true };

    return { allowed: false, requiresFolder: { folder: newFolder, nearest: this.#nearest(slug) } };
  }

  /**
   * The shallowest folder on the slug's path that holds no page **and** has no rule
   * describing it. Null when every folder on the way is one or the other.
   *
   * The rule half is what makes declare-then-write work in a single turn: a folder that was
   * described a moment ago holds nothing yet, and asking the `pages` table alone would refuse
   * the very write the declaration was made for.
   */
  #firstUndeclaredFolder(slug: string): string | null {
    const segments = slug.split('/');
    segments.pop(); // The page's own basename is not a folder.
    if (segments.length === 0) return null;

    const exists = this.#store.db.prepare(
      "SELECT 1 AS ok FROM pages WHERE role != 'ignored' AND slug LIKE ? || '/%' LIMIT 1",
    );
    for (let depth = 1; depth <= segments.length; depth++) {
      const folder = segments.slice(0, depth).join('/');
      if (exists.get(folder)) continue;
      // The page index cannot represent an empty directory. A folder the user created on disk is
      // nevertheless an explicit taxonomy decision and must not be reported as nonexistent.
      if (physicalFolderExists(this.#config, folder)) continue;
      if (this.#described(folder)) continue;
      return folder;
    }
    return null;
  }

  /** True when some rule names this exact folder — `research` for a `research/**` rule. */
  #described(folder: string): boolean {
    return this.#config.rules.some((rule) => rule.glob.replace(/\/\*+$/, '') === folder);
  }

  /**
   * Where this could go instead, so a new folder is a choice rather than a reflex. Existing
   * folders whose name shares a word with the slug, then the busiest top-level folders.
   */
  #nearest(slug: string): string[] {
    const words = slug
      .split(/[/\-_\s]+/)
      .filter((word) => word.length > 3)
      .map((word) => word.toLowerCase());

    const out = new Set<string>();
    if (words.length > 0) {
      const like = this.#store.db.prepare(
        "SELECT DISTINCT slug FROM pages WHERE role != 'ignored' AND lower(slug) LIKE ? LIMIT 3",
      );
      for (const word of words) {
        for (const row of like.all(`%${word}%`) as { slug: string }[]) out.add(row.slug);
      }
    }

    const folders = this.#store.db
      .prepare(
        `SELECT substr(slug, 1, instr(slug, '/') - 1) AS folder, count(*) AS n
           FROM pages WHERE role != 'ignored' AND instr(slug, '/') > 0
          GROUP BY folder ORDER BY n DESC LIMIT 4`,
      )
      .all() as { folder: string }[];
    for (const row of folders) out.add(row.folder);

    return [...out].slice(0, 6);
  }

  pending(): ProposalRow[] {
    return this.#store.db
      .prepare("SELECT * FROM proposals WHERE status = 'pending' ORDER BY at DESC")
      .all() as ProposalRow[];
  }

  get(id: string): ProposalRow | null {
    return (this.#store.db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as ProposalRow) ?? null;
  }

  resolve(id: string, status: 'approved' | 'declined', changeId?: string): void {
    this.#store.db
      .prepare('UPDATE proposals SET status = ?, resolved_at = ?, change_id = ? WHERE id = ?')
      .run(status, new Date().toISOString(), changeId ?? null, id);
  }
}
