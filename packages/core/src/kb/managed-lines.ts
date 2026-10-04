import { qualifyProseLines } from './prose.ts';
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
import {
  correctionMemoryRestrictions,
  type CorrectionRestriction,
} from '../memory/correction-restrictions.ts';

/** Attach persisted memory semantics to the visible payload line that follows a marker. */
export function qualifyManagedMemoryLines<T extends Line>(
  lines: T[],
  fileLines: string[],
  options: { asOf?: string; timezone?: string; store?: Store; pageId?: string } = {},
): T[] {
  const clock = resolveTimelineClock(options.asOf, options.timezone);
  const restrictions = options.store
    ? correctionMemoryRestrictions(options.store)
    : new Map<string, CorrectionRestriction>();
  return qualifyProseLines(
    lines.map((line) => {
      const ledgerId = /<!--\s*akno:timeline-item\s+id=([A-Za-z0-9_-]{4,80})(?:\s|-->)/.exec(line.text)?.[1];
      const ledgerRestriction = ledgerId ? restrictions.get(ledgerId) : undefined;
      if (ledgerId && ledgerRestriction) {
        // A readable ledger copy has no independent support. Preserve its bytes for inspection,
        // while its canonical item's withdrawal prevents it bypassing current qualification.
        return {
          ...line,
          memory: {
            status: 'unavailable' as const,
            id: ledgerId,
            answer_eligible: false as const,
            current_hold: ledgerRestriction,
          },
        };
      }
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
            ? qualificationFor(marker, clock, restrictions.get(marker.id))
            : { status: 'unavailable', id: marker.id, answer_eligible: false }
          : { status: 'unavailable', id: markerId, answer_eligible: false },
      };
    }),
    fileLines,
  );
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

function qualificationFor(
  marker: ManagedMemoryMarker,
  clock: TimelineClock,
  restriction: CorrectionRestriction | undefined,
): MemoryQualification {
  const answerEligible = !restriction && managedMemoryAnswerEligible(marker);
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
    ...(restriction ? { current_hold: restriction } : {}),
    current_eligible: marker.time
      ? answerEligible && temporalCurrentEligible(marker.time, marker.disposition, clock)
      : answerEligible,
    ...(marker.time
      ? {
          temporal: {
            time: marker.time,
            clock_relation: classifyRetainedTime(marker.time, marker.disposition, clock),
            actionable: !restriction && temporalActionable(marker.time, marker.disposition),
          },
        }
      : {}),
  };
}
