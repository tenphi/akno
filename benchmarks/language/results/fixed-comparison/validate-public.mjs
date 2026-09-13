import assert from 'node:assert/strict';

const json = value => JSON.parse(JSON.stringify(value));
export const coordinates = rows => rows.map(q => JSON.stringify([q.queryLanguage, q.explicitView, q.requestedAnswerLanguage])).sort();

// Reconcile summaries with the public operation receipts emitted by the frozen common procedure.
export function validatePublic(receipt, events, entry) {
  assert.equal(receipt.result.error, null);
  assert.equal(events.filter(e => ['public-throw', 'open-throw'].includes(e.event)).length, 0);
  const calls = events.filter(e => e.event === 'public-result');
  let position = 0;
  const take = operation => {
    const event = calls[position++];
    assert(event, `Missing public ${operation}`);
    assert.equal(event.operation, operation);
    return event;
  };
  assert.deepEqual(take('index').input, {});
  const retained = take('retain');
  assert.deepEqual(retained.input, {sources:[{
    source_id:`invented:${entry.source.id}`,revision:'rev-1111',input:{items:entry.source.items},
    retention:{mode:'extract',mission:'Retain durable knowledge about Zephyr QX-100 in the existing memory folder, preserving all original qualifications.'},
  }]});
  assert.deepEqual(take('index').input, { rebuild: true });
  const replay = take('retain');
  assert.deepEqual(replay.input, retained.input);
  assert.equal(receipt.result.replayOutcome, replay.result.sources[0]?.outcome);
  const slugs = [...new Set(retained.result.sources.flatMap(s => s.candidates.flatMap(c => c.slug ? [c.slug] : [])))];
  const pages = slugs.map(slug => {
    const event = take('read');
    assert.deepEqual(event.input, { slug });
    return { slug, lines: event.result.page?.lines ?? [] };
  });
  const knowledge = pages.flatMap(p => p.lines.flatMap(line => line.memory?.status === 'qualified' ? [{ text: line.text, qualification: line.memory }] : []));
  assert.deepEqual(receipt.result.reviewKnowledge, knowledge);
  assert.equal(receipt.result.retainedItems, knowledge.length);
  const source = retained.result.sources[0];
  assert.deepEqual(receipt.result.retention, json({
    status: retained.result.status, outcome: source?.outcome, reason: source?.reason_code ?? null,
    candidates: source?.candidates.map(c => ({ outcome: c.outcome, reason: c.reason_code ?? null, holdStage: c.hold_stage ?? null, routingReason: c.routing_reason ?? null })),
    usage: source?.model_usage ?? null, degraded: retained.result.degraded ?? [],
  }));
  for (const queryLanguage of ['en', 'ru']) for (const explicitView of [false, true]) {
    const query = entry.source.queries[queryLanguage];
    const view = explicitView ? { memory_view: entry.source.view } : {};
    const recall = take('recall'), context = take('context');
    assert.deepEqual(recall.input, { query, filter: { folder: 'memory' }, expand: true, rerank: false, graph: false, ...view });
    assert.deepEqual(context.input, { profile: 'auto_recall', query, filter: { folder: 'memory' }, ...view });
    const retrieval = recall.result.results.flatMap(r => r.type === 'page' ? r.lines.flatMap(l => l.memory?.status === 'qualified' ? [{ text: l.text, qualification: l.memory }] : []) : []);
    for (const requestedAnswerLanguage of ['en', 'ru']) {
      const answer = take('answer');
      assert.deepEqual(answer.input, { question: query, answer_language: requestedAnswerLanguage, filter: { folder: 'memory' }, expand: true, graph: false, include_context: true, ...view });
      const expected = json({
        queryLanguage, explicitView, requestedAnswerLanguage, inferredView: recall.result.memory_view,
        recallStatus: recall.result.status, recallDegraded: recall.result.degraded ?? [],
        retainedEvidence: retrieval.length, reviewRetrieval: retrieval,
        contextStatus: context.result.status, contextDegraded: context.result.degraded ?? [],
        contextActivated: context.result.activation?.activated ?? false, contextActivation: context.result.activation ?? null,
        answerOutcome: answer.result.outcome, answerReason: answer.result.reason_code ?? null,
        answerValidation: answer.result.validation ?? null, answerDegraded: answer.result.degraded ?? [],
        answerModelUsage: answer.result.model_usage, reviewAnswer: answer.result.answer,
      });
      const observed = receipt.result.queries.filter(q => q.queryLanguage === queryLanguage && q.explicitView === explicitView && q.requestedAnswerLanguage === requestedAnswerLanguage);
      assert.equal(observed.length, 1);
      assert.deepEqual(observed[0], expected);
    }
  }
  const ordinary = take('read');
  assert.deepEqual(ordinary.input, { slug: 'authored/passage' });
  const qualifications = (ordinary.result.page?.lines ?? []).flatMap(line => line.prose && !['heading', 'comment'].includes(line.prose.reason) && !/^\s*(?:`{3,}|~{3,})/.test(line.text) ? [line.prose] : []);
  assert.equal(receipt.result.ordinaryCorrect, qualifications.length > 0 && qualifications.every(q => q.answer_eligible === entry.source.ordinaryFactual));
  const inspection = take('recall');
  assert.deepEqual(inspection.input, { query: 'Zephyr QX-100', filter: { folder: 'authored' }, memory_view: 'all', expand: false, rerank: false, graph: false });
  assert.deepEqual(receipt.result.ordinaryInspection, { status: inspection.result.status, results: inspection.result.results.length });
  assert.equal(position, calls.length);
  const reasons=[...(retained.result.degraded??[]),...receipt.result.queries.flatMap(q=>[...q.recallDegraded,...q.contextDegraded,...q.answerDegraded])];
  assert.equal(receipt.result.retentionAvailabilityFailure,retained.result.status==='unavailable'||(retained.result.degraded??[]).some(r=>['no_derive_model','derive_failed','retain_verification_failed','language_check_failed'].includes(r)));
  assert.equal(receipt.result.availabilityFailure,retained.result.status==='unavailable'||reasons.some(r=>['no_derive_model','derive_failed','retain_verification_failed','language_check_failed','no_answer_model','answer_failed','answer_verification_failed','expansion_failed','embedding_failed','no_embedding_model'].includes(r)));
  assert.equal(receipt.result.languageRejected,reasons.includes('language_mismatch'));
  assert.equal(receipt.result.noncanonicalEligibilityFlag,entry.source.view!=='factual'&&knowledge.some(k=>k.qualification.answer_eligible));
  assert.equal(receipt.result.semanticsMatch,knowledge.length>0&&knowledge.some(k=>['commitment','disposition','basis','polarity'].every(key=>!entry.source[key]||k.qualification[key]===entry.source[key])));
  return pages;
}

export function validateCorrections(initial, final, ledgers) {
  const revised = structuredClone(initial.cases);
  const seen = new Set();
  for (const ledger of ledgers) {
    assert.equal(ledger.block, initial.block);
    assert.equal(ledger.run, initial.run);
    for (const correction of ledger.corrections) {
      assert.equal(typeof correction.reason, 'string');
      assert(correction.reason.trim());
      const key = JSON.stringify([correction.case, correction.candidate, correction.field]);
      assert(!seen.has(key)); seen.add(key);
      const matches = revised.filter(c => c.id === correction.case).flatMap(c => c.observations.filter(o => o.candidate === correction.candidate));
      assert.equal(matches.length, 1);
      const field = /^(retention|answers\[id=([^\]]+)\]|retrievals\[id=([^\]]+)\])\.([A-Za-z]+)$/.exec(correction.field);
      assert(field, 'Unsupported correction coordinate');
      const target = field[1] === 'retention' ? matches[0].retention : matches[0][field[2] ? 'answers' : 'retrievals'].find(x => x.id === (field[2] ?? field[3]));
      assert(target);
      assert.deepEqual(target[field[4]], correction.originalValue);
      target[field[4]] = correction.correctedValue;
    }
  }
  assert.deepEqual(final.cases, revised, 'Every final grade change must match a preserved correction');
}
