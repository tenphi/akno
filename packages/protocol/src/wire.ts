import { z } from 'zod';
import { ERROR_CODES } from './errors.js';

/**
 * Newline-delimited JSON, one object per line, over a unix socket or an HTTP
 * body. Deliberately boring: the measured cost of a socket round trip is 18µs
 * against a recall budget of 300ms, so there is nothing here worth optimizing
 * and every reason to keep it debuggable with `nc` (§16).
 */

export const WireRequest = z.object({
  id: z.union([z.string(), z.number()]),
  op: z.string(),
  input: z.unknown().optional(),
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
  /** Read-only means another process holds the write handle (§16). */
  writable: z.boolean(),
  akno_path: z.string(),
  ops: z.array(z.string()),
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
