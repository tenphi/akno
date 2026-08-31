import {
  RetainedTime as RetainedTimeSchema,
  type ProvidedRetainCandidate,
  type RetainSourceRole,
  type RetainedTime,
} from '@tenphi/akno-protocol';
import { sha256 } from '../store/ids.ts';

type RetainSelection = 'provided' | 'extracted';

export interface ManagedMemorySupport {
  receipt: string;
  candidate: string;
  proofGroup: string;
  selection: RetainSelection;
}

interface ManagedMemoryLink {
  type: 'corrects' | 'supersedes' | 'contradicts' | 'fulfills' | 'answers' | 'caused_by';
  target: string;
  support: string;
}

interface ManagedMemoryReporter {
  role: RetainSourceRole;
  speaker?: string;
}

export interface ManagedMemoryMarker {
  id: string;
  supports: ManagedMemorySupport[];
  kind: ProvidedRetainCandidate['kind'];
  subject: string;
  sourceRole: RetainSourceRole;
  speaker?: string;
  reporters: ManagedMemoryReporter[];
  commitment: ProvidedRetainCandidate['discourse']['commitment'];
  disposition: ProvidedRetainCandidate['discourse']['disposition'];
  polarity: 'affirmed' | 'negated';
  basis: ProvidedRetainCandidate['epistemic']['basis'] | 'system_record';
  evidence: string[];
  links: ManagedMemoryLink[];
  time?: RetainedTime;
}

const ID = /^[A-Za-z0-9_-]{4,80}$/;
const FINGERPRINT = /^[a-f0-9]{12,64}$/;
const KINDS = new Set(['claim', 'decision', 'preference', 'plan', 'event', 'question']);
const ROLES = new Set(['user', 'assistant', 'external', 'unknown']);
const COMMITMENTS = new Set(['asserted', 'tentative', 'hypothetical', 'counterfactual', 'none']);
const DISPOSITIONS = new Set([
  'active',
  'proposed',
  'accepted',
  'rejected',
  'resolved',
  'cancelled',
  'completed',
  'superseded',
]);
const BASES = new Set(['self_attested', 'source_report', 'cited_evidence', 'system_record']);
const LINK_TYPES = new Set(['corrects', 'supersedes', 'contradicts', 'fulfills', 'answers', 'caused_by']);
const TIME_RELATIONS = new Set(['occurred', 'valid', 'scheduled', 'due']);
const TIME_STATUSES = new Set(['actual', 'scheduled', 'planned', 'tentative']);
const TIME_PRECISIONS = new Set(['instant', 'day', 'month', 'year', 'unknown']);

export function managedMemoryFingerprint(value: unknown): string {
  return sha256(typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 24);
}

export function markerFromProvidedCandidate(
  id: string,
  candidate: ProvidedRetainCandidate,
  support: ManagedMemorySupport,
  candidateTargets: ReadonlyMap<string, string> = new Map(),
): ManagedMemoryMarker {
  return {
    id,
    supports: [support],
    kind: candidate.kind,
    subject: candidate.subject_ref?.entity_id ?? 'unresolved',
    sourceRole: candidate.attribution.source_role,
    ...(candidate.attribution.source_speaker ? { speaker: candidate.attribution.source_speaker } : {}),
    reporters: (candidate.attribution.chain ?? []).map((reporter) => ({
      role: reporter.role ?? 'unknown',
      speaker: reporter.speaker,
    })),
    commitment: candidate.discourse.commitment,
    disposition: candidate.discourse.disposition,
    polarity: candidate.polarity ?? 'affirmed',
    basis: candidate.epistemic.basis,
    evidence: (candidate.epistemic.evidence ?? []).map(durableEvidenceKey),
    links: (candidate.relations ?? []).map((relation) => ({
      type: relation.type,
      target: durableRelationTarget(relation.target, candidateTargets),
      support: managedMemoryFingerprint(relation.support),
    })),
    ...(candidate.time ? { time: candidate.time } : {}),
  };
}

function durableRelationTarget(
  target: NonNullable<ProvidedRetainCandidate['relations']>[number]['target'],
  candidateTargets: ReadonlyMap<string, string>,
): string {
  if ('memory_id' in target) return `memory:${target.memory_id}`;
  if ('fact_id' in target) return `fact:${target.fact_id}`;
  const memoryId = candidateTargets.get(target.candidate_id);
  if (!memoryId) throw new Error(`unresolved retain candidate relation target ${target.candidate_id}`);
  return `memory:${memoryId}`;
}

