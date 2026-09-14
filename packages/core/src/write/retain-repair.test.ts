import { retentionAudit } from '../../test/semantic-audit.ts';
import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../models/client.ts';
import { cleanCandidateBatch, runRetain } from './retain.ts';

const report =
  'Ada Marlow recorded that Bo Winters said silverpine inspection might be included, not replacement. This report is unverified.';
const minor = 'Ada Marlow has not arranged shipment of silverpine.';
const source = `${report} ${minor}`;
const good = {
  text: minor,
  subject: 'silverpine',
  kind: 'claim',
  attribution: { source_role: 'user', source_speaker: 'Ada Marlow' },
  discourse: { commitment: 'asserted', disposition: 'active' },
  epistemic: { basis: 'self_attested' },
  polarity: 'negated',
  support: [{ quote: minor }],
  discourse_frame: [{ quote: minor }],
};
const fixed = {
  ...good,
  text: 'Ada Marlow relays Bo Winters’s unverified report that silverpine inspection might be included, not replacement.',
  attribution: {
    source_role: 'user',
    source_speaker: 'Ada Marlow',
    chain: [{ speaker: 'Bo Winters', role: 'external' }],
  },
  discourse: { commitment: 'tentative', disposition: 'active' },
  epistemic: { basis: 'source_report' },
  polarity: 'affirmed',
  support: [{ quote: report }],
  discourse_frame: [{ quote: report }],
};
const bad = { ...fixed, text: 'Bo Winters says silverpine inspection is included.' };

function modelFor(extracted: unknown[], repair: unknown, verify = true) {
  const chat = vi.fn(async (messages: { content: string }[]) => {
    const call = chat.mock.calls.length;
    if (call === 1)
      return {
        ok: true,
        value: JSON.stringify({
          candidates: extracted,
          events: [{ date: '2031-04-11', summary: 'Ada Marlow completed an invented inspection.' }],
        }),
        latencyMs: 11,
      };
    if (call === 2) {
      if (repair === 'unavailable')
        return { ok: false, value: null, error: 'invented repair outage', latencyMs: 22 };
      return { ok: true, value: repair === 'malformed' ? '{oops' : JSON.stringify(repair), latencyMs: 22 };
    }
    expect(call).toBeGreaterThanOrEqual(3);
    const payload = JSON.parse(messages.at(-1)!.content);
    return {
      ok: true,
      value: JSON.stringify({
        verdicts: payload.candidates.map(
          (c: { polarity: 'affirmed' | 'negated'; candidate_id: string; text: string }) => ({
            candidate_id: c.candidate_id,
            source_selected_polarity: c.polarity,
            ...retentionAudit(c, verify || c.text === minor, true, true),
            proposition_supported: verify || c.text === minor,
            action_arguments_preserved: true,
            qualification_scope_preserved: true,
            reason_code: null,
          }),
        ),
      }),
      latencyMs: 33,
    };
  });
  return {
    model: {
      available: true,
      modelId: 'invented-repair-model',
      chat,
      degradedReason: () => 'derive_failed',
      reportInvalidResponse: vi.fn(),
    } as unknown as ModelClient,
    chat,
  };
}

