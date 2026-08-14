import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';
import { open } from '@akno/core';

const RULES_HELP = `akno rules [path]

  With a path: which rule governs it, and why. Without: every rule, most
  specific first. Specificity comes from the shape of the glob, not from
  declaration order, so reordering the config cannot change what applies.`;

export async function rulesCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv);

  if (values.help) {
    line(RULES_HELP);
    return 0;
  }

  const mem = await open({ ...openOptionsFrom(values), writable: false });
  try {
    if (positionals.length === 0) {
      const rules = mem.config.rules;
      if (values.json) {
        json({ gate: mem.config.gate, rules });
        return 0;
      }
      heading(
        `${rules.length} rule${rules.length === 1 ? '' : 's'}  ${style.grey(`gate=${mem.config.gate}`)}`,
      );
      if (rules.length === 0) {
        line(style.grey('  none — Akno ships no folder taxonomy. Every page is `full`.'));
        return 0;
      }
      const width = Math.max(...rules.map((r) => r.glob.length));
      for (const rule of rules) {
        const fields = Object.entries(rule)
          // `description` is a sentence, not a setting. Inline it and the column alignment
          // that makes this list scannable is gone; it gets its own line below instead.
          .filter(([key]) => !['glob', 'source', 'specificity', 'description'].includes(key))
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(' ');
        line(`  ${rule.glob.padEnd(width)}  ${fields}  ${style.grey(rule.source)}`);
        if (rule.description) line(`  ${' '.repeat(width)}  ${style.grey(rule.description)}`);
      }
      return 0;
    }

    const slug = positionals[0]!.replace(/\.(md|markdown)$/i, '');
    const result = mem.rules(slug);
    if (values.json) {
      json({ slug, ...result });
      return 0;
    }

    heading(slug);
    const entries = Object.entries(result.effective);
    if (entries.length === 0) {
      line(style.grey('  no rule matches — defaults apply: class=full'));
    } else {
      kv(entries.map(([key, value]) => [key, String(value)]));
    }
    if (result.candidates.length > 0) {
      line(`\n  ${style.grey('matched, most specific first:')}`);
      for (const candidate of result.candidates) {
        line(`    ${candidate.glob}  ${style.grey(candidate.source)}`);
      }
    }
    return 0;
  } finally {
    await mem.close();
  }
}
