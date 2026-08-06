import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.js';
import { heading, json, kv, line, ms, style } from '../output.js';

export const DOCTOR_HELP = `akno doctor [options]

  What's present, what's degraded, and what that costs. Model latency and index
  latency are reported separately — a memory system that feels slow after idling
  is almost never suffering from its storage engine.

  --no-probe          Skip the model round trips. Instant, but no latency numbers.
  --json`;

export async function doctorCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ probe: boolean }>(argv, {
    probe: { type: 'boolean', default: true },
  });

  if (values.help) {
    line(DOCTOR_HELP);
    return 0;
  }

  // Read-only: `doctor` must be safe to run against a live service.
  const mem = await open({ ...openOptionsFrom(values), writable: false });
  try {
    const report = await mem.doctor({ probeModels: values.probe });

    if (values.json) {
      json(report);
      return report.warnings.length > 0 ? 1 : 0;
    }

    heading('Akno');
    kv([
      ['knowledge base', report.aknoPath],
      ['state', report.stateDir],
      ['config', report.configSources.map((s) => s.replace(process.env.HOME ?? '~', '~')).join(' → ')],
      ['writable', report.writable ? 'yes' : `no — pid ${report.lockHeldBy} holds the write handle`],
      ['vector backend', report.vectorBackend === 'vec0' ? 'sqlite-vec (exact brute force)' : 'JS fallback'],
    ]);

    heading('Index');
    kv([
      ['pages', `${report.counts.pages}${formatClasses(report.byClass)}`],
      ['chunks', `${report.counts.chunks} (${report.counts.chunksEmbedded} embedded)`],
      ['facts', `${report.counts.facts} live, ${report.counts.factsSuperseded} superseded`],
      ['events', report.counts.events],
      ['documents', `${report.counts.documents} (${report.counts.documentsExtracted} extracted)`],
      ['links', `${report.counts.links} (${report.counts.brokenLinks} broken)`],
      ['exclusion rules', report.counts.excludedRules],
    ]);

    // §6: the whole argument for separating these is that they are separated.
    heading('Latency — index only, no model in the path');
    kv([
      ['point lookup', ms(report.index.openMs)],
      ['FTS5 match', ms(report.index.lexicalMs)],
      ['vector scan', report.index.vectorMs === null ? 'no embeddings' : ms(report.index.vectorMs)],
    ]);

    heading('Models');
    for (const role of report.models) {
      const state = role.available
        ? style.green('ok')
        : role.configured
          ? style.red('unavailable')
          : style.grey('not configured');
      const latency = role.latencyMs !== null ? style.grey(` ${ms(role.latencyMs)}`) : '';
      line(`  ${style.bold(role.role.padEnd(10))} ${state}${latency}`);
      if (role.model) line(`    ${style.grey(`${role.model} @ ${role.endpoint ?? '?'}`)}`);
      if (!role.available) {
        if (role.error) line(`    ${style.grey(role.error)}`);
        // The consequence is the part that is actually useful to a reader.
        line(`    ${style.yellow('without it:')} ${role.withoutIt}`);
      }
    }

    heading('Reserved paths');
    for (const entry of report.reserved) {
      const state =
        entry.state === 'ok'
          ? style.green('ok')
          : entry.state === 'missing'
            ? style.grey('missing')
            : style.yellow('occupied');
      line(`  ${entry.path.padEnd(16)} ${state}${entry.note ? style.grey(`  ${entry.note}`) : ''}`);
    }

    if (report.warnings.length > 0) {
      heading(`${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`);
      for (const warning of report.warnings) line(`  ${style.yellow('·')} ${warning}`);
    } else {
      line(`\n${style.green('no warnings')}`);
    }

    return report.warnings.length > 0 ? 1 : 0;
  } finally {
    await mem.close();
  }
}

function formatClasses(byClass: Record<string, number>): string {
  const parts = Object.entries(byClass)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

export const RULES_HELP = `akno rules [path]

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
      heading(`${rules.length} rule${rules.length === 1 ? '' : 's'}  ${style.grey(`gate=${mem.config.gate}`)}`);
      if (rules.length === 0) {
        line(style.grey('  none — Akno ships no folder taxonomy. Every page is `full`.'));
        return 0;
      }
      const width = Math.max(...rules.map((r) => r.glob.length));
      for (const rule of rules) {
        const fields = Object.entries(rule)
          .filter(([key]) => !['glob', 'source', 'specificity'].includes(key))
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(' ');
        line(`  ${rule.glob.padEnd(width)}  ${fields}  ${style.grey(rule.source)}`);
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

export const BENCH_HELP = `akno bench [options]

  Run the performance budgets from the spec against the current knowledge base.
  Numbers rot, so these are asserted rather than remembered — CI fails on
  regression.

  --iterations <n>    Samples per measurement (default 12).
  --json`;

export async function benchCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ iterations?: string }>(argv, { iterations: { type: 'string' } });

  if (values.help) {
    line(BENCH_HELP);
    return 0;
  }

  const { runBench } = await import('@akno/core');
  const mem = await open({ ...openOptionsFrom(values), writable: false });
  try {
    const report = await runBench(mem, {
      ...(values.iterations ? { iterations: Number(values.iterations) } : {}),
    });

    if (values.json) {
      json(report);
      return report.passed ? 0 : 1;
    }

    heading(`Bench — ${report.pages} pages, ${report.chunks} chunks`);
    const width = Math.max(...report.results.map((r) => r.name.length));
    for (const result of report.results) {
      if (result.skipped) {
        line(`  ${result.name.padEnd(width)}  ${style.grey(`skipped — ${result.skipped}`)}`);
        continue;
      }
      const verdict = result.passed ? style.green('pass') : style.red('FAIL');
      line(
        `  ${result.name.padEnd(width)}  ${verdict}  ` +
          `${style.grey(`p50 ${result.p50Ms}ms  p95 ${result.p95Ms}ms  budget ${result.budgetMs}ms`)}`,
      );
    }
    line(`\n${report.passed ? style.green('all budgets met') : style.red('budget regression')}`);
    return report.passed ? 0 : 1;
  } finally {
    await mem.close();
  }
}

export const CONFIG_HELP = `akno config

  The resolved configuration and the files it came from, with secrets redacted.
  Use this to check that config/local.jsonc is actually being read.`;

export async function configCommand(argv: string[]): Promise<number> {
  const { values } = parse(argv);
  if (values.help) {
    line(CONFIG_HELP);
    return 0;
  }

  const { loadConfig } = await import('@akno/core');
  const config = loadConfig(openOptionsFrom(values));

  // Redaction is not optional: this output goes into bug reports.
  const redacted = {
    ...config,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([name, provider]) => [
        name,
        { ...provider, apiKey: provider.apiKey ? '<set>' : null, headers: Object.keys(provider.headers) },
      ]),
    ),
    models: Object.fromEntries(
      Object.entries(config.models).map(([role, model]) => [
        role,
        { ...model, provider: model.provider ? model.provider.name : null },
      ]),
    ),
  };

  if (values.json) {
    json(redacted);
    return 0;
  }

  heading('Sources, lowest precedence first');
  for (const source of config.sources) {
    line(`  ${source.replace(process.env.HOME ?? '~', '~')}`);
  }
  heading('Resolved');
  json(redacted);
  return 0;
}
