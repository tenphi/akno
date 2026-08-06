import { open, parsePhase, type DreamReport } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, ms, style, truncate } from '../output.ts';

const DREAM_HELP = `akno dream [options]

  The maintenance cycle. Phases are independent and each is safe to re-run.

    observe        Combine repeated facts into stable patterns. Writes pages under
                   observations/ with their evidence, and never restates a fact.
    reflect        Decision principles built on observations. Off by default — at a few
                   hundred pages a "pattern" is one coincidence away from noise.
    adopt          A page for a document that has none, written beside the file — so its
                   text can be returned at all. Honours \`ingest: "file"\`.
    conflicts      The thorough pass inline checking cannot do: facts from different
                   pages that state different values for the same thing.
    housekeeping   Broken links, orphaned documents, pages that drifted from their rules.

  Only observe and reflect write anything, and only ever by appending: a changed pattern
  gets a new dated line, nothing is deleted, and the whole run is one \`undo\`. Everything
  else is a report, because a maintenance process that tidies a knowledge base behind its
  owner's back is worse than the mess.

  --phase <name>   Run one phase instead of every enabled one.
  --dry-run        Report what observe would write; touch nothing.
  --json`;

export async function dreamCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ phase?: string; 'dry-run': boolean }>(argv, {
    phase: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  });

  if (values.help) {
    line(DREAM_HELP);
    return 0;
  }

  const phase = values.phase ? parsePhase(values.phase) : undefined;
  const mem = await open({ ...openOptionsFrom(values), writable: !values['dry-run'] });

  try {
    const report = await mem.dream({
      ...(phase ? { phase } : {}),
      ...(values['dry-run'] ? { dryRun: true } : {}),
    });

    if (values.json) {
      json(report);
      return 0;
    }

    return printDream(report, values['dry-run']);
  } finally {
    await mem.close();
  }
}

function printDream(report: DreamReport, dryRun: boolean): number {
  heading(`Dream — ${ms(report.durationMs)}${dryRun ? style.grey('  (dry run)') : ''}`);
  for (const phase of report.phases) {
    const label = phase.ran ? style.green('ran') : style.grey('skipped');
    const detail = phase.skipped ? style.grey(`  ${phase.skipped}`) : style.grey(`  ${ms(phase.durationMs)}`);
    line(`  ${phase.phase.padEnd(13)} ${label}${detail}`);
  }

  if (report.observations.length > 0) {
    const wrote = report.observations.filter((entry) => entry.action !== 'unchanged');
    heading(`${wrote.length} observation(s)${dryRun ? ' would be written' : ' written'}`);
    for (const entry of report.observations) {
      const mark =
        entry.action === 'created'
          ? style.green('new    ')
          : entry.action === 'refined'
            ? style.cyan('refined')
            : style.grey('same   ');
      line(`  ${mark} ${entry.slug}`);
      line(`          ${truncate(entry.pattern, 96)}`);
      line(`          ${style.grey(`evidence: ${entry.evidence.join(', ')}`)}`);
    }
  }

  if (report.rejected.length > 0) {
    // §13's guardrails firing is the tier working. Silence here would make a prompt edit
    // that removed one indistinguishable from a quiet night.
    heading(`${report.rejected.length} refused by a guardrail`);
    for (const entry of report.rejected.slice(0, 10)) {
      line(`  ${style.yellow('·')} ${truncate(entry.pattern, 80)}`);
      line(`    ${style.grey(entry.reason)}`);
    }
  }

  if (report.adopted.length > 0) {
    const created = report.adopted.filter((entry) => entry.action === 'created');
    heading(`${created.length} document(s) given a page${dryRun ? ' (would be)' : ''}`);
    for (const entry of report.adopted) {
      const mark = entry.action === 'created' ? style.green('page   ') : style.grey('left   ');
      line(`  ${mark} ${entry.slug}  ${style.grey(entry.files.join(', '))}`);
      if (entry.reason) line(`          ${style.grey(entry.reason)}`);
    }
  }

  const real = report.conflicts.filter((entry) => entry.verdict !== 'not_a_conflict');
  const cleared = report.conflicts.length - real.length;
  if (report.conflicts.length > 0) {
    // A run that examined five candidates and cleared them must not look like a run that
    // found nothing: the second says the pass works, the first says it also judged.
    heading(
      `${report.conflicts.length} conflict candidate(s) — ${real.length} to look at` +
        (cleared > 0 ? `, ${cleared} judged not a conflict` : ''),
    );
    for (const conflict of real) {
      const verdict = conflict.verdict === 'real' ? style.red('conflict') : style.yellow('unverified');
      line(`  ${verdict} ${style.bold(`${conflict.subject} / ${conflict.attribute}`)}`);
      for (const claim of conflict.claims) {
        const current = conflict.likelyCurrent === claim.slug ? style.green('  ← likely current') : '';
        line(`    ${style.grey(`${claim.slug}:${claim.line}`)}  ${truncate(claim.claim, 76)}${current}`);
      }
    }
    if (real.length > 0) {
      line(
        `\n  ${style.grey('nothing was changed — decide, then')} ${style.bold('akno write … --resolve-conflict')}`,
      );
    }
  }

  if (report.housekeeping) {
    const house = report.housekeeping;
    heading('Housekeeping');
    kv([
      ['broken links', house.counts.brokenLinks],
      ['orphaned documents', house.counts.orphanedDocuments],
      ['pages off their rules', house.counts.drift],
    ]);
    for (const entry of house.orphanedDocuments.slice(0, 5)) {
      line(`  ${style.yellow('·')} ${entry.relPath}`);
      line(`    ${style.grey(entry.reason)}`);
    }
    for (const entry of house.drift.slice(0, 5)) {
      line(
        `  ${style.yellow('·')} ${entry.slug}  ${style.grey(`${entry.rule} expects ${entry.expected}, found ${entry.found}`)}`,
      );
    }
    if (house.brokenLinks.length > 0) {
      const shown = house.brokenLinks.slice(0, 5).map((link) => `${link.from} → ${link.to}`);
      line(`  ${style.grey(`links: ${shown.join(', ')}`)}`);
    }
  }

  if (report.warnings.length > 0) {
    heading(`${report.warnings.length} warning(s)`);
    for (const warning of report.warnings.slice(0, 10)) line(`  ${style.yellow('·')} ${warning}`);
  }

  for (const [what, id] of [
    ['the observations', report.changeId],
    ['the pages it wrote for documents', report.adoptChangeId],
  ] as const) {
    // Two changes rather than one: undoing a night's inferences should not also undo the pages
    // that made documents searchable, and the other way round.
    if (id) line(`\n  ${style.grey(`reverse ${what} with`)} ${style.bold(`akno undo ${id}`)}`);
  }
  return 0;
}
