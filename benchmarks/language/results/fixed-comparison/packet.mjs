import fs from 'node:fs';
import path from 'node:path';
import {randomInt,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=path.resolve('tmp/akno-comparison');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const mode=process.argv[5]??'comparison';assert(['comparison','integration'].includes(mode));
const prefix=mode==='integration'?'integration/':'';
if(!fs.existsSync(path.join(base,prefix+'blind-map.json'))){const labels=mode==='integration'?[read('integration/candidate.json').label]:read('candidates.json').map(c=>c.label);for(let i=labels.length-1;i>0;i--){const j=randomInt(i+1);[labels[i],labels[j]]=[labels[j],labels[i]];}write(prefix+'blind-map.json',Object.fromEntries(labels.map((l,i)=>[l,'Candidate '+String.fromCharCode((mode==='integration'?68:65)+i)])));}
const mapping=read(prefix+'blind-map.json'),corpus=read('corpus.json');
const block=process.argv[2],run=Number(process.argv[3]);assert(['legacy','recent'].includes(block));assert([1,2].includes(run));
const part=process.argv[4]??'all';assert(['all','first','rest'].includes(part));
const entries=corpus.cases.filter(x=>x.block===block);
const selected=part==='first'?entries.slice(0,5):part==='rest'?entries.slice(5):entries;
const cases=[];
for(const entry of selected){
 const observations=[];
 for(const [label,anonymous]of Object.entries(mapping)){
  const rows=fs.readFileSync(path.join(base,prefix+'live',label,'cases.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const matches=rows.filter(x=>x.caseId===entry.source.id&&x.run===run);assert.equal(matches.length,1);
  const result=matches[0].result;assert.equal(result.queries.length,8);
  const traces=fs.readFileSync(path.join(base,prefix+'live',label,'trace.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const storedPages=traces.filter(x=>x.caseId===entry.source.id&&x.run===run&&x.event==='public-result'&&x.operation==='read'&&x.input?.slug?.startsWith('memory/')).map(x=>({slug:x.input.slug,lines:x.result.page?.lines??[]}));
  const answers=[],retrievals=[];
  const intern=(items,value)=>{let index=items.findIndex(x=>JSON.stringify(x.value)===JSON.stringify(value));if(index<0){index=items.length;items.push({id:String(index+1),value});}return String(index+1);};
  const queries=result.queries.map(q=>({queryLanguage:q.queryLanguage,explicitView:q.explicitView,requestedAnswerLanguage:q.requestedAnswerLanguage,answer:intern(answers,{text:q.reviewAnswer,requestedAnswerLanguage:q.requestedAnswerLanguage,query:entry.source.queries[q.queryLanguage]}),retrieval:intern(retrievals,{items:q.reviewRetrieval,query:entry.source.queries[q.queryLanguage]})}));
  observations.push({candidate:anonymous,retained:result.reviewKnowledge,storedPages,admission:{status:result.retention?.status,outcome:result.retention?.outcome,reason:result.retention?.reason,candidates:result.retention?.candidates??[],degraded:result.retention?.degraded??[]},answers,retrievals,queries});
 }
 observations.sort((a,b)=>a.candidate.localeCompare(b.candidate));
 cases.push({id:entry.source.id,source:entry.source.items,queries:entry.source.queries,admission:entry.source.admission,view:entry.source.view,observations});
}
write(prefix+`packet-v2-${block}-${run}${part==='all'?'':'-'+part}.json`,{packetVersion:2,corpusFingerprint:corpus.corpusFingerprint,block,run,part,instructions:'Grade only supplied source and public outputs under source-first-obligations.json. Answer IDs/retrieval IDs are scoped to each case/candidate. Repeated coordinates reference exactly equal values. Null writable output loses usefulness but has no accepted content error. Report retention completeness separately from source entailment and language. Stored pages include original public read lines and managed markers, so typed relations are not hidden by prose-only selection. Read relation targets against the qualified retained IDs. No candidate runtime or private judgments are supplied.',cases});
console.log(JSON.stringify({block,run,cases:cases.length,candidates:Object.keys(mapping).length,coordinates:cases.length*8*Object.keys(mapping).length}));
