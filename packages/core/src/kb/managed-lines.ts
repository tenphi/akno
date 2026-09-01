import type { Line, MemoryQualification } from '@tenphi/akno-protocol';
import { aknoItemId } from './page.ts';
import {
  managedMemoryAnswerEligible,
  parseManagedMemoryMarker,
  type ManagedMemoryMarker,
} from '../write/managed-memory.ts';

/** Attach persisted memory semantics to the visible payload line that follows a marker. */
export function qualifyManagedMemoryLines<T extends Line>(lines: T[], fileLines: string[]): T[] {
  return lines.map((line) => {
    const markerLine = fileLines[line.n - 2];
    if (markerLine === undefined) return line;
    const markerId = aknoItemId(markerLine);
    if (!markerId) return line;
    const marker = parseManagedMemoryMarker(markerLine);
    return {
      ...line,
      memory: marker
        ? qualificationFor(marker)
        : { status: 'unavailable', id: markerId, answer_eligible: false },
    };
  });
}

function qualificationFor(marker: ManagedMemoryMarker): MemoryQualification {
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
    answer_eligible: managedMemoryAnswerEligible(marker),
  };
}
