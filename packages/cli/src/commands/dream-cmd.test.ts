import type { DreamReport, MaintenanceStatus } from '@tenphi/akno-core';
import { describe, expect, it } from 'vitest';
import {
  curationGuardSummary,
  dreamProgressDescription,
  dreamRunExitCode,
  dreamRunIsReadOnly,
  dreamStatusJson,
  dreamStatusQuery,
  safeDreamReport,
} from './dream-cmd.ts';

describe('dream output privacy', () => {
  it('reduces a content-bearing report to a shareable operational receipt', () => {
    const report = privateReport();
    const safe = JSON.stringify(safeDreamReport(report));

    expect(safe).not.toContain('Ada Marlow');
    expect(safe).not.toContain('111 Example Street');
    expect(safe).not.toContain('people/ada-marlow');
    expect(safe).not.toContain('https://example.test/private');
    expect(safe).not.toContain('/private/state/dream.jsonl');
    expect(safe).toContain('value preservation');
    expect(safe).toContain('pln_example');
    expect(safe).toContain('itm_example');
    expect(safe).toContain('chg_example');
    expect(safe).toContain('run_example');
    expect(safe).toContain('"componentCount":2');
    expect(safe).toContain('"graphCandidates":1');
    expect(safe).toContain('"embeddingCacheHits":2');
    expect(safe).toContain('"managedItems":{"eligiblePages":1');
  });

  it('collapses raw source contexts into one guardrail category per page', () => {
    expect(curationGuardSummary(privateReport())).toContainEqual({
      category: 'value preservation',
      pages: 1,
      issues: 2,
    });
  });
});

describe('dream authority output', () => {
  it('labels audit and review modes as read-only even without the legacy dry-run flag', () => {
    const report = privateReport();

    expect(dreamRunIsReadOnly({ run: { ...report.run, mode: 'audit', dryRun: false } })).toBe(true);
    expect(dreamRunIsReadOnly({ run: { ...report.run, mode: 'review', dryRun: false } })).toBe(true);
    expect(dreamRunIsReadOnly(report)).toBe(false);
  });

  it('fails the command only for a failed run outcome', () => {
    const run = privateReport().run;

    expect(dreamRunExitCode({ ...run, status: 'failed' })).toBe(1);
    expect(dreamRunExitCode({ ...run, status: 'partially_completed' })).toBe(0);
    expect(dreamRunExitCode({ ...run, status: 'awaiting_review' })).toBe(0);
    expect(dreamRunExitCode(run)).toBe(0);
  });
});

describe('dream status history views', () => {
  it('parses one bounded history selector', () => {
    expect(dreamStatusQuery({ run: 'run_example' })).toEqual({ runId: 'run_example' });
    expect(dreamStatusQuery({ last: '5' })).toEqual({ last: 5 });
    expect(dreamStatusQuery({ pending: true })).toEqual({ pending: true });
    expect(dreamStatusQuery({})).toEqual({});
    expect(() => dreamStatusQuery({ run: 'run_example', pending: true })).toThrow(/only one/);
    expect(() => dreamStatusQuery({ last: '0' })).toThrow(/1 to 100/);
    expect(() => dreamStatusQuery({ last: '101' })).toThrow(/1 to 100/);
  });

  it('returns a narrow content-safe JSON shape for each explicit view', () => {
    const status = emptyStatus();
    const report = privateReport();
    status.runs = [report.run];
    status.pendingPlans = [report.maintenancePlan!];

    expect(dreamStatusJson(status, { runId: report.run.id })).toEqual({ run: report.run });
    expect(dreamStatusJson(status, { last: 5 })).toEqual({ runs: [report.run] });
    expect(dreamStatusJson(status, { pending: true })).toEqual({
      awaitingHuman: 0,
      verificationPending: 0,
      budgetDeferred: 0,
      pendingPlans: [report.maintenancePlan],
    });
    const schedule = {
      label: 'dev.akno.dream' as const,
      installed: true,
      loaded: true,
      installedAt: '2030-01-01T12:00:00.000Z',
      hour: 3,
      minute: 0,
      timezone: 'Europe/Amsterdam',
      previousExpectedAt: '2030-01-02T02:00:00.000Z',
      nextExpectedAt: '2030-01-03T02:00:00.000Z',
      graceUntil: '2030-01-02T04:00:00.000Z',
      latestFullRun: { id: report.run.id, status: report.run.status, startedAt: report.run.startedAt },
      missedCycleCheck: {
        label: 'dev.akno.dream-health' as const,
        installed: true,
        loaded: true,
        hour: 5,
        minute: 5,
      },
      health: 'on_time' as const,
    };
    expect(dreamStatusJson(status, {}, schedule)).toEqual({ ...status, schedule });
  });
});

