import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  clockRepairFields,
  excludedClockRepairFields,
  clockRepairText,
  clockRepairLanguageProse,
  sourceClockRepairWitness,
} from './retain-clock-repair.ts';
import { runRetain } from './retain.ts';
import { ModelClient, type ChatOptions, toEndpointSchema, strictModeViolations } from '../models/client.ts';
import { retentionAudit, frameAuditFields } from '../../test/semantic-audit.ts';

const definition =
  'Дата первоначальной записи неизвестна. «Следующий месяц» означает месяц после этой записи, а не после обработки. Какой это календарный месяц, установить невозможно.';
const english =
  "The original record's date is unknown. Next month means the month after this record, not after processing. The calendar month cannot be established.";
const proposal =
  'Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month. She has not accepted a plan or organized a meeting; this is her proposal only.';
const original = {
  kind: 'plan',
  text: proposal,
  subject: 'Zephyr QX-100',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
  discourse: { commitment: 'asserted', disposition: 'proposed' },
  epistemic: { basis: 'self_attested' },
  polarity: 'affirmed',
  relations: [],
  support: [{ item_id: 'turn-1111', quote: proposal }],
  discourse_frame: [
    { item_id: 'turn-1111', quote: proposal },
    { item_id: 'turn-2222', quote: definition },
  ],
  time: { precision: 'unknown', status: 'tentative', relation: 'scheduled' },
};
const delta = {
  candidate_index: 0,
  proposition_and_nontemporal_scope:
    'Ada Marlow proposes reviewing Zephyr QX-100 repair terms. She has not accepted a plan or organized a meeting; this is her proposal only.',
  source_clock_anchor_and_unknown_date:
    'Next month means the month after the original record, whose date is unknown.',
  excluded_reference_clocks: 'The clock is not the time of processing.',
  unresolved_calendar_period: 'The calendar month cannot be established.',
};
async function run(
  repair: unknown,
  options: {
    record?: any;
    definition?: string;
    negative?: boolean;
    raw?: boolean;
    extraSourceItems?: { item_id: string; role: 'user'; speaker: string; text: string }[];
  } = {},
) {
  const record = options.record ?? original;
  const requests: { payload: any; options: ChatOptions }[] = [];
  const chat = vi.fn(async (messages: { content: string }[], callOptions: ChatOptions) => {
    const payload = JSON.parse(messages.at(-1)!.content);
    requests.push({ payload, options: callOptions });
    if (requests.length === 1)
      return { ok: true, value: JSON.stringify({ candidates: [record] }), latencyMs: 11 };
    if (payload.repair_targets)
      return { ok: true, value: options.raw ? repair : JSON.stringify(repair), latencyMs: 11 };
    return {
      ok: true,
      latencyMs: 11,
      value: JSON.stringify({
        verdicts: payload.candidates.map((candidate: any) => ({
          candidate_id: candidate.candidate_id,
          source_selected_polarity: candidate.polarity,
          ...frameAuditFields(candidate),
          ...retentionAudit(candidate, !options.negative),
          proposition_supported: !options.negative,
          action_arguments_preserved: true,
          qualification_scope_preserved: true,
          reason_code: null,
        })),
      }),
    };
  });
  const invalid = vi.fn();
  const result = await runRetain(
    '',
    {
      available: true,
      modelId: 'invented-clock-repair',
      chat,
      reportInvalidResponse: invalid,
      degradedReason: () => null,
    } as unknown as ModelClient,
    {
      sourceItems: [
        { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: proposal },
        { item_id: 'turn-2222', role: 'user', speaker: 'Ada Marlow', text: options.definition ?? definition },
        ...(options.extraSourceItems ?? []),
      ],
    },
  );
  return { result, requests, invalid };
}

