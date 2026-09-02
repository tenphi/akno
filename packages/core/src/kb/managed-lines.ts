import type { Line, MemoryQualification } from '@tenphi/akno-protocol';
import { aknoItemId } from './page.ts';
import {
  managedMemoryAnswerEligible,
  parseManagedMemoryMarker,
  type ManagedMemoryMarker,
} from '../write/managed-memory.ts';
import {
  classifyRetainedTime,
  resolveTimelineClock,
  temporalActionable,
  temporalCurrentEligible,
  type TimelineClock,
} from '../timeline/clock.ts';
import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';

/** Attach persisted memory semantics to the visible payload line that follows a marker. */
export function qualifyManagedMemoryLines<T extends Line>(
  lines: T[],
  fileLines: string[],
  options: { asOf?: string; timezone?: string; store?: Store; pageId?: string } = {},
): T[] {
  const clock = resolveTimelineClock(options.asOf, options.timezone);
  return lines.map((line) => {
    const markerLine = fileLines[line.n - 2];
    if (markerLine === undefined) return line;
    const markerId = aknoItemId(markerLine);
    if (!markerId) return line;
    const marker = parseManagedMemoryMarker(markerLine);
    const projectionCurrent =
      marker && options.store && options.pageId
        ? managedMemoryProjectionCurrent(
            options.store,
            options.pageId,
            line.n - 1,
            line.n,
            marker.id,
            markerLine,
            line.text,
          )
        : true;
    return {
      ...line,
      memory: marker
        ? projectionCurrent
          ? qualificationFor(marker, clock)
          : { status: 'unavailable', id: marker.id, answer_eligible: false }
        : { status: 'unavailable', id: markerId, answer_eligible: false },
    };
  });
}

function managedMemoryProjectionCurrent(
  store: Store,
  pageId: string,
  markerLine: number,
  payloadLine: number,
  memoryId: string,
  marker: string,
  payload: string,
): boolean {
  const row = store.db
    .prepare(
      `SELECT marker_hash, payload_hash
         FROM managed_memory_entries
        WHERE source_page = ? AND marker_line = ? AND payload_line = ? AND memory_id = ?`,
    )
    .get(pageId, markerLine, payloadLine, memoryId) as
    { marker_hash: string; payload_hash: string } | undefined;
  if (!row || row.marker_hash !== sha256(marker.trim()) || row.payload_hash !== sha256(payload.trim())) {
    return false;
  }
  const copies = store.db
    .prepare('SELECT count(*) AS count FROM managed_memory_entries WHERE memory_id = ?')
    .get(memoryId) as { count: number };
  return copies.count === 1;
}

function qualificationFor(marker: ManagedMemoryMarker, clock: TimelineClock): MemoryQualification {
  const answerEligible = managedMemoryAnswerEligible(marker);
  return {
    status: 'qualified',
    id: marker.id,
    level: 1,
    kind: marker.kind,
    subject: marker.subject,
    source_role: marker.sourceRole,
    ...(marker.speaker ? { source_speaker: marker.speaker } : {}),
    commitment: marker.commitment,
    disposition: marker.disposition,
    polarity: marker.polarity,
    basis: marker.basis,
    answer_eligible: answerEligible,
    current_eligible: marker.time
      ? answerEligible && temporalCurrentEligible(marker.time, marker.disposition, clock)
      : answerEligible,
    ...(marker.time
      ? {
          temporal: {
            time: marker.time,
            clock_relation: classifyRetainedTime(marker.time, marker.disposition, clock),
            actionable: temporalActionable(marker.time, marker.disposition),
          },
        }
      : {}),
  };
}