export function renderManagedMemoryMarker(marker: ManagedMemoryMarker): string {
  const issue = managedMemoryMarkerIssue(marker);
  if (issue) throw new Error(`invalid managed-memory marker: ${issue}`);
  const attributes = [
    'v=2',
    `supports=${marker.supports.map(renderSupport).join(',')}`,
    'level=1',
    `kind=${marker.kind}`,
    `subject=${encode(marker.subject)}`,
    `source-role=${marker.sourceRole}`,
    ...(marker.speaker ? [`speaker=${encode(marker.speaker)}`] : []),
    `reports=${marker.reporters.length}`,
    ...(marker.reporters.length > 0 ? [`reporters=${marker.reporters.map(renderReporter).join(',')}`] : []),
    `commitment=${marker.commitment}`,
    `disposition=${marker.disposition}`,
    `polarity=${marker.polarity}`,
    `basis=${marker.basis}`,
    ...(marker.evidence.length > 0 ? [`evidence=${marker.evidence.map(encode).join(',')}`] : []),
    ...(marker.links.length > 0 ? [`links=${marker.links.map(renderLink).join(',')}`] : []),
    ...(marker.time
      ? [
          `relation=${marker.time.relation}`,
          `temporal=${marker.time.status}`,
          `precision=${marker.time.precision}`,
          ...(marker.time.start ? [`start=${encode(marker.time.start)}`] : []),
          ...(marker.time.until ? [`until=${encode(marker.time.until)}`] : []),
          ...(marker.time.timezone ? [`timezone=${encode(marker.time.timezone)}`] : []),
          ...(marker.time.mentioned_at ? [`mentioned=${encode(marker.time.mentioned_at)}`] : []),
          ...(marker.time.recurrence ? [`recurrence=${encode(JSON.stringify(marker.time.recurrence))}`] : []),
        ]
      : []),
  ];
  return `<!-- akno:item ${marker.id} ${attributes.join(' ')} -->`;
}