describe('owned source clock repair dimensions', () => {
  it.each([
    definition,
    english,
    definition.replace(', а не после обработки', ''),
    english.replace(', not after processing', ''),
  ])('uses a complete original definition: %s', (quote) => {
    const witness = sourceClockRepairWitness([{ quote, item_id: 'turn-1111' }])!;
    expect(witness.with_exclusion).toBe(/обработ|processing/u.test(quote));
    expect(witness.dimensions).toHaveLength(witness.with_exclusion ? 4 : 3);
    for (const dimension of witness.dimensions)
      expect(quote.slice(dimension.start, dimension.end)).toBe(dimension.exact_excerpt);
  });
  it.each([
    `«${definition}»`,
    `Example: ${english}`,
    `Suppose. ${english}`,
    `${english} This definition was withdrawn.`,
    `${english} It is not after delivery.`,
    `If ${english}`,
    `Suppose ${english}`,
    `Неверно, что ${definition}`,
    definition.replace('неизвестна', 'известна'),
    definition.replace('после этой', 'до этой'),
    definition.replace('установить невозможно', 'установить возможно'),
    definition.replace('обработки', 'покупки'),
    definition + ' Но это неверно.',
    definition.replace('невозможно.', 'невозможно?'),
    definition + ' Сегодня тоже исключено.',
    definition.replace('Дата', 'Якобы дата'),
  ])('leaves ambiguous or unsupported definitions to ordinary full repair: %s', (quote) =>
    expect(sourceClockRepairWitness([{ quote }])).toBeNull(),
  );
  it('does not assemble clock dimensions across items or contradictory definitions', () => {
    expect(
      sourceClockRepairWitness(definition.split('. ').map((quote, i) => ({ quote, item_id: `turn-${i}` }))),
    ).toBeNull();
    expect(
      sourceClockRepairWitness([
        { quote: definition },
        { quote: definition.replace('Следующий', 'Прошлый').replaceAll('после', 'до') },
      ]),
    ).toBeNull();
  });
});

