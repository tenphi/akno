import { describe, expect, it } from 'vitest';
import { qualifyManagedMemoryLines } from './managed-lines.ts';

const SUPPORT = 'aaaaaaaaaaaa@bbbbbbbbbbbb@cccccccccccc@provided';

describe('managed memory line qualification', () => {
  it('labels canonical memory as answer eligible', () => {
    const fileLines = [
      `<!-- akno:item mem_claim v=2 supports=${SUPPORT} level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->`,
      '- Ada Marlow selected the five-year Zephyr QX-100 warranty.',
    ];

    expect(qualifyManagedMemoryLines([{ n: 2, text: fileLines[1]! }], fileLines)).toEqual([
      {
        n: 2,
        text: fileLines[1],
        memory: {
          status: 'qualified',
          id: 'mem_claim',
          level: 1,
          kind: 'claim',
          subject: 'unresolved',
          source_role: 'user',
          commitment: 'asserted',
          disposition: 'active',
          polarity: 'affirmed',
          basis: 'self_attested',
          answer_eligible: true,
          current_eligible: true,
        },
      },
    ]);
  });

  it.each([
    ['reported', 'claim', 'asserted', 'active', 'source_report'],
    ['hypothetical', 'claim', 'hypothetical', 'active', 'self_attested'],
    ['proposal', 'plan', 'asserted', 'proposed', 'self_attested'],
    ['rejected', 'decision', 'asserted', 'rejected', 'self_attested'],
  ] as const)(
    'keeps a %s memory searchable but not answer eligible',
    (_case, kind, commitment, disposition, basis) => {
      const fileLines = [
        `<!-- akno:item mem_case v=2 supports=${SUPPORT} level=1 kind=${kind} subject=unresolved source-role=user reports=0 commitment=${commitment} disposition=${disposition} polarity=affirmed basis=${basis} -->`,
        '- Invented qualified memory payload.',
      ];

      const [line] = qualifyManagedMemoryLines([{ n: 2, text: fileLines[1]! }], fileLines);
      expect(line?.memory?.answer_eligible).toBe(false);
    },
  );

  it('does not infer semantics for ordinary prose or a separated marker', () => {
    const fileLines = [
      `<!-- akno:item mem_claim v=2 supports=${SUPPORT} level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested -->`,
      '',
      'Ordinary invented prose.',
    ];

    expect(qualifyManagedMemoryLines([{ n: 3, text: fileLines[2]! }], fileLines)).toEqual([
      { n: 3, text: fileLines[2] },
    ]);
  });

  it('fails closed when an owned marker exists but its semantics are unavailable', () => {
    const fileLines = [
      '<!-- akno:item mem_legacy source=fixture%3Alegacy origin=assistant -->',
      '- Invented legacy memory payload.',
    ];

    expect(qualifyManagedMemoryLines([{ n: 2, text: fileLines[1]! }], fileLines)).toEqual([
      {
        n: 2,
        text: fileLines[1],
        memory: { status: 'unavailable', id: 'mem_legacy', answer_eligible: false },
      },
    ]);
  });

  it('does not make a planned future event ordinary factual answer evidence', () => {
    const fileLines = [
      `<!-- akno:item mem_plan v=2 supports=${SUPPORT} level=1 kind=event subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested relation=scheduled temporal=planned precision=day start=2031-04-02 mentioned=2031-04-01T09%3A00%3A00Z -->`,
      '- **Planned:** Ada Marlow plans to visit Blackwater Bay.',
    ];

    const [line] = qualifyManagedMemoryLines([{ n: 2, text: fileLines[1]! }], fileLines);
    expect(line?.memory).toMatchObject({
      status: 'qualified',
      kind: 'event',
      answer_eligible: false,
      current_eligible: false,
      temporal: {
        clock_relation: expect.any(String),
        actionable: true,
      },
    });
  });

  it('distinguishes historical validity from static answer eligibility at the requested clock', () => {
    const fileLines = [
      `<!-- akno:item mem_state v=2 supports=${SUPPORT} level=1 kind=claim subject=unresolved source-role=user reports=0 commitment=asserted disposition=active polarity=affirmed basis=self_attested relation=valid temporal=actual precision=day start=2031-04-01 until=2031-04-02 -->`,
      '- Ada Marlow uses the Zephyr QX-100 during the trial.',
    ];
    const [line] = qualifyManagedMemoryLines([{ n: 2, text: fileLines[1]! }], fileLines, {
      asOf: '2031-04-12T10:00:00+02:00',
      timezone: 'Europe/Amsterdam',
    });
    expect(line?.memory).toMatchObject({
      answer_eligible: true,
      current_eligible: false,
      temporal: { clock_relation: 'past', actionable: false },
    });
  });
});
