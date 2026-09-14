import fs from 'node:fs';
import assert from 'node:assert/strict';
import {validatePublic,validateCorrections} from './validate-public.mjs';
const base='tmp/akno-comparison/';
const read=file=>JSON.parse(fs.readFileSync(base+file));
const lines=file=>fs.readFileSync(base+file,'utf8').trim().split('\n').map(JSON.parse);
const row=lines('live/V77/cases.jsonl')[0];
const events=lines('live/V77/trace.jsonl').filter(t=>t.caseId===row.caseId&&t.run===row.run);
const entry=read('corpus.json').cases.find(c=>c.source.id===row.caseId);
const controls=[];
validatePublic(row,events,entry);controls.push('unchanged public receipts accepted');
for(const mode of ['missing-answer','swapped-language','fabricated-answer','missing-replay','public-throw','wrong-source']){
 const r=structuredClone(row),e=structuredClone(events),c=structuredClone(entry);
 if(mode==='missing-answer')e.splice(e.findIndex(t=>t.event==='public-result'&&t.operation==='answer'),1);
 if(mode==='swapped-language')r.result.queries[0].requestedAnswerLanguage='ru';
 if(mode==='fabricated-answer')r.result.queries[0].reviewAnswer='An invented unsupported alteration.';
 if(mode==='missing-replay')e.splice(e.findLastIndex(t=>t.event==='public-result'&&t.operation==='retain'),1);
 if(mode==='public-throw')e.push({event:'public-throw',operation:'read'});
 if(mode==='wrong-source')c.source.items[0].text='An invented different source.';
 assert.throws(()=>validatePublic(r,e,c));controls.push(mode+' rejected');
}
const initial=read('grade-legacy-1-initial.json'),final=read('grade-legacy-1-final.json'),ledger=read('grade-legacy-1-first-corrections.json');
validateCorrections(initial,final,[ledger]);controls.push('exact preserved corrections accepted');
for(const mode of ['missing-ledger','wrong-original','wrong-final','duplicate-coordinate']){
 const f=structuredClone(final),l=structuredClone(ledger);
 if(mode==='wrong-original')l.corrections[0].originalValue=true;
 if(mode==='wrong-final')l.corrections[0].correctedValue=false;
 if(mode==='duplicate-coordinate')l.corrections.push(l.corrections[0]);
 assert.throws(()=>validateCorrections(initial,f,mode==='missing-ledger'?[]:[l]));controls.push(mode+' rejected');
}
fs.writeFileSync(base+'validation-controls.json',JSON.stringify({createdAt:new Date().toISOString(),controls},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:controls.length,controls}));