describe('dream wait progress', () => {
  it('reports planning before a plan is sealed', () => {
    expect(
      dreamProgressDescription(
        { elapsedMs: 5_000, via: 'socket', status: emptyStatus() },
        Date.now(),
        'curate',
        'auto',
      ),
    ).toEqual({ stage: 'curate: planning candidates', writeState: 'KB write not started' });
  });

  it('distinguishes curator, write, and verified stages without page content', () => {
    const startedAt = Date.now();
    const deciding = statusAt(startedAt, 'deciding', 0);
    const applying = statusAt(startedAt, 'applying', 0);
    const complete = statusAt(startedAt, 'completed', 2);

    expect(
      dreamProgressDescription(
        { elapsedMs: 20_000, via: 'socket', status: deciding },
        startedAt,
        'curate',
        'auto',
      ),
    ).toEqual({ stage: 'curate: independent curator', writeState: 'KB write not started' });
    expect(
      dreamProgressDescription(
        { elapsedMs: 30_000, via: 'socket', status: applying },
        startedAt,
        'curate',
        'auto',
      ),
    ).toEqual({
      stage: 'curate: applying approved items',
      writeState: 'KB write or verification in progress',
    });
    expect(
      dreamProgressDescription(
        { elapsedMs: 40_000, via: 'socket', status: complete },
        startedAt,
        'curate',
        'auto',
      ),
    ).toEqual({ stage: 'curate: plan completed', writeState: '2 item(s) written and verified' });
  });
});

