import type { DocumentAvailability } from '@tenphi/akno-protocol';
import type { Database } from 'better-sqlite3';

export interface AvailabilityPart {
  rel_path: string;
  text: string | null;
  availability: 'available' | 'missing';
  missing_since: string | null;
}

/**
 * One document can span several originals and have one or more text renditions.
 * Availability is therefore derived for the group, while each missing timestamp
 * stays on the exact file that disappeared.
 */
export function documentAvailability(db: Database, parts: AvailabilityPart[]): DocumentAvailability {
  const missing = parts.filter((part) => part.availability === 'missing');
  const paths = parts.map((part) => part.rel_path);
  const renditions =
    paths.length === 0
      ? []
      : (db
          .prepare(
            `SELECT rel_path FROM documents
              WHERE availability = 'available'
                AND renders IN (${paths.map(() => '?').join(',')})
              ORDER BY rel_path`,
          )
          .all(...paths) as { rel_path: string }[]);

  const availableFrom = new Set<DocumentAvailability['available_from'][number]>();
  if (parts.some((part) => part.availability === 'available')) availableFrom.add('original');
  if (missing.some((part) => part.text !== null)) availableFrom.add('indexed_text');
  if (renditions.length > 0) availableFrom.add('rendition');

  const status: DocumentAvailability['status'] =
    missing.length === 0 ? 'available' : availableFrom.size > 0 ? 'degraded' : 'unavailable';
  const missingSince = missing
    .map((part) => part.missing_since)
    .filter((value): value is string => value !== null)
    .sort()[0];

  return {
    status,
    available_from: [...availableFrom],
    missing_originals: missing.map((part) => part.rel_path),
    available_renditions: renditions.map((row) => row.rel_path),
    ...(missingSince ? { missing_since: missingSince } : {}),
  };
}