describe('single pre-semantic clock text transaction', () => {
  it.each(Object.keys(excludedClockRepairFields))(
    'rejects punctuation in %s before the repair language transport',
    async (key) => {
      const model = new ModelClient({
        role: 'derive',
        id: 'invented-clock-transport',
        provider: {
          name: 'invented',
          baseUrl: 'https://invented.invalid/v1',
          api: 'chat_completions',
          configuredApi: 'chat_completions',
          apiResolution: 'explicit',
          apiResolutionError: null,
          apiKey: null,
          headers: {},
          maxRetries: 0,
        },
        enabled: true,
        requested: true,
        timeoutMs: 1111,
        unavailableReason: null,
        knowledgeLanguage: 'en',
        maxOutputTokens: 2400,
      });
      const requests: string[] = [];
      vi.spyOn(model as any, 'chatTransport').mockImplementation(async (...args: any[]) => {
        const [messages] = args;
        const payload = JSON.parse(messages.at(-1).content);
        const language = messages.some((message: any) => message.content.startsWith('Check the language'));
        requests.push(language ? 'language' : payload.repair_targets ? 'repair' : 'extraction');
        expect(requests.length).toBeLessThanOrEqual(3);
        const value = language
          ? { hint_roles: [], prose_result: { status: 'compliant', counterexample: null } }
          : payload.repair_targets
            ? { repairs: [{ ...delta, [key]: '.' }] }
            : { candidates: [original] };
        return { ok: true, latencyMs: 1, endpointRequests: 1, value: JSON.stringify(value) };
      });
      const result = await runRetain('', model, {
        sourceItems: [
          { item_id: 'turn-1111', role: 'user', speaker: 'Ada Marlow', text: proposal },
          { item_id: 'turn-2222', role: 'user', speaker: 'Ada Marlow', text: definition },
        ],
      });
      expect(requests).toEqual(['extraction', 'language', 'repair']);
      expect(result.candidates).toEqual([]);
      expect(result.modelUsage.verification).toBeNull();
    },
  );
  it.each([false, true])(
    'clones metadata and proof and preserves a final semantic hold: %s',
    async (negative) => {
      const { result, requests } = await run({ repairs: [delta] }, { negative });
      expect(requests).toHaveLength(3);
      expect(requests[1]!.payload.repair_targets[0].repair_contract.mode).toBe(
        'clock_text_only_with_exclusion',
      );
      expect(requests[1]!.options.maxTokens).toBe(3200);
      expect(requests[1]!.options.additionalLanguageProse?.({ repairs: [delta] })).toEqual([
        clockRepairText(delta),
      ]);
      const candidate = requests[2]!.payload.candidates[0];
      expect(candidate.text).toBe(clockRepairText(delta));
      for (const key of [
        'attribution',
        'discourse',
        'epistemic',
        'polarity',
        'support',
        'discourse_frame',
        'relations',
      ])
        expect(candidate[key]).toEqual((original as any)[key]);
      expect(requests[2]!.payload.repair_obligations[0].original).toEqual(original);
      expect(result.candidates).toHaveLength(negative ? 0 : 1);
      if (negative) expect(result.held[0]!.hold_stage).toBe('verification');
    },
  );
  it('omits the exclusion field when the source contains none', async () => {
    const source = definition.replace(', а не после обработки', '');
    const { excluded_reference_clocks: _, ...without } = delta;
    const record = {
      ...original,
      discourse_frame: [original.discourse_frame[0], { item_id: 'turn-2222', quote: source }],
    };
    const { result, requests } = await run({ repairs: [without] }, { record, definition: source });
    expect(requests[1]!.payload.repair_targets[0].repair_contract.mode).toBe('clock_text_only');
    expect(JSON.stringify(toEndpointSchema(requests[1]!.options.schema!))).not.toContain(
      'excluded_reference_clocks',
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.text).not.toContain('processing');
  });
  it.each([
    { ...original, relations: undefined },
    { ...original, relations: [{ type: 'caused_by' }] },
    { ...original, time: { ...original.time, mentioned_at: 'tomorrow' } },
    { ...original, text: proposal.replace('Zephyr QX-100', 'the device') },
    { ...original, discourse: { commitment: 'asserted', disposition: 'active' } },
    {
      ...original,
      text: 'A plan was not accepted or a meeting organized. Ada Marlow proposes a review next month.',
    },
  ])('does not specialize a candidate with another defect: %j', async (record) => {
    const { requests } = await run({ repairs: [] }, { record });
    expect(requests[1]!.payload.repair_targets[0]).not.toHaveProperty('repair_contract');
  });
  it.each([
    { ...delta, candidate_index: 7 },
    { ...delta, metadata: {} },
    { ...delta, unresolved_calendar_period: '' },
    ...Object.keys(excludedClockRepairFields).map((key) => ({ ...delta, [key]: '.' })),
    { ...delta, source_clock_anchor_and_unknown_date: 'x'.repeat(90) + '.' },
    { ...delta, excluded_reference_clocks: 'No processing clock\n.' },
    { ...delta, excluded_reference_clocks: 'No processing clock\u0000.' },
    { ...delta, excluded_reference_clocks: 'No processing clock' },
  ])('fails strict invalid deltas without a partial replacement: %j', async (entry) => {
    const { result, requests } = await run({ repairs: [entry] });
    expect(result.candidates).toEqual([]);
    expect(requests).toHaveLength(2);
  });
  it.each([
    JSON.stringify({ repairs: [delta] }).slice(0, -1),
    JSON.stringify({ repairs: [delta] }) + ' trailing',
    JSON.stringify({ repairs: [delta, delta] }),
  ])('does not salvage malformed transactions', async (repair) => {
    const { result, requests } = await run(repair, { raw: true });
    expect(result.candidates).toEqual([]);
    expect(requests).toHaveLength(2);
  });
  it('enforces each segment independently at the fixed combined cap', () => {
    for (const fields of [clockRepairFields, excludedClockRepairFields]) {
      const schema = z.strictObject(fields);
      const limits = fields === clockRepairFields ? [220, 110, 68] : [195, 90, 60, 52];
      const value = Object.fromEntries(
        Object.keys(fields).map((key, i) => [key, 'x'.repeat(limits[i]! - 1) + '.']),
      );
      expect(schema.safeParse(value).success).toBe(true);
      expect(clockRepairText(value as any)).toHaveLength(400);
      for (const key of Object.keys(fields)) {
        expect(schema.safeParse({ ...value, [key]: value[key] + '.' }).success).toBe(false);
        expect(schema.safeParse({ ...value, [key]: undefined }).success).toBe(false);
        for (const punctuation of ['.', '!', '...!', ' \t.'])
          expect(schema.safeParse({ ...value, [key]: punctuation }).success).toBe(false);
        for (const content of ['Срок неизвестен.', '1111.', '期限不明.'])
          expect(schema.safeParse({ ...value, [key]: content }).success).toBe(true);
      }
      expect(clockRepairLanguageProse({ repairs: [value] })).toEqual([clockRepairText(value as any)]);
      const wire = toEndpointSchema(schema);
      expect(strictModeViolations(wire)).toEqual([]);
      expect(JSON.stringify(wire)).not.toMatch(/"(?:oneOf|const)":/u);
      for (const field of Object.values(wire.properties as Record<string, { pattern: string }>))
        expect(field.pattern).toBe(String.raw`^[^\r\n\u0000]*[.!]$`);
    }
  });
});

