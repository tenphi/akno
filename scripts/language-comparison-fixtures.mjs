import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { managedMemoryBlock } from '../packages/core/dist/write/managed-memory.js';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Rehydrate public text/qualifications, never model extraction or repaired source content. */
export function comparisonFixtures(repo) {
  const ordinary = JSON.parse(fs.readFileSync(path.join(repo, 'benchmarks/language/pr73-live-cases.json')))
    .cases.filter((entry) => entry.path === 'ordinary')
    .map((entry) => ({
      ...entry,
      originalSource: entry.markdown,
      records: null,
      projections:
        entry.id === 'ordinary-empty-heading-fact'
          ? [
              { n: 4, view: 'discussion' },
              { n: 7, view: 'factual' },
            ]
          : [entry.focusLine, ...(entry.id === 'ordinary-mixed-hypothesis' ? [5] : [])].map((n) => ({
              n,
              view: entry.view,
            })),
    }));
  const archive = path.join(repo, 'benchmarks/language/results/pr73-luna-final');
  const reviews = JSON.parse(fs.readFileSync(path.join(archive, 'output-review.json'))).cases;
  const retained = [];
  for (const split of ['development', 'held-out']) {
    const sources = JSON.parse(fs.readFileSync(path.join(archive, split, 'sources.json')));
    const reportBytes = fs.readFileSync(path.join(archive, split, 'report.json'));
    for (const result of JSON.parse(reportBytes).cases) {
      const source = sources.find((entry) => entry.id === result.id);
      assert(source);
      const records = result.reviewKnowledge;
      const blocks = records.map(({ text, qualification: q }, index) => {
        // The public archive lacks original marker receipts/links. These fixture-only marker
        // identifiers are declared below; this is not a retain/replay/source-archive experiment.
        const marker = {
          id: q.id,
          supports: [
            {
              receipt: hash(source.id).slice(0, 24),
              candidate: hash(String(index)).slice(0, 24),
              proofGroup: hash(text).slice(0, 24),
              selection: 'provided',
            },
          ],
          kind: q.kind,
          subject: q.subject,
          sourceRole: q.source_role,
          ...(q.source_speaker ? { speaker: q.source_speaker } : {}),
          reporters: [],
          commitment: q.commitment,
          disposition: q.disposition,
          polarity: q.polarity,
          basis: q.basis,
          evidence: [],
          links: [],
          ...(q.temporal ? { time: q.temporal.time } : {}),
        };
        return managedMemoryBlock(marker, text);
      });
      retained.push({
        id: `${result.id}/run-${result.run}`,
        path: 'retained',
        sourceLanguage: source.language,
        admission: source.admission,
        view: source.view,
        queries: source.queries,
        expectation: source.reviewExpectation,
        originalSource: source.items,
        records,
        originalSupports: result.sourceArchive.supports,
        originalRetentionReview: (() => {
          const review = reviews.find((item) => item.id === result.id && item.run === result.run);
          assert(review);
          return {
            complete: review.retentionUseful,
            justifiedHold: review.retentionJustifiedHold,
            sourceEntailed: review.retainedSourceEntailed,
            qualificationPreserved: review.qualificationPreserved,
            reason: review.reason,
          };
        })(),
        archive: {
          path: `benchmarks/language/results/pr73-luna-final/${split}/report.json`,
          sha256: hash(reportBytes),
          caseId: result.id,
          run: result.run,
        },
        markdown: ['# Zephyr QX-100', '', ...blocks.flatMap((block) => [block, ''])].join('\n'),
      });
    }
  }
  assert.equal(retained.length, 44);
  return [...ordinary, ...retained];
}
