import type { RetainVerificationFailure } from '@tenphi/akno-protocol';
import type { ModelOutcome } from '../models/client.ts';

export function verificationModelFailure(outcome: ModelOutcome<string>): RetainVerificationFailure {
  return outcome.reason ?? (outcome.ok ? 'empty_response' : 'bad_response');
}

/** Inspect only identity structure; neither foreign IDs nor validation details enter receipts. */
export function verificationVerdictSetFailure(
  value: unknown,
  expected: readonly string[],
): RetainVerificationFailure | null {
  if (typeof value !== 'object' || value === null || !('verdicts' in value) || !Array.isArray(value.verdicts))
    return 'schema_mismatch';
  const ids: string[] = [];
  for (const verdict of value.verdicts) {
    if (typeof verdict !== 'object' || verdict === null || typeof verdict.candidate_id !== 'string')
      return 'schema_mismatch';
    ids.push(verdict.candidate_id);
  }
  if (ids.some((id) => !expected.includes(id))) return 'foreign_verdict';
  if (new Set(ids).size !== ids.length) return 'duplicate_verdict';
  if (ids.length !== expected.length || expected.some((id) => !ids.includes(id))) return 'missing_verdict';
  return null;
}
