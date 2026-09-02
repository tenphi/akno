import type {
  GraphDirection,
  GraphEdgeRef,
  GraphNodeRef,
  GraphOutput,
  GraphRelation,
  MemoryView,
} from '@tenphi/akno-protocol';
import { openOptionsFrom, parse } from '../args.ts';
import { json, line, statusLabel, style } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const GRAPH_HELP = `akno graph [seed] [options]

  Inspect bounded evidence paths without returning page bodies or copied claims.

  --slug <slug>       Seed one exact page.
  --entity <id>       Seed one exact canonical entity id.
  --query <text>      Resolve exact entity names contained in a query. A positional
                      seed is treated as the query when no seed flag is present.
  --direction <d>     out | in | both (default: both)
  --relation <r,...>  Restrict relationship types.
  --hops <n>          1 | 2 | 3 (default: 2)
  --limit <n>         Maximum paths, up to 100 (default: 30).
  --history           Include superseded fact paths. Excluded by default.
  --memory-view <v>   factual | history | planning | reports | questions |
                      discussion | all.
  --json              Machine-readable response.`;

export async function graphCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    slug?: string;
    entity?: string;
    query?: string;
    direction?: string;
    relation?: string;
    hops?: string;
    limit?: string;
    history?: boolean;
    'memory-view'?: string;
  }>(argv, {
    slug: { type: 'string' },
    entity: { type: 'string' },
    query: { type: 'string' },
    direction: { type: 'string' },
    relation: { type: 'string' },
    hops: { type: 'string' },
    limit: { type: 'string' },
    history: { type: 'boolean', default: false },
    'memory-view': { type: 'string' },
  });

  if (values.help) {
    line(GRAPH_HELP);
    return 0;
  }

  const positionalQuery = !values.slug && !values.entity && !values.query ? positionals.join(' ') : '';
  const hasExplicitSeed = Boolean(values.slug || values.entity || values.query);
  if (
    [values.slug, values.entity, values.query, positionalQuery || undefined].filter(Boolean).length !== 1 ||
    (hasExplicitSeed && positionals.length > 0)
  ) {
    line(GRAPH_HELP);
    return 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.graph({
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.entity ? { entity: values.entity } : {}),
      ...(values.query || positionalQuery ? { query: values.query ?? positionalQuery } : {}),
      ...(values.direction ? { direction: values.direction as GraphDirection } : {}),
      ...(values.relation
        ? { relations: values.relation.split(',').map((value) => value.trim()) as GraphRelation[] }
        : {}),
      ...(values.hops ? { max_hops: Number(values.hops) as 1 | 2 | 3 } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.history ? { include_history: true } : {}),
      ...(values['memory-view'] ? { memory_view: values['memory-view'] as MemoryView } : {}),
    });

    if (values.json) {
      json(result);
      return result.status === 'unavailable' ? 1 : 0;
    }

    printGraph(result);
    return result.status === 'unavailable' ? 1 : 0;
  } finally {
    await handle.close();
  }
}

function printGraph(result: GraphOutput): void {
  line(
    `${statusLabel(result.status)} ${style.grey(`memory=${result.memory_view}`)} ` +
      `${style.grey(`${result.paths.length} path${result.paths.length === 1 ? '' : 's'}`)} ` +
      `${style.grey(`${result.nodes.length} nodes, ${result.edges.length} edges`)}`,
  );
  if (result.degraded?.length) line(style.yellow(`  degraded: ${result.degraded.join(', ')}`));
  if (result.note) line(style.grey(`  ${result.note}`));

  const nodes = new Map(result.nodes.map((node) => [node.id, node]));
  const edges = new Map(result.edges.map((edge) => [edge.id, edge]));
  for (const seed of result.seeds) {
    const node = nodes.get(seed.node);
    line(`  ${style.grey(`seed ${seed.form}`)} ${node ? nodeLabel(node) : seed.value}`);
  }

  for (const ambiguity of result.ambiguities) {
    line(style.yellow(`  ambiguous ${JSON.stringify(ambiguity.mention)}`));
    for (const candidate of ambiguity.candidates) {
      line(`    ${nodeLabel(candidate)} ${candidate.entity ? style.grey(candidate.entity) : ''}`);
    }
  }

  for (const path of result.paths) {
    const start = nodes.get(path.nodes[0]!);
    if (!start) continue;
    let rendered = nodeLabel(start);
    for (let index = 0; index < path.edges.length; index++) {
      const edge = edges.get(path.edges[index]!);
      const from = path.nodes[index]!;
      const next = nodes.get(path.nodes[index + 1]!);
      if (!edge || !next) continue;
      const relation = edge.predicate ? `${edge.relation}:${edge.predicate}` : edge.relation;
      rendered +=
        edge.from === from ? ` —${relation}→ ${nodeLabel(next)}` : ` ←${relation}— ${nodeLabel(next)}`;
    }
    line(`  ${style.grey(`${path.hops}h ~${path.confidence.toFixed(3)}`)}  ${rendered}`);
    line(style.grey(`       ${path.evidence.map(locator).join('  ·  ')}`));
  }

  if (result.truncated)
    line(style.yellow('  traversal was truncated; narrower filters may reveal other paths'));
}

function nodeLabel(node: GraphNodeRef): string {
  switch (node.kind) {
    case 'entity':
      return `${node.label ?? node.entity}${node.slug ? style.grey(` [${node.slug}]`) : ''}`;
    case 'page':
      return node.slug ?? node.label ?? node.id;
    case 'document':
      return `${node.label ?? node.document}${node.availability ? style.grey(` [${node.availability}]`) : ''}`;
    case 'fact':
      return `${node.fact}${node.slug && node.line_start ? style.grey(` [${node.slug}:${node.line_start}]`) : ''}`;
    case 'event':
      return `${node.event}${node.date ? style.grey(` [${node.date}]`) : ''}`;
    case 'memory':
      return `${node.memory}${node.slug && node.line_start ? style.grey(` [${node.slug}:${node.line_start}]`) : ''}`;
    case 'observation':
      return `${node.observation}${node.slug && node.line_start ? style.grey(` [${node.slug}:${node.line_start}]`) : ''}`;
  }
}

function locator(evidence: GraphEdgeRef['evidence']): string {
  const lineRange = evidence.line_start
    ? `:${evidence.line_start}${evidence.line_end && evidence.line_end !== evidence.line_start ? `-${evidence.line_end}` : ''}`
    : '';
  const source =
    evidence.slug ?? evidence.document ?? evidence.event ?? evidence.fact ?? evidence.memory ?? evidence.kind;
  return `${source}${lineRange}${evidence.field ? `#${evidence.field}` : ''}`;
}
