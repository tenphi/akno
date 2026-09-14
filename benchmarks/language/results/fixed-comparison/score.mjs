import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coordinates,validateCorrections} from './validate-public.mjs';
const base=path.resolve('tmp/akno-comparison');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex');
const mode=process.argv[3]??'comparison';assert(['comparison','integration'].includes(mode));
const prefix=mode==='integration'?'integration/':'';
const completed=read(prefix+'live/completed.json'),mapping=read(prefix+'blind-map.json');
const declaration=read(prefix+'declaration.json'),validation=read(mode+'-postvalidation.json'),corpus=read('corpus.json');
assert.equal(validation.completedSha256,hash(prefix+'live/completed.json'));
assert.equal(validation.declarationSha256,hash(prefix+'declaration.json'));
assert.equal(validation.postvalidatorSha256,hash('postvalidate.mjs'));
assert.equal(validation.publicValidatorSha256,hash('validate-public.mjs'));
assert.equal(validation.corpusFingerprint,corpus.corpusFingerprint);
assert.equal(declaration.corpusFileSha256,hash('corpus.json'));
assert.equal(declaration.sourceObligationsSha256,hash('source-first-obligations.json'));
assert.deepEqual(completed.modelPolicy,declaration.modelPolicy);
assert.deepEqual(Object.keys(mapping).sort(),validation.arms.map(a=>a.label).sort());
for(const arm of validation.arms){
 assert.equal(arm.casesSha256,hash(prefix+'live/'+arm.label+'/cases.jsonl'));
 assert.equal(arm.traceSha256,hash(prefix+'live/'+arm.label+'/trace.jsonl'));
 assert.deepEqual(arm.candidate,mode==='comparison'?declaration.candidates.find(c=>c.label===arm.label):declaration.candidate);
 assert.equal(arm.coordinates,352);
}
const gradeVersion=process.argv[2]??'initial';assert(['initial','final'].includes(gradeVersion));
const result={mode,gradeVersion,corpusFingerprint:completed.corpusFingerprint,postvalidationSha256:hash(mode+'-postvalidation.json'),scorerSha256:hash('score.mjs'),inputs:[],arms:[]};
const expectedCoordinates=['en','ru'].flatMap(queryLanguage=>[false,true].flatMap(explicitView=>['en','ru'].map(requestedAnswerLanguage=>({queryLanguage,explicitView,requestedAnswerLanguage}))));
for(const block of ['legacy','recent'])for(const run of [1,2]){
 const initial=read(prefix+`grade-${block}-${run}-initial.json`),final=gradeVersion==='final'?read(prefix+`grade-${block}-${run}-final.json`):initial;
 const ledgers=fs.readdirSync(path.join(base,prefix)).filter(f=>new RegExp(`^grade-${block}-${run}(?:-(?:first|rest))?-corrections\\.json$`).test(f));
 if(gradeVersion==='final')validateCorrections(initial,final,ledgers.map(f=>read(prefix+f)));
 for(const g of [initial,final]){
  assert(Array.isArray(g.parts)&&g.parts.length===2);
  for(const part of g.parts)assert.equal(part.sha256,hash(prefix+part.file));
  assert.deepEqual(g.cases,g.parts.flatMap(part=>read(prefix+part.file).cases));
 }
 const files=[`packet-v2-${block}-${run}.json`,`grade-${block}-${run}-initial.json`,...(gradeVersion==='final'?[`grade-${block}-${run}-final.json`,...ledgers]:[])];
 result.inputs.push(...files.map(f=>({file:prefix+f,sha256:hash(prefix+f)})));
}
for(const [label,candidate]of Object.entries(mapping)){
 const arm={label,candidate,rows:[],totals:{}};
 const trace=fs.readFileSync(path.join(base,prefix+'live/'+label+'/trace.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 for(const block of ['legacy','recent'])for(const run of [1,2]){
  const packet=read(prefix+`packet-v2-${block}-${run}.json`),grade=read(prefix+`grade-${block}-${run}-${gradeVersion}.json`);
  assert.equal(grade.block,block);assert.equal(grade.run,run);assert.equal(grade.cases.length,packet.cases.length);
  assert.equal(packet.corpusFingerprint,corpus.corpusFingerprint);
  assert.deepEqual(packet.cases.map(c=>c.id).sort(),corpus.cases.filter(c=>c.block===block).map(c=>c.source.id).sort());
  assert.deepEqual(grade.cases.map(c=>c.id).sort(),packet.cases.map(c=>c.id).sort());
  const tally={block,run,writableCases:0,completeRetention:0,writableAnswers:0,usefulAnswers:0,publishedAnswers:0,writableNulls:0,retrievals:0,usefulRetrievals:0,unsupportedRetention:0,retentionQualificationErrors:0,retentionLanguageErrors:0,unsupportedAnswers:0,answerQualificationErrors:0,answerLanguageErrors:0,unsafeRetainedSets:0,unsafeAnswers:0,readOnlyCases:0,justifiedReadOnlyCases:0,readOnlyAnswers:0,readOnlyNulls:0,caseAvailabilityFailures:0,answerAvailabilityFailures:0,ordinaryMismatches:0,bytesFailures:0,replayFailures:0};
  for(const c of packet.cases){
   const original=corpus.cases.find(x=>x.source.id===c.id).source;
   assert.deepEqual(c.source,original.items);assert.deepEqual(c.queries,original.queries);assert.equal(c.admission,original.admission);
   assert.deepEqual(c.observations.map(o=>o.candidate).sort(),Object.values(mapping).sort());
   const observation=c.observations.find(x=>x.candidate===candidate);
   const matching=grade.cases.filter(x=>x.id===c.id);assert.equal(matching.length,1);
   assert.deepEqual(matching[0].observations.map(o=>o.candidate).sort(),Object.values(mapping).sort());
   const gs=matching[0].observations.filter(x=>x.candidate===candidate);assert.equal(gs.length,1);const g=gs[0];
   assert.equal(g.answers.length,observation.answers.length);assert.equal(g.retrievals.length,observation.retrievals.length);
   assert.equal(new Set(g.answers.map(x=>x.id)).size,g.answers.length);assert.equal(new Set(g.retrievals.map(x=>x.id)).size,g.retrievals.length);
   const receipt=(mode==='comparison'?completed.results[label]:completed.results).find(x=>x.block===block&&x.run===run&&x.caseId===c.id);assert(receipt);
   const raw=receipt.result;assert.equal(raw.queries.length,8);
   assert.deepEqual(coordinates(observation.queries),coordinates(expectedCoordinates));
   assert.deepEqual(observation.retained,raw.reviewKnowledge);
   assert.deepEqual(observation.admission,{status:raw.retention.status,outcome:raw.retention.outcome,reason:raw.retention.reason,candidates:raw.retention.candidates??[],degraded:raw.retention.degraded??[]});
   const pages=trace.filter(t=>t.caseId===c.id&&t.run===run&&t.event==='public-result'&&t.operation==='read'&&t.input?.slug?.startsWith('memory/')).map(t=>({slug:t.input.slug,lines:t.result.page?.lines??[]}));
   assert.deepEqual(observation.storedPages,pages);
   tally.caseAvailabilityFailures+=Number(raw.availabilityFailure);tally.ordinaryMismatches+=Number(!raw.ordinaryCorrect);tally.bytesFailures+=Number(raw.bytesStable!==true);tally.replayFailures+=Number(raw.replayOutcome!=='replayed');
   for(const key of ['sourceEntailed','qualificationsPreserved','correctLanguage']){if(observation.retained.length)assert.equal(typeof g.retention[key],'boolean');else assert.equal(g.retention[key],null);}
   assert.equal(typeof g.retention.complete,'boolean');assert.equal(typeof g.retention.unsafePromotion,'boolean');
   if(!observation.retained.length){assert.equal(g.retention.complete,false);assert.equal(g.retention.unsafePromotion,false);}
   const writable=c.admission==='writable';
   if(writable)assert.equal(g.justifiedReadOnlyHold,null);
   else{
    assert.equal(typeof g.justifiedReadOnlyHold,'boolean');
    if(g.justifiedReadOnlyHold){
     assert.equal(observation.retained.length,0);assert(raw.queries.every(q=>q.reviewAnswer===null));
     assert.equal(raw.retention.status,'ok');assert.equal(raw.retention.outcome,'held');
     assert(raw.retention.candidates.length>0);
     assert(raw.retention.candidates.every(c=>c.outcome==='held'&&c.reason==='no_writable_destination'&&c.holdStage==='placement'&&c.routingReason==='read_only_match'));
    }
   }
   if(writable){tally.writableCases++;if(g.retention.complete){assert(observation.retained.length>0);assert.equal(g.retention.sourceEntailed,true);assert.equal(g.retention.qualificationsPreserved,true);assert.equal(g.retention.correctLanguage,true);assert.equal(g.retention.unsafePromotion,false);tally.completeRetention++;}}
   else{tally.readOnlyCases++;tally.justifiedReadOnlyCases+=Number(g.justifiedReadOnlyHold===true);}
   tally.unsupportedRetention+=Number(g.retention.sourceEntailed===false);tally.retentionQualificationErrors+=Number(g.retention.qualificationsPreserved===false);tally.retentionLanguageErrors+=Number(g.retention.correctLanguage===false);tally.unsafeRetainedSets+=Number(g.retention.unsafePromotion);
   const seenRetrieval=new Map();
   assert.deepEqual([...new Set(observation.queries.map(q=>q.answer))].sort(),observation.answers.map(a=>a.id).sort());
   assert.deepEqual([...new Set(observation.queries.map(q=>q.retrieval))].sort(),observation.retrievals.map(a=>a.id).sort());
   for(const q of observation.queries){
    const a=g.answers.find(x=>x.id===q.answer);assert(a);const value=observation.answers.find(x=>x.id===q.answer).value;
    assert.equal(typeof a.useful,'boolean');assert.equal(typeof a.unsafePromotion,'boolean');
    for(const key of ['sourceEntailed','qualificationsPreserved','correctLanguage']){if(value.text===null)assert.equal(a[key],null);else assert.equal(typeof a[key],'boolean');}
    if(value.text===null){assert.equal(a.useful,false);assert.equal(a.unsafePromotion,false);}
    if(a.useful){assert.notEqual(value.text,null);for(const key of ['sourceEntailed','qualificationsPreserved','correctLanguage'])assert.equal(a[key],true);assert.equal(a.unsafePromotion,false);}
    if(writable){tally.writableAnswers++;tally.usefulAnswers+=Number(a.useful);tally.publishedAnswers+=Number(value.text!==null);tally.writableNulls+=Number(value.text===null);}
    else{tally.readOnlyAnswers++;tally.readOnlyNulls+=Number(value.text===null);}
    tally.unsupportedAnswers+=Number(a.sourceEntailed===false);tally.answerQualificationErrors+=Number(a.qualificationsPreserved===false);tally.answerLanguageErrors+=Number(a.correctLanguage===false);tally.unsafeAnswers+=Number(a.unsafePromotion);
    const rq=raw.queries.find(x=>x.queryLanguage===q.queryLanguage&&x.explicitView===q.explicitView&&x.requestedAnswerLanguage===q.requestedAnswerLanguage);assert(rq);
    assert.deepEqual(value,{text:rq.reviewAnswer,requestedAnswerLanguage:q.requestedAnswerLanguage,query:original.queries[q.queryLanguage]});
    assert.deepEqual(observation.retrievals.find(r=>r.id===q.retrieval).value,{items:rq.reviewRetrieval,query:original.queries[q.queryLanguage]});
    tally.answerAvailabilityFailures+=Number(['generation_unavailable','generation_failed','invalid_draft','verification_unavailable','evidence_unavailable'].includes(rq.answerReason));
    const retrievalKey=q.queryLanguage+':'+q.explicitView;
    if(seenRetrieval.has(retrievalKey))assert.equal(q.retrieval,seenRetrieval.get(retrievalKey));
    else{seenRetrieval.set(retrievalKey,q.retrieval);const r=g.retrievals.find(x=>x.id===q.retrieval);assert(r);assert.equal(typeof r.useful,'boolean');if(writable){tally.retrievals++;tally.usefulRetrievals+=Number(r.useful);}}
   }
  }
  assert.equal(tally.writableAnswers,80);assert.equal(tally.retrievals,40);assert.equal(tally.readOnlyAnswers,8);
  tally.answerRate=tally.usefulAnswers/tally.writableAnswers;tally.retentionRate=tally.completeRetention/tally.writableCases;tally.retrievalRate=tally.usefulRetrievals/tally.retrievals;
  arm.rows.push(tally);
 }
 const countKeys=Object.keys(arm.rows[0]).filter(k=>!['block','run','answerRate','retentionRate','retrievalRate'].includes(k));for(const k of countKeys)arm.totals[k]=arm.rows.reduce((n,r)=>n+r[k],0);
 arm.worstAnswerRate=Math.min(...arm.rows.map(r=>r.answerRate));arm.worstRetentionRate=Math.min(...arm.rows.map(r=>r.retentionRate));arm.worstRetrievalRate=Math.min(...arm.rows.map(r=>r.retrievalRate));
 arm.acceptedErrorFree=['unsupportedRetention','retentionQualificationErrors','retentionLanguageErrors','unsupportedAnswers','answerQualificationErrors','answerLanguageErrors','unsafeRetainedSets','unsafeAnswers','bytesFailures'].every(k=>arm.totals[k]===0)&&arm.totals.readOnlyNulls===arm.totals.readOnlyAnswers&&arm.totals.justifiedReadOnlyCases===arm.totals.readOnlyCases;
 arm.coverageTargetMet=arm.worstAnswerRate>=.8&&arm.worstRetentionRate>=.8&&arm.worstRetrievalRate>=.8;
 arm.higherAnswerTargetMet=arm.worstAnswerRate>=.9;
 arm.rolloutEligible=arm.acceptedErrorFree&&arm.coverageTargetMet&&arm.rows.every(r=>r.caseAvailabilityFailures/(r.writableCases+r.readOnlyCases)<=.05)&&arm.totals.ordinaryMismatches===0&&arm.totals.replayFailures===0;
 result.arms.push(arm);
}
fs.writeFileSync(path.join(base,`${mode}-${gradeVersion}.json`),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result.arms.map(({label,totals,worstAnswerRate,worstRetentionRate,acceptedErrorFree,rolloutEligible})=>({label,totals,worstAnswerRate,worstRetentionRate,acceptedErrorFree,rolloutEligible})),null,2));