describe('mixed original-position repair ownership', () => {
  it.each(['valid', 'malformed', 'duplicate'])(
    'supports all four disjoint branches with immutable noncontiguous siblings: %s',
    async (mode) => {
      const plainClock = definition.replace(', а не после обработки', '');
      const secondProposal = proposal.replace('repair terms', 'inspection terms');
      const reportProposition =
        'According to Bo Winters, the Zephyr QX-100 agreement permits adjusting a latch, not replacing it.';
      const reportRelay = "Ada Marlow only relays Bo Winters's account.";
      const reportLimit =
        'Ada Marlow has not read the agreement, independently checked the account, or personally verified this meaning.';
      const reportSource = `${reportProposition} ${reportRelay} ${reportLimit}`;
      const report = {
        ...original,
        kind: 'claim',
        text: `${reportProposition} Ada Marlow is only passing on this account: she has not read the agreement or independently checked the account, and she did not herself verify this meaning.`,
        attribution: {
          source_role: 'user',
          source_speaker: 'Ada Marlow',
          chain: [{ speaker: 'Bo Winters', role: 'external' }],
        },
        discourse: { commitment: 'asserted', disposition: 'active' },
        epistemic: { basis: 'source_report' },
        time: null,
        support: [{ item_id: 'report', quote: reportSource }],
        discourse_frame: [{ item_id: 'report', quote: reportSource }],
      };
      const clock = {
        ...original,
        text: secondProposal,
        support: [{ item_id: 'proposal-two', quote: secondProposal }],
        discourse_frame: [
          { item_id: 'proposal-two', quote: secondProposal },
          { item_id: 'clock-two', quote: plainClock },
        ],
      };
      const ordinary = [
        'Ada Marlow inspected Zephyr QX-100.',
        'Ada Marlow measured Zephyr QX-100.',
        'Ada Marlow cleaned Zephyr QX-100.',
        'Ada Marlow photographed Zephyr QX-100.',
      ].map((text, index) => ({
        ...original,
        kind: 'claim',
        text,
        discourse: { commitment: 'asserted', disposition: 'active' },
        time: null,
        support: [{ item_id: `ordinary-${index}`, quote: text }],
        discourse_frame: [{ item_id: `ordinary-${index}`, quote: text }],
      }));
      const records = [
        original,
        ordinary[0],
        report,
        ordinary[1],
        clock,
        ordinary[2],
        { ...ordinary[3], text: 'short' },
      ];
      const { excluded_reference_clocks: _, ...plainDelta } = delta;
      const repairs = [
        delta,
        {
          candidate_index: 2,
          reported_proposition: reportProposition,
          relay_attribution: reportRelay,
          personal_limits: reportLimit,
        },
        {
          ...plainDelta,
          candidate_index: 4,
          proposition_and_nontemporal_scope: delta.proposition_and_nontemporal_scope.replace(
            'repair terms',
            'inspection terms',
          ),
        },
        {
          candidate_index: 6,
          candidate: { ...ordinary[3], attribution: { ...ordinary[3]!.attribution, chain: [] }, page: null },
        },
      ];
      const sourceItems = [
        { item_id: 'turn-1111', text: proposal },
        { item_id: 'turn-2222', text: definition },
        { item_id: 'report', text: reportSource },
        { item_id: 'proposal-two', text: secondProposal },
        { item_id: 'clock-two', text: plainClock },
        ...ordinary.map((record, index) => ({ item_id: `ordinary-${index}`, text: record.text })),
      ].map((item) => ({ ...item, role: 'user' as const, speaker: 'Ada Marlow' }));
      const requests: any[] = [];
      const chat = vi.fn(async (messages: { content: string }[], options: ChatOptions) => {
        const payload = JSON.parse(messages.at(-1)!.content);
        requests.push(payload);
        if (requests.length === 1)
          return { ok: true, latencyMs: 11, value: JSON.stringify({ candidates: records }) };
        if (payload.repair_targets) {
          expect(payload.repair_targets.map((entry: any) => entry.candidate_index)).toEqual([0, 2, 4, 6]);
          expect(options.schema!.safeParse({ repairs }).success).toBe(true);
          for (const [entry, foreignIndex] of [
            [repairs[0], 2],
            [repairs[1], 4],
            [repairs[2], 6],
            [repairs[3], 0],
          ] as const)
            expect(
              options.schema!.safeParse({ repairs: [{ ...entry, candidate_index: foreignIndex }] }).success,
            ).toBe(false);
          const schema = toEndpointSchema(options.schema!);
          expect(strictModeViolations(schema)).toEqual([]);
          expect(JSON.stringify(schema)).not.toMatch(/"(?:oneOf|const)":/u);
          expect(options.additionalLanguageProse?.({ repairs })).toHaveLength(3);
          return {
            ok: true,
            latencyMs: 11,
            value:
              mode === 'malformed'
                ? JSON.stringify({ repairs }).slice(0, -1)
                : JSON.stringify({ repairs: mode === 'duplicate' ? [...repairs, repairs[0]] : repairs }),
          };
        }
        return {
          ok: true,
          latencyMs: 11,
          value: JSON.stringify({
            verdicts: payload.candidates.map((candidate: any) => ({
              candidate_id: candidate.candidate_id,
              source_selected_polarity: candidate.polarity,
              ...frameAuditFields(candidate),
              ...retentionAudit(candidate),
              proposition_supported: true,
              action_arguments_preserved: true,
              qualification_scope_preserved: true,
              reason_code: null,
            })),
          }),
        };
      });
      const result = await runRetain(
        '',
        {
          available: true,
          modelId: 'invented-four-branch',
          chat,
          reportInvalidResponse: vi.fn(),
          degradedReason: () => null,
        } as unknown as ModelClient,
        { sourceItems },
      );
      expect(result.candidates).toHaveLength(mode === 'valid' ? 7 : 3);
      if (mode === 'valid') expect(result.held).toEqual([]);
      const obligations = requests.flatMap((payload) => payload.repair_obligations ?? []);
      expect(obligations).toHaveLength(mode === 'valid' ? 4 : 0);
      if (mode === 'valid')
        for (const initialRecord of [records[0], records[2], records[4], records[6]])
          expect(
            obligations.some(
              (entry: any) => JSON.stringify(entry.original) === JSON.stringify(initialRecord),
            ),
          ).toBe(true);
      for (const record of ordinary.slice(0, 3))
        expect(result.candidates.find(({ text }) => text === record.text)?.support).toEqual(record.support);
      expect(requests.filter((payload) => payload.repair_targets)).toHaveLength(1);
    },
  );
});

