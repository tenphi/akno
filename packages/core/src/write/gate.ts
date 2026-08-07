import type { ApprovalRequest } from '@akno/protocol';
import type { Store } from '../store/db.ts';
import type { AknoConfig } from '../config/schema.ts';
import { newPrefixedId } from '../store/ids.ts';

/**
 * **New folders are gated for agents. The user is never gated.**
 *
 * `gate: "top-level"` (the default) asks about a new top-level folder and lets
 * subfolders of an existing one through. The asymmetry is the point: `medical/`
 * appearing is a decision about how the knowledge base is organised;
 * `work/projects/atlas/` appearing under an existing `work/projects/` is not.
 *
 * If the user runs `mkdir medical/` themselves, that folder exists and nothing is
 * asked. This module never sees a hand edit.
 */

export type GateDecision =
  { allowed: true } | { allowed: false; approval: ApprovalRequest; declinedBefore: boolean };

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
   * Checks a slug an agent wants to create, and files a proposal if it is gated.
   *
   * A **declined** proposal for the same subject is remembered and returned
   * again rather than re-asked, which is the difference between a gate and a
   * nag: an agent must stop asking for a folder the user has
   * already refused.
   */
  check(slug: string, actor: string, payload: unknown): GateDecision {
    if (actor === 'user' || this.#config.gate === 'none') return { allowed: true };

    const newFolder = this.#firstUnknownFolder(slug);
    if (!newFolder) return { allowed: true };
    if (this.#config.gate === 'top-level' && newFolder.includes('/')) return { allowed: true };

    // Already refused: hand back the same decision instead of asking again.
    const declined = this.#store.db
      .prepare("SELECT * FROM proposals WHERE subject = ? AND status = 'declined' ORDER BY at DESC LIMIT 1")
      .get(newFolder) as ProposalRow | undefined;
    if (declined) {
      return {
        allowed: false,
        declinedBefore: true,
        approval: {
          proposal_id: declined.id,
          reason: `the folder '${newFolder}' was declined before — do not ask again; write somewhere that exists`,
          nearest: JSON.parse(declined.nearest) as string[],
        },
      };
    }

    // Already pending for the same folder: reuse it, so ten writes to a new
    // folder produce one thing for the user to decide rather than ten.
    const pending = this.#store.db
      .prepare("SELECT * FROM proposals WHERE subject = ? AND status = 'pending' ORDER BY at DESC LIMIT 1")
      .get(newFolder) as ProposalRow | undefined;
    if (pending) {
      return {
        allowed: false,
        declinedBefore: false,
        approval: {
          proposal_id: pending.id,
          reason: `already waiting on approval for the new folder '${newFolder}'`,
          nearest: JSON.parse(pending.nearest) as string[],
        },
      };
    }

    const nearest = this.#nearest(slug);
    const id = newPrefixedId('prop');
    this.#store.db
      .prepare(
        `INSERT INTO proposals(id, at, kind, reason, subject, payload, nearest, status)
         VALUES(?, ?, 'new_folder', ?, ?, ?, ?, 'pending')`,
      )
      .run(
        id,
        new Date().toISOString(),
        `new top-level folder '${newFolder}'`,
        newFolder,
        JSON.stringify(payload),
        JSON.stringify(nearest),
      );

    return {
      allowed: false,
      declinedBefore: false,
      approval: {
        proposal_id: id,
        reason: `new ${this.#config.gate === 'all' ? '' : 'top-level '}folder '${newFolder}'`,
        nearest,
      },
    };
  }

  /**
   * The shallowest folder in the slug's path that no indexed page lives under.
   * Null when every folder on the way already exists.
   */
  #firstUnknownFolder(slug: string): string | null {
    const segments = slug.split('/');
    segments.pop(); // The page's own basename is not a folder.
    if (segments.length === 0) return null;

    const exists = this.#store.db.prepare("SELECT 1 AS ok FROM pages WHERE slug LIKE ? || '/%' LIMIT 1");
    for (let depth = 1; depth <= segments.length; depth++) {
      const folder = segments.slice(0, depth).join('/');
      if (!exists.get(folder)) return folder;
    }
    return null;
  }

  /**
   * Where this could go instead, so the agent has something concrete to
   * offer the user rather than "somewhere else". Existing folders whose name
   * shares a word with the slug, then the busiest top-level folders.
   */
  #nearest(slug: string): string[] {
    const words = slug
      .split(/[/\-_\s]+/)
      .filter((word) => word.length > 3)
      .map((word) => word.toLowerCase());

    const out = new Set<string>();
    if (words.length > 0) {
      const like = this.#store.db.prepare('SELECT DISTINCT slug FROM pages WHERE lower(slug) LIKE ? LIMIT 3');
      for (const word of words) {
        for (const row of like.all(`%${word}%`) as { slug: string }[]) out.add(row.slug);
      }
    }

    const folders = this.#store.db
      .prepare(
        `SELECT substr(slug, 1, instr(slug, '/') - 1) AS folder, count(*) AS n
           FROM pages WHERE instr(slug, '/') > 0
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
