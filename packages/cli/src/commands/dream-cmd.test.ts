import type { DreamReport, MaintenanceStatus } from '@tenphi/akno-core';
import { describe, expect, it } from 'vitest';
import { curationGuardSummary, dreamProgressDescription, safeDreamReport } from './dream-cmd.ts';

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
  });

  it('collapses raw source contexts into one guardrail category per page', () => {
    expect(curationGuardSummary(privateReport())).toContainEqual({
      category: 'value preservation',
      pages: 1,
      issues: 2,
    });
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
  return {
    run: {
      id: 'run_example',
      startedAt: '2030-01-02T03:04:00.000Z',
      finishedAt: '2030-01-02T03:04:01.000Z',
      status: 'completed',
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
        plannerVersion: 'dream-lifecycle-v1',
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
      durationMs: 111,
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
    housekeeping: null,
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
          risk: 'high',
          subject: 'people/ada-marlow',
          status: 'applied',
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
    warnings: ['people/ada-marlow: private warning'],
    durationMs: 111,
    logPath: '/private/state/dream.jsonl',
  };
}

function emptyStatus(): MaintenanceStatus {
  return {
    latest: null,
    latestRun: null,
    active: 0,
    activeRuns: 0,
    awaitingHuman: 0,
    verificationPending: 0,
  };
}

function statusAt(
  startedAt: number,
  status: NonNullable<MaintenanceStatus['latest']>['status'],
  applied: number,
): MaintenanceStatus {
  return {
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
    active: status === 'completed' ? 0 : 1,
    activeRuns: 0,
    awaitingHuman: 0,
    verificationPending: 0,
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
