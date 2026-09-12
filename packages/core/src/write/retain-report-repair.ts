import { z } from 'zod';

// The model supplies every semantic word and terminal mark. Two server-owned spaces are the
// only added bytes, keeping the combined normalized text within the existing 400-unit cap.
// eslint-disable-next-line no-control-regex -- Strict prose fields must reject an encoded NUL, not silently normalize it.
const completeSentence = /^[^\r\n\u0000]*[.!]$/u;
export const reportTextRepairFields = {
  reported_proposition: z.string().min(1).max(200).regex(completeSentence),
  relay_attribution: z.string().min(1).max(78).regex(completeSentence),
  personal_limits: z.string().min(1).max(120).regex(completeSentence),
};

type ReportTextRepair = { [K in keyof typeof reportTextRepairFields]: string };
const fields = Object.keys(reportTextRepairFields) as (keyof ReportTextRepair)[];

export function reportRepairText(value: ReportTextRepair): string {
  return fields.map((key) => value[key]).join(' ');
}

/** Normalize only the new prose fields; strict transaction parsing still owns shape and indices. */
export function normalizeReportRepairTransaction(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('repairs' in value) || !Array.isArray(value.repairs))
    return value;
  return {
    ...value,
    repairs: value.repairs.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return entry;
      const record = { ...entry } as Record<string, unknown>;
      for (const key of fields) {
        const text = record[key];
        // Newlines and NUL remain visible to the strict sentence pattern, never flattened away.
        if (typeof text === 'string')
          record[key] = text.replace(/^[ \t]+|[ \t]+$/gu, '').replace(/[ \t]+/gu, ' ');
      }
      return record;
    }),
  };
}

/** These private keys must enter the same language check as ordinary candidate.text prose. */
export function reportRepairLanguageProse(value: unknown): string[] {
  value = normalizeReportRepairTransaction(value);
  if (!value || typeof value !== 'object' || !('repairs' in value) || !Array.isArray(value.repairs))
    return [];
  return value.repairs.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    return fields.every((key) => typeof record[key] === 'string')
      ? [reportRepairText(record as ReportTextRepair)]
      : [];
  });
}