/** The normal parser intentionally accepts v2 only. Legacy syntax lives in the explicit brain migration. */
export function parseManagedMemoryMarker(line: string): ManagedMemoryMarker | null {
  const match = /^\s*<!--\s*akno:item\s+([A-Za-z0-9_-]{4,80})\s+(.+?)\s*-->\s*$/i.exec(line);
  if (!match) return null;
  const tokens = match[2]!.split(/\s+/);
  let cursor = 0;
  const take = (name: string): string | null => {
    const token = tokens[cursor];
    if (!token?.startsWith(`${name}=`)) return null;
    cursor += 1;
    return token.slice(name.length + 1);
  };
  const optional = (name: string): string | undefined => {
    const token = tokens[cursor];
    if (!token?.startsWith(`${name}=`)) return undefined;
    cursor += 1;
    return token.slice(name.length + 1);
  };

  if (take('v') !== '2') return null;
  const supportsRaw = take('supports');
  if (take('level') !== '1') return null;
  const kind = take('kind');
  const subjectRaw = take('subject');
  const sourceRole = take('source-role');
  const speakerRaw = optional('speaker');
  const reportsRaw = take('reports');
  const reportersRaw = optional('reporters');
  const commitment = take('commitment');
  const disposition = take('disposition');
  const polarity = take('polarity');
  const basis = take('basis');
  const evidenceRaw = optional('evidence');
  const linksRaw = optional('links');
  if (
    supportsRaw === null ||
    kind === null ||
    subjectRaw === null ||
    sourceRole === null ||
    reportsRaw === null ||
    commitment === null ||
    disposition === null ||
    polarity === null ||
    basis === null
  ) {
    return null;
  }

  const relation = optional('relation');
  const temporal = optional('temporal');
  const precision = optional('precision');
  const startRaw = optional('start');
  const untilRaw = optional('until');
  const timezoneRaw = optional('timezone');
  const mentionedRaw = optional('mentioned');
  const recurrenceRaw = optional('recurrence');
  if (cursor !== tokens.length) return null;

  const supports = parseList(supportsRaw, parseSupport);
  const subject = decode(subjectRaw);
  const speaker = speakerRaw === undefined ? undefined : decode(speakerRaw);
  const reports = Number(reportsRaw);
  const reporters = reportersRaw === undefined ? [] : parseList(reportersRaw, parseReporter);
  const evidence = evidenceRaw === undefined ? [] : parseList(evidenceRaw, decode);
  const links = linksRaw === undefined ? [] : parseList(linksRaw, parseLink);
  if (
    !supports ||
    subject === null ||
    speaker === null ||
    !Number.isInteger(reports) ||
    reports < 0 ||
    reports > 3 ||
    !reporters ||
    reporters.length !== reports ||
    !evidence ||
    !links
  ) {
    return null;
  }

  let time: RetainedTime | undefined;
  const hasTime = [
    relation,
    temporal,
    precision,
    startRaw,
    untilRaw,
    timezoneRaw,
    mentionedRaw,
    recurrenceRaw,
  ].some((value) => value !== undefined);
  if (hasTime) {
    if (!relation || !temporal || !precision) return null;
    const start = startRaw === undefined ? undefined : decode(startRaw);
    const until = untilRaw === undefined ? undefined : decode(untilRaw);
    const timezone = timezoneRaw === undefined ? undefined : decode(timezoneRaw);
    const mentionedAt = mentionedRaw === undefined ? undefined : decode(mentionedRaw);
    if (start === null || until === null || timezone === null || mentionedAt === null) return null;
    let recurrence: RetainedTime['recurrence'];
    if (recurrenceRaw !== undefined) {
      const decoded = decode(recurrenceRaw);
      if (decoded === null) return null;
      try {
        recurrence = JSON.parse(decoded) as RetainedTime['recurrence'];
      } catch {
        return null;
      }
    }
    time = {
      relation: relation as RetainedTime['relation'],
      status: temporal as RetainedTime['status'],
      precision: precision as RetainedTime['precision'],
      ...(start ? { start } : {}),
      ...(until ? { until } : {}),
      ...(timezone ? { timezone } : {}),
      ...(mentionedAt ? { mentioned_at: mentionedAt } : {}),
      ...(recurrence ? { recurrence } : {}),
    };
  }

  const marker: ManagedMemoryMarker = {
    id: match[1]!,
    supports,
    kind: kind as ManagedMemoryMarker['kind'],
    subject,
    sourceRole: sourceRole as RetainSourceRole,
    ...(speaker ? { speaker } : {}),
    reporters,
    commitment: commitment as ManagedMemoryMarker['commitment'],
    disposition: disposition as ManagedMemoryMarker['disposition'],
    polarity: polarity as ManagedMemoryMarker['polarity'],
    basis: basis as ManagedMemoryMarker['basis'],
    evidence,
    links,
    ...(time ? { time } : {}),
  };
  return managedMemoryMarkerIssue(marker) === null ? marker : null;
}

