import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, type Akno } from '../index.ts';
import { openStore, type Store } from '../store/db.ts';
import { discoverOverview, overviewFingerprint, overviewRewriteCheck } from './overview.ts';
import { temporalClock } from './temporal.ts';
import { qualifiedSynthesisIssue } from './qualified-synthesis.ts';

let root: string;
let mem: Akno;
let store: Store;
const declaration =
  'type: overview\nakno:\n  overview:\n    folder: journeys/2034\n    type: trip\n  management:\n    dream: synthesize';
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-overview-'));
  fs.mkdirSync(path.join(root, 'kb/journeys'), { recursive: true });
  fs.writeFileSync(path.join(root, 'kb/journeys/index.md'), `---\n${declaration}\n---\n# Journeys\n`);
  mem = await open({ aknoPath: path.join(root, 'kb'), stateDir: path.join(root, 'state'), isolated: true });
  await mem.index({ structuralOnly: true });
  store = openStore({ dbPath: mem.config.dbPath, embeddingDimensions: 2 });
});
afterEach(async () => {
  store?.close();
  await mem?.close();
  fs.rmSync(root, { recursive: true, force: true });
});
async function member(slug = 'journeys/2034/blackwater-bay', extra = '', body = '# Blackwater Bay\n') {
  const file = path.join(mem.config.aknoPath, `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `---\ntype: trip\n${extra}akno:\n  temporal:\n    kind: event\n    start: '2034-04-03'\n    until: '2034-04-05'\n    timezone: UTC\n---\n${body}`,
  );
  await mem.index({ structuralOnly: true, verify: true });
}
function discover(now = '2034-03-01T12:00:00Z') {
  return discoverOverview(
    { config: mem.config, store },
    'journeys/index',
    temporalClock(new Date(now), 'UTC'),
  )!;
}

describe('declared overview dependencies', () => {
  it('admits only the named type within a literal folder boundary', async () => {
    await member();
    await member('journeys/20340/elsewhere');
    await member('journeys/2034/packing');
    const file = path.join(mem.config.aknoPath, 'journeys/2034/packing.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('type: trip', 'type: checklist'));
    await mem.index({ structuralOnly: true, verify: true });
    expect(discover().members.map((entry) => entry.slug)).toEqual(['journeys/2034/blackwater-bay']);
  });

  it('changes only at a member boundary, with timezone-aware inclusive end dates', async () => {
    await member();
    const first = discover();
    expect(overviewFingerprint(discover('2034-03-20T10:00:00Z'))).toBe(overviewFingerprint(first));
    expect(discover('2034-04-03T00:00:00Z').members[0]!.phase).toBe('current');
    expect(discover('2034-04-05T23:59:59Z').members[0]!.phase).toBe('current');
    expect(discover('2034-04-06T00:00:00Z').members[0]!.phase).toBe('past');
    expect(overviewFingerprint(discover('2034-05-01T12:00:00Z'))).toBe(
      overviewFingerprint(discover('2034-06-01T12:00:00Z')),
    );
    const file = path.join(mem.config.aknoPath, 'journeys/2034/blackwater-bay.md');
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('timezone: UTC', 'timezone: Pacific/Honolulu'),
    );
    await mem.index({ structuralOnly: true, verify: true });
    expect(discover('2034-04-06T09:59:59Z').members[0]!.phase).toBe('current');
    expect(discover('2034-04-06T10:00:00Z').members[0]!.phase).toBe('past');
  });

  it('tracks new, renamed, removed, and cancelled members', async () => {
    await member();
    const first = overviewFingerprint(discover());
    await member('journeys/2034/silvermarsh');
    expect(overviewFingerprint(discover())).not.toBe(first);
    fs.renameSync(
      path.join(mem.config.aknoPath, 'journeys/2034/silvermarsh.md'),
      path.join(mem.config.aknoPath, 'journeys/2034/new-name.md'),
    );
    await mem.index({ structuralOnly: true, verify: true });
    expect(discover().members.map((entry) => entry.slug)).toContain('journeys/2034/new-name');
    await member('journeys/2034/new-name', 'status: cancelled\n', '# Cancelled\n\n> An attributed report.\n');
    expect(discover().members[1]).toMatchObject({ authoredStatus: 'cancelled', qualified: true });
    fs.unlinkSync(path.join(mem.config.aknoPath, 'journeys/2034/new-name.md'));
    await mem.index({ structuralOnly: true, verify: true });
    expect(overviewFingerprint(discover())).toBe(first);
  });

  it('distinguishes unavailable sources and a bounded catalog from absence', async () => {
    for (let i = 0; i < 31; i++) await member(`journeys/2034/member-${String(i).padStart(2, '0')}`);
    expect(discover()).toMatchObject({ status: 'partial', memberLimitReached: true });
    expect(discover().members).toHaveLength(30);
    fs.appendFileSync(
      path.join(mem.config.aknoPath, 'journeys/2034/member-00.md'),
      '\nAn unindexed correction.\n',
    );
    fs.unlinkSync(path.join(mem.config.aknoPath, 'journeys/2034/member-01.md'));
    expect(discover().members.slice(0, 2)).toMatchObject([
      { status: 'unavailable', reason: 'stale_index' },
      { status: 'unavailable', reason: 'unreadable' },
    ]);
  });

  it.each([
    '',
    '  overview: { folder: ../journeys, type: trip }\n',
    '  overview: { folder: journeys, type: trip, year: 2034 }\n',
  ])('exposes missing or ambiguous scope: %s', async (scope) => {
    fs.writeFileSync(
      path.join(mem.config.aknoPath, 'journeys/index.md'),
      `---\ntype: overview\nakno:\n${scope}  management:\n    dream: synthesize\n---\n# Index\n`,
    );
    await mem.index({ structuralOnly: true, verify: true });
    expect(discover()).toMatchObject({
      status: scope ? 'invalid_scope' : 'missing_scope',
      scope: null,
      members: [],
    });
  });

  it('holds an unindexed scope edit and does not silently truncate authored metadata', async () => {
    await member('journeys/2034/blackwater-bay', `status: ${'long '.repeat(100)}\n`);
    expect(discover().members[0]).toMatchObject({ status: 'unavailable', reason: 'metadata_limit' });
    const file = path.join(mem.config.aknoPath, 'journeys/index.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('type: trip', 'type: checklist'));
    expect(discover()).toMatchObject({ status: 'unavailable_scope', scope: null, members: [] });
  });

  it('rebuilds the same dependency fingerprint from Markdown in a fresh index', async () => {
    await member();
    const expected = overviewFingerprint(discover());
    store.close();
    await mem.close();
    mem = await open({
      aknoPath: path.join(root, 'kb'),
      stateDir: path.join(root, 'rebuilt-state'),
      isolated: true,
    });
    await mem.index({ structuralOnly: true });
    store = openStore({ dbPath: mem.config.dbPath, embeddingDimensions: 2 });
    expect(overviewFingerprint(discover())).toBe(expected);
  });

  it('counts a supported heading change as material while preserving a separate quote', async () => {
    await member();
    const before =
      '# Index\n\n> An attributed report.\n\n## Upcoming\n\n- [[journeys/2034/blackwater-bay]] — 2034-04-03 through 2034-04-05.\n';
    const after = before.replace('## Upcoming', '## Past schedules');
    const check = overviewRewriteCheck(before, after, discover('2034-05-01T12:00:00Z'));
    expect(check).toEqual({ material: true, headingChanges: true, issue: null });
    expect(qualifiedSynthesisIssue(before, after, check.headingChanges)).toBeNull();
    expect(overviewRewriteCheck(before, after, discover()).issue).toBeTruthy();
    expect(
      overviewRewriteCheck(before, before.replace('Upcoming', 'Completed'), discover('2034-05-01T12:00:00Z'))
        .issue,
    ).toBeTruthy();
    expect(
      qualifiedSynthesisIssue(before, after.replace('attributed report', 'established fact'), true),
    ).toBeTruthy();
  });

  it('inherits temporal headings through trip subsections and preserves mixed phases', async () => {
    await member();
    await member('journeys/2034/silvermarsh');
    const file = path.join(mem.config.aknoPath, 'journeys/2034/silvermarsh.md');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replaceAll('2034-04-03', '2034-06-03')
        .replaceAll('2034-04-05', '2034-06-05'),
    );
    await mem.index({ structuralOnly: true, verify: true });
    const before =
      '# Index\n\n## Upcoming\n\n### Blackwater Bay\n\n- [[journeys/2034/blackwater-bay]]\n\n## Future\n\n- [[journeys/2034/silvermarsh]]\n';
    const after = before.replace('## Upcoming', '## Past schedules');
    expect(overviewRewriteCheck(before, after, discover('2034-05-01T12:00:00Z'))).toEqual({
      material: true,
      headingChanges: true,
      issue: null,
    });
    expect(
      overviewRewriteCheck(
        before,
        after.replace('## Future', '## Past schedules'),
        discover('2034-05-01T12:00:00Z'),
      ).issue,
    ).toBeTruthy();
  });

  it('preserves mixed phases and rejects promoting cancelled schedules', async () => {
    await member();
    await member('journeys/2034/silvermarsh', 'status: cancelled\n');
    const before = '# Index\n\n## Reference\n\n- [[journeys/2034/silvermarsh]]\n';
    expect(
      overviewRewriteCheck(before, before.replace('Reference', 'Upcoming'), discover()).issue,
    ).toBeTruthy();
    const proposed =
      '# Index\n\n## Upcoming\n\n- [[journeys/2034/blackwater-bay]]\n\n## Reference\n\n- [[journeys/2034/silvermarsh]]\n';
    expect(overviewRewriteCheck(before, proposed, discover()).issue).toBeNull();
  });
});
