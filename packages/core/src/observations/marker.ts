import type { ObservationDisposition } from '@tenphi/akno-protocol';
import { sha256 } from '../store/ids.ts';

export interface ObservationEvidenceLocator {
  factId: string;
  sourceLineHash: string;
  proofGroups: string[];
}

export interface ObservationMarker {
  id: string;
  subject: string;
  disposition: ObservationDisposition;
  evidence: ObservationEvidenceLocator[];
  proofCount: number;
}

const ID = /^obs_[A-Za-z0-9_-]{8,72}$/;
const ENTITY = /^ent_[A-Za-z0-9_-]{4,80}$/;
const FACT = /^[A-Za-z0-9_-]{4,160}$/;
const HASH = /^[a-f0-9]{32,64}$/;
const PROOF = /^[A-Za-z0-9:_-]{4,180}$/;
const DISPOSITIONS = new Set<ObservationDisposition>(['active', 'weakened', 'retracted', 'superseded']);

export function observationId(subject: string, pattern: string): string {
  return `obs_${sha256(`${subject}\0${normalisePattern(pattern)}`).slice(0, 24)}`;
}

export function renderObservationMarker(marker: ObservationMarker): string {
  const issue = observationMarkerIssue(marker);
  if (issue) throw new Error(`invalid observation marker: ${issue}`);
  return (
    `<!-- akno:observation ${marker.id} v=1 level=2 subject=${marker.subject} ` +
    `disposition=${marker.disposition} evidence=${marker.evidence.map(renderLocator).join(',')} ` +
    `proofs=${marker.proofCount} -->`
  );
}

export function parseObservationMarker(line: string): ObservationMarker | null {
  const match = /^\s*<!--\s*akno:observation\s+(obs_[A-Za-z0-9_-]{8,72})\s+(.+?)\s*-->\s*$/i.exec(line);
  if (!match) return null;
  const tokens = match[2]!.split(/\s+/);
  let cursor = 0;
  const take = (name: string): string | null => {
    const token = tokens[cursor];
    if (!token?.startsWith(`${name}=`)) return null;
    cursor += 1;
    return token.slice(name.length + 1);
  };
  if (take('v') !== '1' || take('level') !== '2') return null;
  const subject = take('subject');
  const disposition = take('disposition');
  const evidenceRaw = take('evidence');
  const proofCountRaw = take('proofs');
  if (!subject || !disposition || !evidenceRaw || !proofCountRaw || cursor !== tokens.length) return null;
  const evidence = evidenceRaw.split(',').map(parseLocator);
  const proofCount = Number(proofCountRaw);
  if (evidence.some((entry) => entry === null) || !Number.isInteger(proofCount)) return null;
  const marker: ObservationMarker = {
    id: match[1]!,
    subject,
    disposition: disposition as ObservationDisposition,
    evidence: evidence as ObservationEvidenceLocator[],
    proofCount,
  };
  return observationMarkerIssue(marker) ? null : marker;
}

export function observationMarkerIssue(marker: ObservationMarker): string | null {
  if (!ID.test(marker.id)) return 'invalid id';
  if (!ENTITY.test(marker.subject)) return 'unresolved subject';
  if (!DISPOSITIONS.has(marker.disposition)) return 'invalid disposition';
  if (marker.evidence.length < 2 || marker.evidence.length > 12) return 'invalid evidence count';
  if (new Set(marker.evidence.map((entry) => entry.factId)).size !== marker.evidence.length) {
    return 'duplicate evidence';
  }
  if (marker.evidence.some(locatorIssue)) return 'invalid evidence locator';
  const proofs = independentProofGroups(marker.evidence);
  if (marker.proofCount !== proofs.size) return 'proof-count mismatch';
  if (marker.proofCount < 2) return 'insufficient independent proof';
  return null;
}

function renderObservationPayload(pattern: string, evidenceSlugs: string[]): string {
  const body = pattern.trim().replace(/^[-*]\s+/, '');
  const links = [...new Set(evidenceSlugs)].map((slug) => `[[${slug}]]`).join(' ');
  return `- **Observation:** ${body} Evidence: ${links}`;
}

export function observationPayloadIssue(payload: string, evidenceSlugs: string[]): string | null {
  const match = /^- \*\*Observation:\*\* (.+?) Evidence: ((?:\[\[[^\]]+\]\](?:\s+|$))+)$/u.exec(payload);
  if (!payload.startsWith('- **Observation:** ')) return 'missing visible observation label';
  if (!payload.includes(' Evidence: ')) return 'missing visible evidence label';
  if (!match?.[1]?.trim()) return 'invalid visible observation payload';
  const linked = [...match[2]!.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((entry) => entry[1]!);
  const links = new Set(linked);
  const expected = new Set(evidenceSlugs);
  return linked.length === links.size &&
    links.size === expected.size &&
    [...expected].every((slug) => links.has(slug))
    ? null
    : 'visible evidence links do not match lineage';
}

export function observationBlock(
  marker: ObservationMarker,
  pattern: string,
  evidenceSlugs: string[],
): string {
  return `${renderObservationMarker(marker)}\n${renderObservationPayload(pattern, evidenceSlugs)}`;
}