function managedMemoryMarkerIssue(marker: ManagedMemoryMarker): string | null {
  if (!ID.test(marker.id)) return 'invalid id';
  if (marker.supports.length < 1 || marker.supports.length > 8) return 'invalid support count';
  if (marker.supports.some((support) => !validSupport(support))) return 'invalid support';
  if (new Set(marker.supports.map(renderSupport)).size !== marker.supports.length) {
    return 'duplicate support';
  }
  if (!KINDS.has(marker.kind)) return 'invalid kind';
  if (marker.subject !== 'unresolved' && !/^ent_[A-Za-z0-9_-]{4,80}$/.test(marker.subject)) {
    return 'invalid subject';
  }
  if (!ROLES.has(marker.sourceRole)) return 'invalid source role';
  if (marker.speaker?.includes('\0') || (marker.speaker && !safeLabel(marker.speaker))) {
    return 'invalid speaker';
  }
  if (
    marker.reporters.length > 3 ||
    marker.reporters.some(
      (entry) => !ROLES.has(entry.role) || (entry.speaker !== undefined && !safeLabel(entry.speaker)),
    )
  ) {
    return 'invalid reporters';
  }
  if (!COMMITMENTS.has(marker.commitment)) return 'invalid commitment';
  if (!DISPOSITIONS.has(marker.disposition)) return 'invalid disposition';
  if (marker.polarity !== 'affirmed' && marker.polarity !== 'negated') return 'invalid polarity';
  if (!BASES.has(marker.basis)) return 'invalid basis';
  if (marker.basis === 'self_attested' && marker.sourceRole !== 'user') return 'invalid self attestation';
  if (
    (marker.basis === 'cited_evidence' || marker.basis === 'system_record') &&
    marker.evidence.length === 0
  ) {
    return 'missing evidence';
  }
  if (marker.evidence.length > 8 || marker.links.length > 8) return 'too many references';
  if (marker.evidence.some((entry) => !/^(?:fact|page|document|journal):\S{1,1000}$/.test(entry))) {
    return 'invalid evidence';
  }
  if (
    marker.links.some(
      (link) =>
        !LINK_TYPES.has(link.type) ||
        !FINGERPRINT.test(link.support) ||
        !/^(?:memory|fact):[A-Za-z0-9_-]{4,300}$/.test(link.target),
    )
  ) {
    return 'invalid relation';
  }
  if (marker.kind === 'question' && marker.commitment !== 'none') return 'invalid question commitment';
  const dispositions: Record<ManagedMemoryMarker['kind'], readonly ManagedMemoryMarker['disposition'][]> = {
    claim: ['active', 'superseded'],
    preference: ['active', 'superseded'],
    decision: ['accepted', 'rejected', 'superseded'],
    plan: ['proposed', 'accepted', 'cancelled', 'completed', 'superseded'],
    event: ['active', 'cancelled', 'superseded'],
    question: ['active', 'resolved'],
  };
  if (!dispositions[marker.kind].includes(marker.disposition)) return 'invalid disposition';
  if (marker.time) {
    if (marker.time.precision !== 'unknown' && !marker.time.start && !marker.time.until) {
      return 'invalid temporal boundary';
    }
    if (
      !TIME_RELATIONS.has(marker.time.relation) ||
      !TIME_STATUSES.has(marker.time.status) ||
      !TIME_PRECISIONS.has(marker.time.precision)
    ) {
      return 'invalid temporal vocabulary';
    }
    if (!RetainedTimeSchema.safeParse(marker.time).success) return 'invalid temporal envelope';
  }
  return null;
}

export function renderManagedMemoryPayload(
  text: string,
  marker: Pick<
    ManagedMemoryMarker,
    'sourceRole' | 'speaker' | 'basis' | 'commitment' | 'disposition' | 'kind' | 'time'
  >,
): string {
  const labels = managedMemoryStatusLabels(marker);
  const body = text.trim().replace(/^[-*]\s+/, '');
  return labels.length > 0 ? `- **${labels.join(' · ')}:** ${body}` : `- ${body}`;
}

/** A noncanonical item must remain noncanonical even in a renderer that ignores HTML comments. */
export function managedMemoryPayloadIssue(
  marker: Pick<
    ManagedMemoryMarker,
    'sourceRole' | 'speaker' | 'basis' | 'commitment' | 'disposition' | 'kind' | 'time'
  >,
  payload: string,
): string | null {
  const labels = managedMemoryStatusLabels(marker);
  if (labels.length === 0) return null;
  return payload.startsWith(`- **${labels.join(' · ')}:** `) ? null : 'missing visible semantic status';
}

function managedMemoryStatusLabels(
  marker: Pick<
    ManagedMemoryMarker,
    'sourceRole' | 'speaker' | 'basis' | 'commitment' | 'disposition' | 'kind' | 'time'
  >,
): string[] {
  const labels: string[] = [];
  const label = (value: string): void => {
    if (!labels.includes(value)) labels.push(value);
  };
  if (marker.basis === 'source_report') {
    label(`Reported by ${safeLabel(marker.speaker ?? roleLabel(marker.sourceRole))}`);
  }
  if (marker.commitment === 'tentative') label('Tentative');
  if (marker.commitment === 'hypothetical') label('Hypothetical');
  if (marker.commitment === 'counterfactual') label('Counterfactual');
  if (marker.disposition === 'proposed') label('Proposal');
  if (marker.disposition === 'rejected') label('Rejected');
  if (marker.disposition === 'cancelled') label('Cancelled');
  if (marker.disposition === 'completed') label('Completed');
  if (marker.disposition === 'superseded') label('Superseded');
  if (marker.kind === 'plan' && marker.disposition === 'accepted') label('Plan');
  if (marker.kind === 'question' && marker.disposition === 'active') label('Open question');
  if (marker.kind === 'question' && marker.disposition === 'resolved') label('Resolved question');
  if (marker.time?.relation === 'due') label('Due');
  else if (marker.time?.status === 'scheduled') label('Scheduled');
  else if (marker.time?.status === 'planned') label('Planned');
  else if (marker.time?.status === 'tentative') label('Tentative');
  return labels;
}

