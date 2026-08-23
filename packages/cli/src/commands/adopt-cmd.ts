import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const ADOPT_HELP = `akno adopt <document_id>

  Give one orphan document card a durable filing page. The id comes from
  \`akno recall --json\` or \`akno read --document …\`.

  This never starts a bulk adoption pass. It seals only the selected document
  group and follows the configured maintenance.policies.adopt authority:

    audit    save an exact diff for inspection
    review   wait for a human plan decision
    auto     ask the independent curator, apply, reindex, and verify ownership

  The source file is never moved or changed, and it remains recallable if the
  proposal is rejected or blocked.

  --json    Machine-readable response.`;

export async function adoptCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, {});
  if (values.help || positionals.length !== 1) {
    line(ADOPT_HELP);
    return values.help ? 0 : 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values), { write: true, actor: 'user' });
  try {
    const result = await handle.ops.adopt({ documentId: positionals[0]! });
    if (values.json) {
      json(result);
      return successful(result.outcome) ? 0 : 2;
    }

    heading(`${statusLabel(result.status)} ${result.outcome.replaceAll('_', ' ')}`);
    kv([
      ['document', result.document_id],
      ['page', result.slug],
      ['path', result.rel_path],
      ['plan', result.plan?.id],
      ['item', result.plan?.item_id],
      ['change', result.change_id],
    ]);
    if (result.reason) line(`\n  ${style.grey(result.reason)}`);
    if (result.outcome === 'planned' && result.plan) {
      line(`\n  inspect: ${style.bold(`akno plan diff ${result.plan.id}`)}`);
    }
    if (result.outcome === 'requires_review' && result.plan) {
      line(`\n  inspect: ${style.bold(`akno plan diff ${result.plan.id}`)}`);
      line(
        `  decide:  ${style.bold(`akno plan decide ${result.plan.id} --item ${result.plan.item_id} --approve`)}`,
      );
      line(`  apply:   ${style.bold(`akno plan apply ${result.plan.id}`)}`);
    }
    return successful(result.outcome) ? 0 : 2;
  } finally {
    await handle.close();
  }
}

function successful(outcome: string): boolean {
  return ['planned', 'requires_review', 'created', 'verification_pending', 'noop'].includes(outcome);
}
