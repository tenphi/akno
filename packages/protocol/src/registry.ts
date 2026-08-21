import type { z } from 'zod';
import { RecallInput, RecallOutput } from './ops/recall.ts';
import { ReadInput, ReadOutput } from './ops/read.ts';
import { ListInput, ListOutput } from './ops/list.ts';
import { TimelineInput, TimelineOutput } from './ops/timeline.ts';
import { ContextInput, ContextOutput } from './ops/context.ts';
import { WriteInput, WriteOutput } from './ops/write.ts';
import { FolderInput, FolderOutput } from './ops/folder.ts';
import {
  AdoptInput,
  AdoptOutput,
  ForgetInput,
  ForgetOutput,
  IngestInput,
  IngestOutput,
  MoveInput,
  MoveOutput,
  RememberInput,
  RememberOutput,
  UndoInput,
  UndoOutput,
} from './ops/mutate.ts';

/**
 * The library is the product: one op registry, one schema per op, three
 * transports over it — so the doors cannot drift into different behaviour.
 * Everything a door needs to exist is in this table and nowhere else.
 */

export type OpKind = 'read' | 'write' | 'admin';

export interface OpDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string;
  kind: OpKind;
  input: I;
  output: O;
  /** Surfaced verbatim as the MCP tool description. Written for an agent to read. */
  description: string;
  /**
   * False while the schema is final and the body is not. The op is still
   * advertised and still validates its input; calling it returns
   * `not_implemented`. Better than an op that quietly does half the job.
   */
  implemented: boolean;
}

function op<I extends z.ZodType, O extends z.ZodType>(def: OpDefinition<I, O>): OpDefinition<I, O> {
  return def;
}

export const OPS = {
  recall: op({
    name: 'recall',
    kind: 'read',
    input: RecallInput,
    output: RecallOutput,
    implemented: true,
    description:
      'Search memory. Returns typed page and document cards with exact source citations. A readable document ' +
      'does not need an owning Markdown page to be found. Handles both keyword lookups and natural ' +
      'language questions; the expansion strategy is inferred from the query. An empty result is proof that ' +
      'nothing matched, not a failure: check `status` for "empty" (nothing there), "degraded" (a model was ' +
      'missing, search was weaker) or "unavailable" (the index could not be read). In question mode, ' +
      '`coverage` reports which concepts from the question the results actually cover — do not answer the ' +
      'parts it reports as false.',
  }),
  read: op({
    name: 'read',
    kind: 'read',
    input: ReadInput,
    output: ReadOutput,
    implemented: true,
    description:
      'Read one exact thing: a page by slug or id, with its links and backlinks, or a document by id with ' +
      'its extracted text. Returns the full body regardless of page role — recall caps what a source ' +
      'page contributes unprompted, but read never does.',
  }),
  list: op({
    name: 'list',
    kind: 'read',
    input: ListInput,
    output: ListOutput,
    implemented: true,
    description:
      'Browse structure rather than search it: folders and their page counts, a tree outline, or pages ' +
      'filtered by type, tag, role or recency. Use this to find out what exists before guessing a slug.',
  }),
  timeline: op({
    name: 'timeline',
    kind: 'read',
    input: TimelineInput,
    output: TimelineOutput,
    implemented: true,
    description:
      'When things happened. Dated events, filtered by range, by subject page, or by text match. Events are ' +
      'indexed from the ledger and from dated lines on any page, so a date written on the page it belongs to ' +
      'is found too.',
  }),
  context: op({
    name: 'context',
    kind: 'read',
    input: ContextInput,
    output: ContextOutput,
    implemented: true,
    description:
      'The whole pre-turn bundle against one budget: pinned pages, recent timeline, a structure outline, and ' +
      "this turn's recall. Normally called by the host before the model sees the turn, not by the agent.",
  }),

  write: op({
    name: 'write',
    kind: 'write',
    input: WriteInput,
    output: WriteOutput,
    implemented: true,
    description:
      'Create, append, patch or replace a page, optionally with an event, documents, tags and links. Check ' +
      '`outcome`: "conflict" means an existing line claims something different — ask the user rather than ' +
      'overwriting; "requires_folder" means the folder has not been declared yet — call `folder` to say what ' +
      'belongs in it, then repeat this write, without asking anyone. The event ledger takes events only: pass ' +
      '`event` and let it be filed, never `append`.',
  }),
  folder: op({
    name: 'folder',
    kind: 'write',
    input: FolderInput,
    output: FolderOutput,
    implemented: true,
    description:
      'Declare a folder and what belongs in it, before writing the first page there. Never gated — nothing ' +
      'here waits on the user. Say what the folder is for in `description`, and set `role` to "source" ' +
      'when it holds evidence rather than claims (transcripts, articles, research, legal texts), because only ' +
      'claims become facts. Returns "noop" when the folder is already declared.',
  }),
  remember: op({
    name: 'remember',
    kind: 'write',
    input: RememberInput,
    output: RememberOutput,
    implemented: true,
    description:
      'Hand over a transcript or notes and let memory decide what is worth keeping and where it goes. Use ' +
      'this instead of write when you do not want to choose slugs or phrasing yourself. Pass `mission` to say ' +
      'what to pay attention to in this particular text; the standing rules about what lasts still apply.',
  }),
  forget: op({
    name: 'forget',
    kind: 'write',
    input: ForgetInput,
    output: ForgetOutput,
    implemented: true,
    description:
      'Retract a fact by removing the sentence that produced it, delete a page to trash, or drop a document. ' +
      'Always journalled and always reversible with undo for the retention window.',
  }),
  undo: op({
    name: 'undo',
    kind: 'write',
    input: UndoInput,
    output: UndoOutput,
    implemented: true,
    description: 'Reverse a change by its id. The id outlives the session.',
  }),
  move: op({
    name: 'move',
    kind: 'write',
    input: MoveInput,
    output: MoveOutput,
    implemented: true,
    description:
      'Relocate a page with its documents, rewriting embeds. Inbound links that now point nowhere are ' +
      'reported, never silently rewritten.',
  }),
  ingest: op({
    name: 'ingest',
    kind: 'write',
    input: IngestInput,
    output: IngestOutput,
    implemented: true,
    description:
      'Pull a file, folder or URL into memory. The text is extracted for you, OCRed if there is no text layer, ' +
      'named from its contents, summarized, and routed to a folder. You never run an extraction tool.',
  }),
  adopt: op({
    name: 'adopt',
    kind: 'write',
    input: AdoptInput,
    output: AdoptOutput,
    implemented: true,
    description:
      'Organize one orphan document card by proposing its exact deterministic filing page. Uses the configured ' +
      'adoption trust mode: audit returns a durable diff, review waits for an operator decision, and auto asks ' +
      'the independent curator before applying and verifying ownership. It never adopts other orphan documents ' +
      'and retrieval does not depend on accepting the proposal.',
  }),
} as const;

export type OpName = keyof typeof OPS;

export const OP_NAMES = Object.keys(OPS) as OpName[];

export type OpInput<N extends OpName> = z.input<(typeof OPS)[N]['input']>;
export type OpResult<N extends OpName> = z.output<(typeof OPS)[N]['output']>;

/** The surface both `open()` and `connect()` implement, generated from the table. */
export type AknoOps = {
  [N in OpName]: (input: OpInput<N>) => Promise<OpResult<N>>;
};

export function isOpName(value: string): value is OpName {
  return Object.prototype.hasOwnProperty.call(OPS, value);
}

export function opsByKind(kind: OpKind): OpName[] {
  return OP_NAMES.filter((name) => OPS[name].kind === kind);
}