describe('one transactional structural repair', () => {
  it.each(['preserved', 'possession-to-action', 'limit-actor', 'drop-contrast'] as const)(
    'keeps report limits in the same compact record without repairing a semantic negative (%s)',
    async (mode) => {
      const embedded =
        'Bo Winters says Zephyr QX-100 terms permit return-spring measurement, not replacement.';
      const limit = 'Ada Marlow has not read the terms and has no independent confirmation of the report.';
      const fullSource = `According to Ada Marlow, ${embedded} ${limit}`;
      let text = fullSource;
      if (mode === 'possession-to-action')
        text = text.replace('has no independent confirmation of', 'has not independently confirmed');
      if (mode === 'limit-actor') text = text.replace(limit, limit.replace('Ada Marlow', 'Bo Winters'));
      if (mode === 'drop-contrast') text = text.replace(', not replacement', '');
      const candidate = {
        ...fixed,
        subject: 'Zephyr QX-100',
        text,
        discourse: { commitment: 'asserted', disposition: 'active' },
        support: [{ quote: fullSource }],
        discourse_frame: [{ quote: fullSource }],
      };
      expect(text.length).toBeLessThanOrEqual(400);
      expect(
        cleanCandidateBatch([candidate], { sourceText: fullSource, generated: true }).candidates,
      ).toHaveLength(1);
      const supported = mode === 'preserved';
      const chat = vi.fn(async (messages: { content: string }[]) => {
        if (chat.mock.calls.length === 1)
          return { ok: true, value: JSON.stringify({ candidates: [candidate] }), latencyMs: 11 };
        const input = JSON.parse(messages.at(-1)!.content);
        expect(input.source.text).toBe(fullSource);
        expect(input.candidates[0].text).toBe(text);
        return {
          ok: true,
          value: JSON.stringify({
            verdicts: [
              {
                candidate_id: input.candidates[0].candidate_id,
                source_selected_polarity: 'affirmed',
                ...retentionAudit(input.candidates[0], supported, supported, supported),
                proposition_supported: supported,
                action_arguments_preserved: supported,
                qualification_scope_preserved: supported,
                reason_code: supported ? null : 'discourse_uncertain',
              },
            ],
          }),
          latencyMs: 11,
        };
      });
      const model = {
        available: true,
        modelId: 'invented-report-presentation',
        chat,
        degradedReason: () => null,
        reportInvalidResponse: vi.fn(),
      } as unknown as ModelClient;
      const result = await runRetain(fullSource, model);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.candidates.map((c) => c.text)).toEqual(supported ? [text] : []);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it('repairs an unrecognized embedded personal limit into its own sentence without changing its meaning', async () => {
    const embedded =
      'According to Bo Winters, Zephyr QX-100 terms permit measuring the latch gap, not changing the latch; Ada Marlow is only relaying this meaning and has not read the agreement or independently checked Bo Winters’s account.';
    const text =
      'According to Ada Marlow, Bo Winters says Zephyr QX-100 terms permit measuring the latch gap, not changing the latch. Ada Marlow has not read the agreement or independently checked Bo Winters’s account.';
    const fullSource = text;
    const original = {
      ...fixed,
      subject: 'Zephyr QX-100',
      text: embedded,
      discourse: { commitment: 'asserted', disposition: 'active' },
      support: [{ quote: fullSource }],
      discourse_frame: [{ quote: fullSource }],
    };
    const repaired = { ...original, text };
    const { model, chat } = modelFor([original], { repairs: [{ candidate_index: 0, candidate: repaired }] });
    const result = await runRetain(fullSource, model);
    expect(chat).toHaveBeenCalledTimes(3);
    const repair = JSON.parse(chat.mock.calls[1]![0].at(-1)!.content);
    expect(repair.repair_targets[0].validation_issues[0].reason).toContain(
      'not recognized in a closed readable clause',
    );
    expect(result.candidates.map((c) => c.text)).toEqual([text]);
  });

  it.each([true, false])(
    'reports the precise text limit to its original repair position, retaining semantics (%s)',
    async (supported) => {
      const longText =
        "According to Ada Marlow's retelling of the words that Bo Winters provided, Bo Winters said that the service terms for Zephyr QX-100 permit sending this device to the service bench for measurement of the return spring, rather than replacement of that same spring; Ada Marlow has not read those service terms herself and has no independent confirmation of the report that she is relaying from Bo Winters.";
      const shortText =
        'According to Ada Marlow, Bo Winters says Zephyr QX-100 terms permit sending it to the service bench for return-spring measurement, not replacement; Ada Marlow has not read the terms and has no independent confirmation of the report.';
      const fullSource = `${longText} ${minor}`;
      const original = {
        ...fixed,
        subject: 'Zephyr QX-100',
        text: longText,
        discourse: { commitment: 'asserted', disposition: 'active' },
        support: [{ quote: longText }],
        discourse_frame: [{ quote: longText }],
      };
      const repaired = {
        ...original,
        text: supported
          ? shortText
          : shortText.replace(
              'has no independent confirmation of the report',
              'has not independently confirmed the report',
            ),
      };
      expect(longText.length).toBeGreaterThan(400);
      expect(repaired.text.length).toBeLessThanOrEqual(400);
      const { model, chat } = modelFor(
        [original, good],
        { repairs: [{ candidate_index: 0, candidate: repaired }] },
        supported,
      );
      const result = await runRetain(fullSource, model);
      expect(chat).toHaveBeenCalledTimes(3);
      const repair = JSON.parse(chat.mock.calls[1]![0].at(-1)!.content);
      expect(repair.source.text).toBe(fullSource);
      expect(repair.repair_targets).toEqual([
        {
          candidate_index: 0,
          original_candidate: original,
          validation_issues: [
            {
              reason_code: 'validation_failed',
              reason: `candidate text has ${longText.length} UTF-16 code units after whitespace normalization; maximum is 400. Shorten wording while preserving the complete source-supported proposition and every material qualification`,
            },
          ],
        },
      ]);
      expect(repair.read_only_admitted_context).toEqual([
        { candidate_index: 1, subject: good.subject, kind: good.kind, text: good.text },
      ]);
      const verification = JSON.parse(chat.mock.calls[2]![0].at(-1)!.content);
      expect(verification.source.text).toBe(fullSource);
      expect(verification.candidates.some((c: { text: string }) => c.text === repaired.text)).toBe(true);
      expect(verification.repair_obligations[0].original).toEqual(original);
      expect(result.candidates.map((c) => c.text)).toEqual(supported ? [shortText, minor] : [minor]);
      if (!supported) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([399, 400, 401])('enforces the normalized UTF-16 bound at %s units', (length) => {
    const prefix = 'Ada Marlow describes the label ';
    const text = prefix + 'x'.repeat(length - prefix.length - 1) + '.';
    const entry = {
      ...good,
      text,
      subject: 'Ada Marlow',
      polarity: 'affirmed',
      support: [{ quote: text }],
      discourse_frame: [{ quote: text }],
    };
    const result = cleanCandidateBatch([entry], { sourceText: text, generated: true });
    expect(result.candidates).toHaveLength(length <= 400 ? 1 : 0);
    if (length > 400) expect(result.held[0]?.reason).toContain('401 UTF-16 code units');
  });

  it('folds whitespace before measuring and counts astral symbols as two units', () => {
    const prefix = 'Ada Marlow describes the label ';
    const normalized = prefix + 'x'.repeat(399 - prefix.length - 1) + '.';
    const spaced = normalized.replaceAll(' ', ' \n\t ');
    const record = (text: string) => ({
      ...good,
      text,
      subject: 'Ada Marlow',
      polarity: 'affirmed',
      support: [{ quote: text }],
      discourse_frame: [{ quote: text }],
    });
    expect(
      cleanCandidateBatch([record(spaced)], { sourceText: spaced, generated: true }).candidates[0]?.text,
    ).toBe(normalized);
    const astral = normalized.slice(0, -1) + '🟦.';
    expect([...astral]).toHaveLength(400);
    expect(astral.length).toBe(401);
    expect(
      cleanCandidateBatch([record(astral)], { sourceText: astral, generated: true }).held[0]?.reason,
    ).toContain('401 UTF-16 code units');
  });

  it.each([true, false])(
    'repairs the deciding report while preserving the admitted minor record (verified=%s)',
    async (verify) => {
      const { model, chat } = modelFor(
        [bad, good],
        { repairs: [{ candidate_index: 0, candidate: fixed }] },
        verify,
      );
      const original = cleanCandidateBatch([bad, good], { sourceText: source, generated: true }).candidates;
      expect(original).toHaveLength(1);
      const result = await runRetain(source, model);
      expect(chat).toHaveBeenCalledTimes(3);
      const request = JSON.parse(chat.mock.calls[1]![0].at(-1)!.content);
      expect(request.read_only_admitted_context).toEqual([
        { candidate_index: 1, subject: good.subject, kind: good.kind, text: good.text },
      ]);
      expect(request.rejected_candidates).toBeUndefined();
      expect(request.repair_targets).toHaveLength(1);
      expect(request.repair_targets[0]).toMatchObject({ candidate_index: 0, original_candidate: bad });
      const verificationRequest = JSON.parse(chat.mock.calls[2]![0].at(-1)!.content);
      expect(verificationRequest.repair_obligations).toEqual([
        {
          candidate_id: verificationRequest.candidates.find(
            (candidate: { text: string }) => candidate.text === fixed.text,
          ).candidate_id,
          original: bad,
        },
      ]);
      expect(
        request.repair_targets.map((entry: { candidate_index: number }) => entry.candidate_index),
      ).toEqual([0]);
      expect(result.candidates.find((candidate) => candidate.text === minor)).toEqual(original[0]);
      expect(result.candidates).toHaveLength(verify ? 2 : 1);
      expect(result.modelUsage.repair?.latency_ms).toBe(22);
      expect(result.degradedReason).toBeNull();
      expect(result.events).toEqual([
        { date: '2031-04-11', summary: 'Ada Marlow completed an invented inspection.' },
      ]);
      if (!verify) expect(result.held[0]?.hold_stage).toBe('verification');
    },
  );

  it.each([
    'unavailable',
    'malformed',
    {
      repairs: [
        { candidate_index: 0, candidate: fixed },
        { candidate_index: 0, candidate: fixed },
      ],
    },
    { repairs: [{ candidate_index: 2, candidate: fixed }] },
    { repairs: [{ candidate_index: 1, candidate: fixed }] },
    { repairs: [{ candidate_index: 0.5, candidate: fixed }] },
    { repairs: [{ candidate_index: -1, candidate: fixed }] },
    { repairs: [{ candidate_index: 0, candidate: good }] },
    {
      repairs: [{ candidate_index: 0, candidate: fixed }],
      events: [{ date: '2031-05-22', summary: 'An unauthorized event.' }],
    },
  ])('preserves and verifies admitted records after an invalid repair: %j', async (repair) => {
    const { model, chat } = modelFor([bad, good], repair);
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(result.candidates).toEqual(
      cleanCandidateBatch([bad, good], { sourceText: source, generated: true }).candidates,
    );
    expect(result.held).toHaveLength(1);
    expect(result.held[0]?.hold_stage).toBe('validation');
    expect(result.error).toBeNull();
    expect(result.degradedReason).toBe('derive_failed');
  });

  it('keeps omitted failed positions held and still verifies admitted records', async () => {
    const { model, chat } = modelFor([bad, good], { repairs: [] });
    const result = await runRetain(source, model);
    expect(result.candidates).toHaveLength(1);
    expect(result.held).toHaveLength(1);
    expect(result.degradedReason).toBeNull();
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('uses the same position transaction for an all-held batch', async () => {
    const { model, chat } = modelFor([bad], { repairs: [{ candidate_index: 0, candidate: fixed }] });
    const result = await runRetain(source, model);
    expect(result.candidates).toHaveLength(1);
    expect(result.held).toEqual([]);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(JSON.parse(chat.mock.calls[1]![0].at(-1)!.content).read_only_admitted_context).toEqual([]);
  });

  it('binds noncontiguous repair targets to their original drafts, not their target-array offsets', async () => {
    const secondBad = JSON.parse(JSON.stringify(bad).replaceAll('silverpine', 'amberleaf'));
    const secondFixed = JSON.parse(JSON.stringify(fixed).replaceAll('silverpine', 'amberleaf'));
    const { model, chat } = modelFor([bad, good, secondBad], {
      repairs: [
        { candidate_index: 2, candidate: secondFixed },
        { candidate_index: 0, candidate: fixed },
      ],
    });
    const fullSource = `${source} ${report.replaceAll('silverpine', 'amberleaf')}`;
    const result = await runRetain(fullSource, model);
    const request = JSON.parse(chat.mock.calls[1]![0].at(-1)!.content);
    expect(
      request.repair_targets.map((target: { candidate_index: number }) => target.candidate_index),
    ).toEqual([0, 2]);
    expect(
      request.repair_targets.map((target: { original_candidate: unknown }) => target.original_candidate),
    ).toEqual([bad, secondBad]);
    expect(
      request.repair_targets.every(
        (target: { validation_issues: unknown[] }) => target.validation_issues.length > 0,
      ),
    ).toBe(true);
    expect(request.read_only_admitted_context).toEqual([
      { candidate_index: 1, subject: good.subject, kind: good.kind, text: good.text },
    ]);
    expect(result.candidates.map((candidate) => candidate.text)).toEqual([
      fixed.text,
      minor,
      secondFixed.text,
    ]);
    expect(result.degradedReason).toBeNull();
    const obligations = chat.mock.calls
      .slice(2)
      .flatMap((call) => JSON.parse(call[0].at(-1)!.content).repair_obligations);
    expect(obligations.map((obligation: { original: unknown }) => obligation.original)).toEqual([
      bad,
      secondBad,
    ]);
    expect(chat).toHaveBeenCalledTimes(4); // Extraction, one repair and two existing verification batches.
  });

  it('rejects two failed positions repaired into one duplicate proposition', async () => {
    const brokenMinor = { ...good, text: 'Shipment unarranged.' };
    const { model, chat } = modelFor([bad, brokenMinor], {
      repairs: [
        { candidate_index: 0, candidate: fixed },
        { candidate_index: 1, candidate: fixed },
      ],
    });
    const result = await runRetain(source, model);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.held).toHaveLength(2);
    expect(result.degradedReason).toBe('derive_failed');
    expect(result.error).toContain('lost an original position');
  });

  it.each([1, 0, 2])('keeps original relation indices after a repair (target=%s)', async (target) => {
    const old = 'Ada Marlow states that the silverpine warranty lasts five years.';
    const replacement = 'Bo Winters states that the silverpine warranty lasts seven years.';
    const conflict = 'These assertions contradict each other.';
    const fullSource = `${old} ${replacement} ${conflict}`;
    const admitted = {
      ...good,
      text: old,
      polarity: 'affirmed',
      support: [{ quote: old }],
      discourse_frame: [{ quote: old }],
    };
    const repaired = {
      ...fixed,
      text: replacement,
      attribution: { source_role: 'external', source_speaker: 'Bo Winters' },
      discourse: { commitment: 'asserted', disposition: 'active' },
      support: [{ quote: replacement }],
      discourse_frame: [{ quote: fullSource }],
      relations: [{ type: 'contradicts', target_candidate: target, support: [{ quote: conflict }] }],
    };
    const broken = { ...repaired, text: 'silverpine warranty' };
    const { model, chat } = modelFor([broken, admitted], {
      repairs: [{ candidate_index: 0, candidate: repaired }],
    });
    const result = await runRetain(fullSource, model);
    const kept = result.candidates.find((candidate) => candidate.text === old)!;
    expect(kept).toBeDefined();
    expect(result.candidates).toHaveLength(target === 1 ? 2 : 1);
    if (target === 1)
      expect(result.candidates[0]?.relations[0]?.target).toEqual({ candidate_id: kept.candidate_id });
    else expect(result.held).toHaveLength(1);
    expect(chat).toHaveBeenCalledTimes(3);
  });
});
