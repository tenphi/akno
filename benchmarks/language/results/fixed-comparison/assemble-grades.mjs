import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const mode=process.argv[2]??'comparison';assert(['comparison','integration'].includes(mode));
const base=path.resolve('tmp/akno-comparison',mode==='integration'?'integration':'.');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
for(const block of ['legacy','recent'])for(const run of [1,2]){
 const parts=['first','rest'].map(part=>({part,file:`grade-${block}-${run}-${part}-initial.json`}));
 if(!parts.every(p=>fs.existsSync(path.join(base,p.file))))continue;
 const target=path.join(base,`grade-${block}-${run}-initial.json`);
 const packet=read(`packet-v2-${block}-${run}.json`);
 const cases=parts.flatMap(p=>{const grade=read(p.file);assert.equal(grade.block,block);assert.equal(grade.run,run);const input=read(`packet-v2-${block}-${run}-${p.part}.json`);assert.deepEqual(grade.cases.map(c=>c.id).sort(),input.cases.map(c=>c.id).sort());return grade.cases;});
 assert.deepEqual(cases.map(c=>c.id).sort(),packet.cases.map(c=>c.id).sort());
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
 const output={block,run,assembly:'Exact concatenation of preserved anonymous initial grades; no semantic modification.',parts:parts.map(p=>({file:p.file,sha256:createHash('sha256').update(fs.readFileSync(path.join(base,p.file))).digest('hex')})),cases};
 if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 const finalParts=parts.map(p=>({...p,file:fs.existsSync(path.join(base,p.file.replace('-initial.json','-final.json')))?p.file.replace('-initial.json','-final.json'):p.file}));
 const finalCases=finalParts.flatMap(p=>read(p.file).cases);assert.deepEqual(finalCases.map(c=>c.id).sort(),cases.map(c=>c.id).sort());
 const final={block,run,assembly:'Exact concatenation of final grades where a preserved correction exists, otherwise initial grades.',parts:finalParts.map(p=>({file:p.file,sha256:createHash('sha256').update(fs.readFileSync(path.join(base,p.file))).digest('hex')})),cases:finalCases};
 const finalTarget=path.join(base,`grade-${block}-${run}-final.json`);if(!fs.existsSync(finalTarget))fs.writeFileSync(finalTarget,JSON.stringify(final,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({block,run,assembledCases:cases.length}));
}