function privateReport(): DreamReport {
  const semanticMerge: DreamReport['semanticMerge'] = {
    pagesConsidered: 2,
    pagesPrepared: 2,
    pagesSkipped: 0,
    embeddingCacheHits: 2,
    embeddingInputs: 0,
    embeddingCalls: 0,
    pairsCompared: 1,
    prefilteredPairs: 1,
    classifierCandidates: 1,
    classifierCacheHits: 1,
    classifierCalls: 0,
    qualifiedPairs: 0,
  };
  const modelUsage: DreamReport['modelUsage'] = {
    modelId: 'zephyr-model',
    calls: 2,
    successfulCalls: 2,
    failedCalls: 0,
    usageReportedCalls: 2,
    inputTokens: 222,
    outputTokens: 44,
    totalTokens: 266,
    latencyMs: 111,
    stages: [
      {
        stage: 'curate',
        calls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        usageReportedCalls: 1,
        inputTokens: 111,
        outputTokens: 22,
        totalTokens: 133,
        latencyMs: 55,
      },
      {
        stage: 'curator',
        calls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        usageReportedCalls: 1,
        inputTokens: 111,
        outputTokens: 22,
        totalTokens: 133,
        latencyMs: 56,
      },
    ],
  };
  return {
    run: {
      id: 'run_example',
      startedAt: '2030-01-02T03:04:00.000Z',
      finishedAt: '2030-01-02T03:04:01.000Z',
      status: 'completed',
      profile: 'autonomous',
      mode: 'auto',
      dryRun: false,
      requestedPhase: 'curate',
      snapshot: {
        capturedAt: '2030-01-02T03:04:00.000Z',
        schemaVersion: 13,
        indexRevision: 'index_fingerprint_example',
        knowledgeBaseFingerprint: 'knowledge_fingerprint_example',
        configurationFingerprint: 'configuration_fingerprint_example',
        indexedFiles: 2,
        requestedPhases: ['curate'],
        plannerVersion: 'dream-lifecycle-v2',
        modelId: 'zephyr-model',
      },
      phases: [{ phase: 'curate', ran: true, skipped: false, durationMs: 111 }],
      counts: {
        observations: 1,
        curated: 1,
        rejectedByGuard: 1,
        adopted: 1,
        conflicts: 0,
        repairedLinks: 0,
        warnings: 1,
      },
      budget: {
        limits: { maxItems: 30, maxFilesChanged: 40, maxBytesWritten: 500000, maxHighRiskItems: 3 },
        used: { items: 1, filesChanged: 1, bytesWritten: 111, highRiskItems: 1 },
        deferredItems: 0,
      },
      modelUsage,
      degraded: [],
      semanticMerge,
      verification: fixtureVerification(),
      durationMs: 111,
      maintenancePlanIds: ['pln_example'],
      maintenancePlanId: 'pln_example',
      changeIds: ['chg_example'],
      errorCode: null,
      persisted: true,
    },
    phases: [{ phase: 'curate', ran: true, durationMs: 111 }],
    observations: [
      {
        slug: 'people/ada-marlow',
        pattern: 'Ada Marlow prefers a private routine.',
        evidence: ['people/ada-marlow'],
        action: 'created',
      },
    ],
    curated: [
      {
        slug: 'people/ada-marlow',
        mode: 'synthesize',
        action: 'rejected',
        splits: [],
        extractions: [],
        merges: [],
        issues: [
          'numeric/date/value tokens missing from rewrite: "111"',
          'source body line 7 for "111": Ada Marlow lives at 111 Example Street.',
          'new external URL was invented instead of supplied by evidence: https://example.test/private',
        ],
      },
    ],
    managedItems: {
      eligiblePages: 1,
      inspectedMarkers: 2,
      plannedPages: 1,
      suppressedPages: 0,
      findings: {
        empty_marker: 1,
        malformed_marker: 0,
        legacy_marker: 0,
        duplicate_item: 0,
        misplaced_item: 0,
        source_unavailable: 0,
        item_conflict: 0,
        valid: 1,
      },
      outcomes: { planned: 1, held: 0, valid: 1, suppressed: 0 },
    },
    rejected: [
      { pattern: 'Ada Marlow has a private pattern.', reason: 'Private evidence was insufficient.' },
    ],
    adopted: [
      {
        slug: 'people/ada-marlow/private-file',
        files: ['people/ada-marlow/private-file.pdf'],
        action: 'skipped',
        reason: 'A private page already exists.',
      },
    ],
    conflicts: [],
    repaired: null,
    repairChangeId: null,
    housekeeping: {
      brokenLinks: [],
      orphanedDocuments: [],
      drift: [],
      graphCandidates: [
        {
          kind: 'identity_collision',
          subject: 'people/ada-marlow',
          related: ['people/ada-marlow-private'],
          occurrences: 1,
          reason: 'Ada Marlow has a private graph identity collision.',
          fingerprint: 'graph_fingerprint_example',
        },
      ],
      counts: { brokenLinks: 0, orphanedDocuments: 0, drift: 0, graphCandidates: 1 },
    },
    changeId: null,
    adoptChangeId: null,
    curateChangeId: null,
    maintenancePlan: {
      id: 'pln_example',
      createdAt: '2030-01-02T03:04:00.000Z',
      updatedAt: '2030-01-02T03:04:01.000Z',
      mode: 'auto',
      phase: 'curate',
      status: 'completed',
      fingerprint: 'fingerprint_example',
      summary: 'curate: 1 page',
      error: null,
      counts: itemCounts(1),
      items: [
        {
          id: 'itm_example',
          kind: 'synthesis',
          policy: 'auto',
          risk: 'high',
          componentCount: 2,
          subject: 'people/ada-marlow',
          status: 'applied',
          statusCode: null,
          decision: {
            actor: 'curator',
            outcome: 'approve',
            reason: 'Ada Marlow content is safe.',
            at: '2030-01-02T03:04:00.000Z',
          },
          statusReason: null,
          changeId: 'chg_example',
          verification: {
            status: 'passed',
            detail: 'people/ada-marlow.md matches private bytes.',
            at: '2030-01-02T03:04:01.000Z',
          },
        },
      ],
    },
    maintenancePlans: [],
    budget: {
      limits: { maxItems: 30, maxFilesChanged: 40, maxBytesWritten: 500000, maxHighRiskItems: 3 },
      used: { items: 1, filesChanged: 1, bytesWritten: 111, highRiskItems: 1 },
      deferredItems: 0,
    },
    modelUsage,
    degraded: [],
    semanticMerge,
    verification: fixtureVerification(),
    warnings: ['people/ada-marlow: private warning'],
    durationMs: 111,
    logPath: '/private/state/dream.jsonl',
  };
}

