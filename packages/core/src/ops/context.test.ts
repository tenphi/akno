import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecallResult } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { context } from './context.ts';
import { recall } from './recall.ts';

vi.mock('./recall.ts', () => ({ recall: vi.fn() }));

const mockedRecall = vi.mocked(recall);

beforeEach(() => mockedRecall.mockReset());

describe('auto-recall reference resolution', () => {
  it('binds a subjectless question fragment to one identity from recent conversation', async () => {
    mockedRecall.mockResolvedValueOnce(
      recallResult([credential('Ada Marlow'), credential('Bo Winters')]) as never,
    );

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'Current credential code (international)?',
      conversation_context: [
        { role: 'user', content: "What is Ada Marlow's membership number?" },
        { role: 'assistant', content: "Ada Marlow's membership number is 1111." },
      ],
    });

    expect(mockedRecall).toHaveBeenCalledOnce();
    expect(mockedRecall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.stringContaining("Ada Marlow's membership number is 1111."),
        rerank: false,
      }),
    );
    expect(result.activation).toMatchObject({
      activated: true,
      selected: 1,
      reference_resolution: 'resolved',
    });
    expect(result.results.map((entry) => (entry.type === 'page' ? entry.slug : entry.path))).toEqual([
      'people/ada-marlow-credential',
    ]);
    expect(result.searched).toEqual(['Current credential code (international)?']);
  });

  it('keeps only the resolved subject when supporting evidence needs qualification', async () => {
    mockedRecall
      .mockResolvedValueOnce(
        recallResult([credential('Ada Marlow', false, 0.5), credential('Bo Winters', false, 0.5)]) as never,
      )
      .mockResolvedValueOnce(
        recallResult([credential('Ada Marlow', false, 1), credential('Bo Winters', false, 1)], {
          model: 'llm',
          applied: true,
          judged: 2,
          rejected: 0,
          unjudged: 0,
          basis: 'llm_grade',
          threshold: null,
        }) as never,
      );

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'Current credential code (international)?',
      conversation_context: [{ role: 'user', content: 'The preceding exchange was about Ada Marlow.' }],
    });

    expect(result.status).toBe('ok');
    expect(result.activation).toMatchObject({
      activated: true,
      basis: 'qualified',
      selected: 1,
      reference_resolution: 'resolved',
    });
    expect(result.results.map((entry) => (entry.type === 'page' ? entry.slug : entry.path))).toEqual([
      'people/ada-marlow-credential',
    ]);
  });

  it('does not let qualification substitute a different conversational subject', async () => {
    mockedRecall
      .mockResolvedValueOnce(
        recallResult([credential('Ada Marlow', false, 0.5), credential('Bo Winters', false, 0.5)]) as never,
      )
      .mockResolvedValueOnce(
        recallResult([personProfile('Ada Marlow'), credential('Bo Winters', false, 1)], {
          model: 'llm',
          applied: true,
          judged: 3,
          rejected: 1,
          unjudged: 0,
          basis: 'llm_grade',
          threshold: null,
        }) as never,
      );

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'Current credential code (international)?',
      conversation_context: [{ role: 'user', content: 'The preceding exchange was about Ada Marlow.' }],
    });

    expect(mockedRecall).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('empty');
    expect(result.results).toEqual([]);
    expect(result.activation).toMatchObject({
      activated: false,
      qualification_run: true,
      reference_resolution: 'resolved',
    });
  });

  it('reports ambiguity and abstains when recent conversation names multiple candidate subjects', async () => {
    mockedRecall
      .mockResolvedValueOnce(recallResult([credential('Ada Marlow'), credential('Bo Winters')]) as never)
      .mockResolvedValueOnce(
        recallResult([credential('Ada Marlow', true, 1)], {
          model: 'llm',
          applied: true,
          judged: 2,
          rejected: 1,
          unjudged: 0,
          basis: 'llm_grade',
          threshold: null,
        }) as never,
      );

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'Current credential code (international)?',
      conversation_context: [{ role: 'user', content: 'Compare Ada Marlow and Bo Winters.' }],
    });

    expect(result.status).toBe('empty');
    expect(result.results).toEqual([]);
    expect(result.note).toMatch(/multiple candidate subjects/u);
    expect(result.activation).toMatchObject({
      activated: false,
      qualification_run: true,
      reference_resolution: 'ambiguous',
    });
  });

  it('does not guess an omitted subject when no resolving conversation was supplied', async () => {
    mockedRecall
      .mockResolvedValueOnce(recallResult([credential('Ada Marlow'), credential('Bo Winters')]) as never)
      .mockResolvedValueOnce(
        recallResult([credential('Bo Winters', true, 1)], {
          model: 'llm',
          applied: true,
          judged: 2,
          rejected: 1,
          unjudged: 0,
          basis: 'llm_grade',
          threshold: null,
        }) as never,
      );

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'Current credential code (international)?',
    });

    expect(result.status).toBe('empty');
    expect(result.results).toEqual([]);
    expect(result.activation).toMatchObject({
      activated: false,
      qualification_run: true,
      reference_resolution: 'unresolved',
    });
  });

  it('does not require conversation when a locally phrased query names the candidate explicitly', async () => {
    mockedRecall.mockResolvedValueOnce(recallResult([credential('Ada Marlow')]) as never);

    const result = await context({} as AknoContext, {
      profile: 'auto_recall',
      query: 'What about Ada Marlow credential?',
    });

    expect(mockedRecall).toHaveBeenCalledOnce();
    expect(result.status).toBe('ok');
    expect(result.activation).toMatchObject({
      activated: true,
      reference_resolution: 'not_needed',
    });
  });
});

function credential(person: 'Ada Marlow' | 'Bo Winters', exact = true, relevance = 0.5): RecallResult {
  const slug = person === 'Ada Marlow' ? 'ada-marlow' : 'bo-winters';
  return {
    type: 'page',
    slug: `people/${slug}-credential`,
    title: `${person} travel credential`,
    role: 'memory',
    summary: null,
    score: relevance,
    relevance,
    lines: [
      {
        n: 3,
        text: exact
          ? `${person}'s current international credential code is ${person === 'Ada Marlow' ? '1111' : '2222'}.`
          : `${person}'s travel credential identifier is ${person === 'Ada Marlow' ? '1111' : '2222'}.`,
      },
    ],
  };
}

function personProfile(person: 'Ada Marlow' | 'Bo Winters'): RecallResult {
  const slug = person === 'Ada Marlow' ? 'ada-marlow' : 'bo-winters';
  return {
    type: 'page',
    slug: `people/${slug}`,
    title: person,
    role: 'memory',
    summary: null,
    score: 1,
    relevance: 1,
    lines: [{ n: 3, text: `${person} prefers quiet appointments.` }],
  };
}

function recallResult(results: RecallResult[], qualification?: Record<string, unknown>) {
  return {
    status: 'ok',
    results,
    searched: ['invented query'],
    budget_used: 111,
    scores: 'absolute',
    mode: 'lookup',
    memory_view: 'factual',
    ...(qualification ? { qualification } : {}),
  };
}
