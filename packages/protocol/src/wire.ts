import { z } from 'zod';
import { ERROR_CODES } from './errors.ts';

/**
 * Newline-delimited JSON, one object per line, over a unix socket or an HTTP
 * body. Deliberately boring: the measured cost of a socket round trip is 18µs
 * against a recall budget of 300ms, so there is nothing here worth optimizing
 * and every reason to keep it debuggable with `nc`.
 */

/**
 * The maintenance work a *host* asks the writer to do: reconcile the index, file what is in
 * the inbox, run the cycle.
 *
 * Not ops, deliberately — the ten ops are what an agent calls about memory, and these are
 * operator commands about the process. They travel the same wire for one reason: exactly one
 * process may write, so anything that writes has to be reachable *through* it or be
 * unavailable whenever the service is running. It used to be unavailable, and the nightly
 * cycle would have failed every night with "another process holds the write handle".
 */
/**
 * Not ops. The ops are what an agent calls *about memory*; these are what an operator asks of the
 * *process* — reconcile the tree, file the inbox, run the cycle — plus the four that answer a gate
 * or the journal.
 *
 * `approve`, `decline`, `changes` and `proposals` are here for the same reason the first three are:
 * exactly one process may write, so with a service running they are reachable through it or not at
 * all. They are deliberately absent from the op registry — an agent does not get to approve its own
 * gated proposal, and putting them on the op surface would hand it exactly that.
 */
export const COMMAND_NAMES = [
  'index',
  'inbox',
  'dream',
  'approve',
  'decline',
  'changes',
  'proposals',
] as const;
export type CommandName = (typeof COMMAND_NAMES)[number];

export function isCommandName(value: string): value is CommandName {
  return (COMMAND_NAMES as readonly string[]).includes(value);
}

export const WireRequest = z.object({
  id: z.union([z.string(), z.number()]),
  /** An op name, or — when `kind` says so — a command name. */
  op: z.string(),
  kind: z.enum(['op', 'command']).optional(),
  input: z.unknown().optional(),
  /**
   * Who this call speaks for. Absent means the service's own actor, which is `agent`.
   *
   * On the socket and the loopback HTTP door the caller is trusted to say — filesystem permissions
   * and loopback are the authentication, and a caller that can open either could write anything it
   * liked regardless. The gate is not a defence against that caller; it is a policy about *whose*
   * request this is, and only the caller knows. A host mediating for an agent (Luna) and a person at
   * a terminal both need to say "this one is the user speaking" — otherwise approving a gated
   * proposal is impossible through the very door the service is meant to be reached by.
   *
   * The MCP door never sets it. That door faces the agent itself, which does not get to claim to be
   * the user, and is why `server.mcp_allow` exists on it and not here.
   */
  actor: z.enum(['user', 'agent', 'akno']).optional(),
});
export type WireRequest = z.infer<typeof WireRequest>;

export const WireError = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type WireError = z.infer<typeof WireError>;

export const WireResponse = z.union([
  z.object({ id: z.union([z.string(), z.number()]), ok: z.literal(true), result: z.unknown() }),
  z.object({ id: z.union([z.string(), z.number()]), ok: z.literal(false), error: WireError }),
]);
export type WireResponse = z.infer<typeof WireResponse>;

/**
 * Sent by the server on connect, before any request. The client refuses a
 * version it cannot speak to rather than failing on the third call.
 */
export const Hello = z.object({
  hello: z.literal('akno'),
  protocol: z.number().int(),
  version: z.string(),
  /** Read-only means another process holds the write handle. */
  writable: z.boolean(),
  akno_path: z.string(),
  ops: z.array(z.string()),
  /** Maintenance commands this door accepts. Absent from an older server. */
  commands: z.array(z.string()).optional(),
});
export type Hello = z.infer<typeof Hello>;

/** Splits a byte stream into complete lines, buffering the partial tail. */
export function createLineDecoder(): (chunk: string) => string[] {
  let buffer = '';
  return (chunk: string): string[] => {
    buffer += chunk;
    const parts = buffer.split('\n');
    // The last element is either '' (chunk ended on a newline) or a partial line.
    buffer = parts.pop() ?? '';
    return parts.filter((line) => line.length > 0);
  };
}

export function encodeLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
