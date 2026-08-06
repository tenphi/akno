import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, style, truncate } from '../output.ts';

const INBOX_HELP = `akno inbox [options]

  Process whatever is sitting in an inbox folder: extract, name, summarize, and route.
  A file that finds a home moves there with its page. A file that does not **stays in
  the inbox**, with a proposal.

  That failure mode is the point. An unrouted file sits visibly where you dropped it
  rather than being filed confidently into the wrong place, where you would never look
  for it. An inbox with three things in it is a to-do list; a misfiled document is a
  lost one.

  An inbox is any folder with \`route: true\` in its rule:

      "inbox/**": { "ingest": "auto", "route": true }

  \`akno serve\` does this automatically as files arrive. This command is for a
  one-off pass, or for a machine that is not running the service.

  --limit <n>     Files to process in this pass (default 50).
  --json`;

export async function inboxCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ limit?: string }>(argv, { limit: { type: 'string' } });

  if (values.help) {
    line(INBOX_HELP);
    return 0;
  }

  // The user running this by hand is the user, so a new destination folder is not gated.
  const mem = await open({ ...openOptionsFrom(values), actor: 'user' });
  try {
    const result = await mem.inbox(values.limit ? { limit: Number(values.limit) } : {});

    if (values.json) {
      json(result);
      return result.waiting.length > 0 ? 2 : 0;
    }

    const total = result.filed.length + result.waiting.length + result.skipped.length;
    if (total === 0) {
      line(style.grey('the inbox is empty'));
      return 0;
    }

    if (result.filed.length > 0) {
      heading(`${result.filed.length} filed`);
      for (const entry of result.filed) {
        line(`  ${style.green('→')} ${entry.source}  ${style.grey('became')}  ${entry.slug}`);
      }
    }

    if (result.waiting.length > 0) {
      heading(`${result.waiting.length} still in the inbox`);
      for (const entry of result.waiting) {
        line(`  ${style.yellow('·')} ${entry.source}`);
        line(`    ${style.grey(truncate(entry.reason, 96))}`);
        if (entry.proposalId) {
          line(`    ${style.grey('decide with')} ${style.bold(`akno ingest <file> --folder <folder>`)}`);
        }
      }
    }

    if (result.skipped.length > 0) {
      heading(`${result.skipped.length} skipped`);
      for (const entry of result.skipped) {
        line(`  ${style.grey(`${entry.source} — ${entry.reason}`)}`);
      }
    }

    return result.waiting.length > 0 ? 2 : 0;
  } finally {
    await mem.close();
  }
}