describe('combined report and clock validation issues', () => {
  it('gives the sole full repair both known issues and rechecks a one-defect repair', async () => {
    const sourceLimit =
      'Ada Marlow has not read the agreement and has no independent confirmation of the account.';
    const unreadableLimit =
      'Ada Marlow is only passing on this account: she has not read the agreement or independently checked the account, and she did not herself verify this meaning.';
    const record = {
      ...original,
      epistemic: { basis: 'source_report' },
      text: proposal + ' ' + unreadableLimit,
      discourse_frame: [...original.discourse_frame, { item_id: 'limits', quote: sourceLimit }],
    };
    const oneDefect = {
      ...record,
      text: record.text.replace('next month', 'next month after the original record, whose date is unknown'),
    };
    expect(oneDefect.text.length).toBeLessThanOrEqual(400);
    const { result, requests } = await run(
      { repairs: [{ candidate_index: 0, candidate: oneDefect }] },
      {
        record,
        extraSourceItems: [{ item_id: 'limits', role: 'user', speaker: 'Ada Marlow', text: sourceLimit }],
      },
    );
    const target = requests[1]!.payload.repair_targets[0];
    expect(target).not.toHaveProperty('repair_contract');
    expect(target.validation_issues.map((issue: any) => issue.reason_code).sort()).toEqual([
      'discourse_uncertain',
      'time_unresolved',
    ]);
    expect(requests).toHaveLength(2);
    expect(result.candidates).toEqual([]);
    expect(result.held.some((held) => held.reason_code === 'discourse_uncertain')).toBe(true);
  });
});