function fixtureVerification(): NonNullable<DreamReport['verification']> {
  return {
    status: 'passed',
    checkedAt: '2030-01-02T03:04:01.000Z',
    plans: 1,
    appliedItems: 1,
    affectedFiles: 1,
    checks: {
      appliedItems: 'passed',
      affectedPaths: 'passed',
      budget: 'passed',
      modelUsage: 'passed',
    },
    issues: [],
  };
}

function emptyStatus(): MaintenanceStatus {
  return {
    authority: fixtureAuthority(),
    notifications: 'off',
    latest: null,
    latestRun: null,
    latestFullRun: null,
    runs: [],
    pendingPlans: [],
    active: 0,
    activeRuns: 0,
    awaitingHuman: 0,
    budgetDeferred: 0,
    verificationPending: 0,
  };
}

function statusAt(
  startedAt: number,
  status: NonNullable<MaintenanceStatus['latest']>['status'],
  applied: number,
): MaintenanceStatus {
  return {
    authority: fixtureAuthority(),
    notifications: 'off',
    latest: {
      id: 'pln_example',
      createdAt: new Date(startedAt).toISOString(),
      updatedAt: new Date(startedAt + 1_000).toISOString(),
      mode: 'auto',
      phase: 'curate',
      status,
      fingerprint: 'fingerprint_example',
      summary: 'curate: 2 pages',
      error: null,
      counts: itemCounts(applied),
    },
    latestRun: null,
    latestFullRun: null,
    runs: [],
    pendingPlans: [],
    active: status === 'completed' ? 0 : 1,
    activeRuns: 0,
    awaitingHuman: 0,
    budgetDeferred: 0,
    verificationPending: 0,
  };
}

function fixtureAuthority(): MaintenanceStatus['authority'] {
  return {
    profile: 'autonomous',
    mode: 'auto',
    automaticKnowledgeBaseWrites: true,
    inference: 'write-when-enabled',
    observe: 'auto',
    reflect: 'auto',
    curate: 'auto',
    adopt: 'auto',
    policies: {
      observe: 'auto',
      reflect: 'auto',
      hygiene: 'auto',
      synthesis: 'auto',
      split: 'auto',
      extract: 'auto',
      merge: 'auto',
      contradiction: 'auto',
      broken_link: 'auto',
      adopt: 'auto',
    },
    limits: { maxItems: 30, maxFilesChanged: 40, maxBytesWritten: 500000, maxHighRiskItems: 3 },
  };
}

function itemCounts(applied: number): NonNullable<MaintenanceStatus['latest']>['counts'] {
  return {
    proposed: 0,
    approved: 0,
    rejected: 0,
    blocked: 0,
    stale: 0,
    applying: 0,
    applied,
    verification_pending: 0,
    verification_failed: 0,
  };
}
