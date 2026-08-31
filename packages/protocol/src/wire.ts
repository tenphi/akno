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
 * Not ops, deliberately — the registry ops are what an agent calls about memory, and these are
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
 * Gates, journal reads, and maintenance plans are here for the same reason the first three are:
 * exactly one process may write, so with a service running they are reachable through it or not at
 * all. They are deliberately absent from the op registry — an agent does not get to approve its own
 * gated proposal or approve its own maintenance rewrite, and putting them on the op surface would hand it
 * exactly that.
 */
export const COMMAND_NAMES = [
  'index',
  'inbox',
  'dream',
  'approve',
  'decline',
  'changes',
  'proposals',
  'plan',
  'migrate',
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
   * On the Unix socket the caller is trusted to say — owner-only filesystem permissions are its
   * authentication. A host mediating for an agent and a person at a terminal both need to say
   * "this one is the user speaking" or a gated proposal cannot be answered through that door.
   *
   * MCP never sets it. HTTP never sends it either: a bearer credential maps to a server-owned actor,
   * while unauthenticated loopback traffic is always `agent`. Network callers cannot self-promote.
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
  /** MCP policy owned by the service, distinct from the trusted socket's own operations. */
  mcp_ops: z.array(z.string()).optional(),
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