/** Insert one owned block while preserving every pre-existing byte in order. */
export function insertObservationBlock(current: string, block: string): string | null {
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const normalisedBlock = block.replaceAll('\n', newline);
  const structure = markdownStructure(current);
  const headings = structure.headings;
  const matches = headings.filter(
    (heading) => heading.level === 2 && /^Observed patterns$/i.test(heading.text),
  );
  if (matches.length > 1) return null;
  const match = matches[0];
  if (!match && structure.sourceFence === null) {
    const separator =
      current.length === 0
        ? ''
        : current.endsWith(`${newline}${newline}`)
          ? ''
          : current.endsWith(newline)
            ? newline
            : `${newline}${newline}`;
    return `${current}${separator}## Observed patterns${newline}${newline}${normalisedBlock}${newline}`;
  }
  const nextHeading = match
    ? headings.find((heading) => heading.index > match.index && heading.level <= 2)
    : undefined;
  const insertionAt = nextHeading?.index ?? structure.sourceFence ?? current.length;
  const before = current.slice(0, insertionAt);
  const after = current.slice(insertionAt);
  const insertion = match ? normalisedBlock : `## Observed patterns${newline}${newline}${normalisedBlock}`;
  const prefix = before.endsWith(`${newline}${newline}`)
    ? ''
    : before.endsWith(newline)
      ? newline
      : `${newline}${newline}`;
  const suffix = after.length === 0 || after.startsWith(newline) ? newline : `${newline}${newline}`;
  return `${before}${prefix}${insertion}${suffix}${after}`;
}

export function replaceObservationBlock(current: string, id: string, replacement: string): string | null {
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const lines = current.split(/\r?\n/);
  const markerIndexes = observationMarkerIndexes(lines, id, true);
  if (markerIndexes.length !== 1 || lines[markerIndexes[0]! + 1] === undefined) return null;
  lines.splice(markerIndexes[0]!, 2, ...replacement.replaceAll('\n', newline).split(newline));
  return lines.join(newline);
}

/** Marker-looking examples inside fenced code are authored text, not Akno-owned blocks. */
export function structuralObservationMarkerIndexes(
  lines: string[],
  includesFrontmatter = false,
  stopAtSourceFence = true,
): Set<number> {
  const indexes = new Set<number>();
  let frontmatter = includesFrontmatter && lines[0]?.replace(/\r$/, '') === '---';
  let fence: { character: '`' | '~'; length: number } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    if (frontmatter) {
      if (index > 0 && raw.replace(/\r$/, '') === '---') frontmatter = false;
      continue;
    }
    if (fence) {
      const closing = /^\s*(`{3,}|~{3,})\s*$/.exec(raw)?.[1];
      if (closing?.[0] === fence.character && closing.length >= fence.length) fence = null;
      continue;
    }
    const opening = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1];
    if (opening) {
      fence = { character: opening[0] as '`' | '~', length: opening.length };
      continue;
    }
    if (stopAtSourceFence && /^\s*<!--\s*source\s*-->\s*$/i.test(raw)) break;
    if (/^\s*<!--\s*akno:observation\b/i.test(raw)) indexes.add(index);
  }
  return indexes;
}

export function observationMarkerIndexes(lines: string[], id: string, includesFrontmatter = false): number[] {
  return [...structuralObservationMarkerIndexes(lines, includesFrontmatter, true)].filter(
    (index) => parseObservationMarker(lines[index]!)?.id === id,
  );
}

export function independentProofGroups(evidence: ObservationEvidenceLocator[]): Set<string> {
  return new Set(evidence.flatMap((entry) => entry.proofGroups));
}

function renderLocator(locator: ObservationEvidenceLocator): string {
  return `${locator.factId}@${locator.sourceLineHash}@${locator.proofGroups.join('+')}`;
}

function parseLocator(value: string): ObservationEvidenceLocator | null {
  const [factId, sourceLineHash, proofRaw, extra] = value.split('@');
  if (!factId || !sourceLineHash || !proofRaw || extra !== undefined) return null;
  const proofGroups = proofRaw.split('+');
  const locator = { factId, sourceLineHash, proofGroups };
  return locatorIssue(locator) ? null : locator;
}

function locatorIssue(locator: ObservationEvidenceLocator): boolean {
  return (
    !FACT.test(locator.factId) ||
    !HASH.test(locator.sourceLineHash) ||
    locator.proofGroups.length === 0 ||
    locator.proofGroups.length > 8 ||
    new Set(locator.proofGroups).size !== locator.proofGroups.length ||
    locator.proofGroups.some((group) => !PROOF.test(group))
  );
}

function normalisePattern(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

interface StructuralHeading {
  index: number;
  level: number;
  text: string;
}

/** Headings that are Markdown structure, excluding frontmatter and fenced examples. */
function markdownStructure(content: string): {
  headings: StructuralHeading[];
  sourceFence: number | null;
} {
  const headings: StructuralHeading[] = [];
  let sourceFence: number | null = null;
  const lines = [...content.matchAll(/.*?(?:\r\n|\n|$)/g)].filter((match) => match[0].length > 0);
  let frontmatter = lines[0]?.[0].replace(/\r?\n$/, '') === '---';
  let fence: { character: '`' | '~'; length: number } | null = null;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const match = lines[lineIndex]!;
    const raw = match[0].replace(/\r?\n$/, '');
    if (frontmatter) {
      if (lineIndex > 0 && raw === '---') frontmatter = false;
      continue;
    }
    if (fence) {
      const closing = /^\s*(`{3,}|~{3,})\s*$/.exec(raw)?.[1];
      if (closing?.[0] === fence.character && closing.length >= fence.length) fence = null;
      continue;
    }
    const opening = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1];
    if (opening) {
      fence = { character: opening[0] as '`' | '~', length: opening.length };
      continue;
    }
    if (/^<!--\s*source\s*-->\s*$/i.test(raw)) {
      sourceFence = match.index!;
      break;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (heading) {
      headings.push({ index: match.index!, level: heading[1]!.length, text: heading[2]!.trim() });
    }
  }
  return { headings, sourceFence };
}
