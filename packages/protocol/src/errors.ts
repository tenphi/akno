/**
 * Failure is a *result*, not an exception, everywhere a caller could reasonably
 * continue. `recall` distinguishing "nothing matched" from "the index is
 * unavailable" is the whole point — an agent can honestly say "not
 * recorded" only when the layer proved it.
 */
export const ERROR_CODES = [
  /** The op ran; the knowledge base genuinely has nothing. Not an error. */
  'empty',
  /** A model was unavailable, so a weaker path ran. The result is real but thinner. */
  'degraded',
  /** The index could not be read. Say "let me check again", never "not recorded". */
  'unavailable',
  /** The requested lifecycle is already active. Retry later or inspect the supplied run id. */
  'busy',
  /** A durable lifecycle record was recovered after its process ended before finalization. */
  'interrupted',
  /** A gate blocked a write. Carries a proposal_id the user can approve. */
  'requires_approval',
  /** Two live claims on one attribute. Surfaced before the write commits. */
  'conflict',
  /** Bad input — schema violation, unknown slug, malformed id. */
  'invalid',
  /** The caller's permissions do not include this op on this subtree. */
  'forbidden',
  /** Named thing does not exist. */
  'not_found',
  /** Another process holds the write handle; this one is read-only. */
  'read_only',
  /** Reached in this cut only: the op's schema is final, the body is not. */
  'not_implemented',
  /** Everything else. */
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Thrown across a door boundary and reconstructed on the far side, so a client
 * sees the same error shape whether it called in-process or over a socket.
 */
export class AknoError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AknoError';
    this.code = code;
    this.details = details;
  }

  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }

  static from(value: unknown): AknoError {
    if (value instanceof AknoError) return value;
    if (isWireError(value)) return new AknoError(value.code, value.message, value.details);
    return new AknoError('internal', value instanceof Error ? value.message : String(value));
  }
}

function isWireError(
  value: unknown,
): value is { code: ErrorCode; message: string; details?: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string' &&
    (ERROR_CODES as readonly string[]).includes(candidate.code)
  );
}