export function managedMemoryBlock(marker: ManagedMemoryMarker, payload: string): string {
  return `${renderManagedMemoryMarker(marker)}\n${payload.trim()}`;
}

export function sameManagedMemorySemantics(left: ManagedMemoryMarker, right: ManagedMemoryMarker): boolean {
  return managedMemorySemanticKey(left) === managedMemorySemanticKey(right);
}

function managedMemorySemanticKey(marker: ManagedMemoryMarker): string {
  return JSON.stringify({ ...marker, id: undefined, supports: undefined });
}

function durableEvidenceKey(
  value: NonNullable<ProvidedRetainCandidate['epistemic']['evidence']>[number],
): string {
  if ('fact_id' in value) return `fact:${value.fact_id}`;
  if ('page_slug' in value) return `page:${value.page_slug}:${value.line_hash}`;
  if ('document_id' in value) return `document:${value.document_id}:${value.passage_id}`;
  return `journal:${value.journal_event_id}`;
}

function renderSupport(support: ManagedMemorySupport): string {
  return `${support.receipt}@${support.candidate}@${support.proofGroup}@${support.selection}`;
}

function parseSupport(value: string): ManagedMemorySupport | null {
  const [receipt, candidate, proofGroup, selection, extra] = value.split('@');
  if (extra !== undefined || !receipt || !candidate || !proofGroup) return null;
  const support = { receipt, candidate, proofGroup, selection: selection as RetainSelection };
  return validSupport(support) ? support : null;
}

function validSupport(support: ManagedMemorySupport): boolean {
  return (
    FINGERPRINT.test(support.receipt) &&
    FINGERPRINT.test(support.candidate) &&
    FINGERPRINT.test(support.proofGroup) &&
    (support.selection === 'provided' || support.selection === 'extracted')
  );
}

function renderReporter(reporter: ManagedMemoryReporter): string {
  return `${reporter.role}:${encode(reporter.speaker ?? '')}`;
}

function parseReporter(value: string): ManagedMemoryReporter | null {
  const split = value.indexOf(':');
  if (split < 0) return null;
  const role = value.slice(0, split);
  const speaker = decode(value.slice(split + 1));
  if (!ROLES.has(role) || speaker === null) return null;
  return { role: role as RetainSourceRole, ...(speaker ? { speaker } : {}) };
}

function renderLink(link: ManagedMemoryLink): string {
  return `${link.type}:${encode(link.target)}:${link.support}`;
}

function parseLink(value: string): ManagedMemoryLink | null {
  const first = value.indexOf(':');
  const last = value.lastIndexOf(':');
  if (first <= 0 || last <= first) return null;
  const type = value.slice(0, first);
  const target = decode(value.slice(first + 1, last));
  const support = value.slice(last + 1);
  if (!LINK_TYPES.has(type) || target === null || !target || !FINGERPRINT.test(support)) return null;
  return { type: type as ManagedMemoryLink['type'], target, support };
}

function parseList<T>(value: string, parse: (entry: string) => T | null): T[] | null {
  if (!value) return null;
  const out: T[] = [];
  for (const entry of value.split(',')) {
    const parsed = parse(entry);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function encode(value: string): string {
  return encodeURIComponent(value.replace(/-->/g, '')).slice(0, 1000);
}

function decode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.includes('\0') ? null : decoded;
  } catch {
    return null;
  }
}

function roleLabel(role: RetainSourceRole): string {
  if (role === 'external') return 'the external source';
  if (role === 'unknown') return 'an unknown speaker';
  return `the ${role}`;
}

function safeLabel(value: string): string {
  return value
    .replace(/[\r\n*_[\]<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
