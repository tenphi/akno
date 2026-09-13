import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='tmp/akno-comparison/';
const read=f=>JSON.parse(fs.readFileSync(base+f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(base+f)).digest('hex');
const output={note:'Descriptive slices of the completed fixed comparison; these are not new selection or acceptance gates. Counts are answer coordinates, not independent source scenarios.',scoreHashes:{comparison:sha('comparison-final.json'),integration:sha('integration-final.json')},arms:[]};
for(const mode of ['comparison','integration']){
 const prefix=mode==='integration'?'integration/':'';
 for(const [label,candidate]of Object.entries(read(prefix+'blind-map.json'))){
  const groups={};
  for(const dimension of ['queryLanguage','requestedAnswerLanguage','explicitView']){
   groups[dimension]={};
   for(const block of ['legacy','recent'])for(const run of [1,2]){
    const packet=read(prefix+`packet-v2-${block}-${run}.json`),grades=read(prefix+`grade-${block}-${run}-final.json`);
    for(const c of packet.cases.filter(c=>c.admission==='writable')){
     const observation=c.observations.find(o=>o.candidate===candidate),g=grades.cases.find(g=>g.id===c.id).observations.find(o=>o.candidate===candidate);
     for(const q of observation.queries){const a=g.answers.find(a=>a.id===q.answer);assert(a);const key=String(q[dimension]),row=groups[dimension][key]??={coordinates:0,useful:0,acceptedErrors:0};row.coordinates++;row.useful+=Number(a.useful);row.acceptedErrors+=Number([a.sourceEntailed,a.qualificationsPreserved,a.correctLanguage].includes(false)||a.unsafePromotion);}
    }
   }
   assert.equal(Object.values(groups[dimension]).reduce((n,r)=>n+r.coordinates,0),320);
   assert(Object.values(groups[dimension]).every(r=>r.coordinates===160));
  }
  output.arms.push({label,groups});
 }
}
fs.writeFileSync(base+'language-breakdown.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(output,null,2));
