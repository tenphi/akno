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

/** Attach persisted memory semantics to the visible payload line that follows a marker. */
export function qualifyManagedMemoryLines<T extends Line>(
  lines: T[],
  fileLines: string[],
  options: { asOf?: string; timezone?: string } = {},
): T[] {
  const clock = resolveTimelineClock(options.asOf, options.timezone);
  return lines.map((line) => {
    const markerLine = fileLines[line.n - 2];
    if (markerLine === undefined) return line;
    const markerId = aknoItemId(markerLine);
    if (!markerId) return line;
    const marker = parseManagedMemoryMarker(markerLine);
    return {
      ...line,
      memory: marker
        ? qualificationFor(marker, clock)
        : { status: 'unavailable', id: markerId, answer_eligible: false },
    };
  });
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
