import fs from 'node:fs';
import path from 'node:path';
import {fork,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {candidateProof} from './freeze.mjs';
import {loadConfig} from '../../packages/core/src/config/load.ts';

const home=path.resolve('tmp/akno-comparison');
const read=file=>JSON.parse(fs.readFileSync(path.join(home,file),'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(process.version,'v22.22.0');
const mode=process.argv[2];assert(['control','live'].includes(mode));
const corpus=read('corpus.json'),candidates=read('candidates.json');
const config=loadConfig();
assert.equal(config.models.answer.maxOutputTokens,1024);assert.equal(config.models.derive.maxOutputTokens,2400);
for(const role of ['derive','answer'])assert.equal(config.models[role].id,'gpt-5.6-luna');
const policy=Object.fromEntries(['derive','answer','embedding','expansion'].map(role=>{
 const m=config.models[role];return [role,{id:m.id,enabled:m.enabled,maxOutputTokens:m.maxOutputTokens??null,timeoutMs:m.timeoutMs,reasoningEffort:m.reasoningEffort??null}];
}));
if(mode==='control')for(const role of ['derive','answer','embedding','expansion'])config.models[role]={...config.models[role],enabled:false};
if(mode==='live'){
 const declaration=read('declaration.json'),approval=read('preflight.json');
 assert.equal(declaration.corpusFingerprint,corpus.corpusFingerprint);
 assert.equal(declaration.corpusFileSha256,hash(path.join(home,'corpus.json')));
 assert.equal(declaration.sourceObligationsSha256,hash(path.join(home,'source-first-obligations.json')));assert.deepEqual(declaration.modelPolicy,policy);
 assert.deepEqual(declaration.candidates,candidates.map(candidateProof));
 assert.equal(approval.freezeSha256,hash(path.join(home,'freeze.mjs')));
 assert.equal(approval.approved,true);assert.equal(approval.declarationSha256,hash(path.join(home,'declaration.json')));
 assert.equal(approval.workerSha256,hash(path.join(home,'worker.mjs')));assert.equal(approval.runnerSha256,hash(path.join(home,'run.mjs')));assert.equal(approval.commonSha256,hash(path.join(home,'common-case.mjs')));
 assert(!fs.existsSync(path.join(home,'live-started.json')));
 fs.writeFileSync(path.join(home,'live-started.json'),JSON.stringify({startedAt:new Date().toISOString(),corpusFingerprint:corpus.corpusFingerprint,modelPolicy:policy,approvalSha256:hash(path.join(home,'preflight.json'))},null,2)+'\n',{flag:'wx'});
}
const modeRoot=path.join(home,mode);assert(!fs.existsSync(modeRoot));fs.mkdirSync(modeRoot);
const workers=[];
function request(worker,message){return new Promise((resolve,reject)=>{
 const onMessage=response=>{worker.removeListener('exit',onExit);if(response.type==='worker-failure')reject(new Error(JSON.stringify(response)));else resolve(response);};
 const onExit=(code,signal)=>{worker.removeListener('message',onMessage);reject(new Error(`Worker exited ${code}/${signal}`));};
 worker.once('message',onMessage);worker.once('exit',onExit);worker.send(message);
});}
try{
 for(const candidate of candidates){
  const candidateRoot=path.resolve(candidate.root);
  const current=execFileSync('git',['-C',candidateRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(candidate.label!=='V77')assert.equal(current,candidate.commit);
  else assert.equal(execFileSync('git',['diff',candidate.commit,'--','packages'],{encoding:'utf8'}),'');
  const destination=path.join(modeRoot,candidate.label);
  const log=fs.openSync(path.join(modeRoot,candidate.label+'-worker.log'),'wx');
  const worker=fork(path.join(home,'worker.mjs'),[],{cwd:process.cwd(),stdio:['ignore',log,log,'ipc']});
  workers.push({candidate,worker});
  const ready=await request(worker,{type:'initialize',root:candidate.root,destination,config,control:mode==='control'});assert.equal(ready.type,'ready');
 }
 const entries=mode==='control'?[corpus.cases.find(c=>c.source.admission==='writable')]:corpus.cases;
 const repetitions=mode==='control'?1:2;
 const results=Object.fromEntries(candidates.map(c=>[c.label,[]]));
 for(let run=1;run<=repetitions;run++)for(let index=0;index<entries.length;index++){
  const entry=entries[index];
  const order=[0,1,2].map(i=>workers[(i+index+run-1)%workers.length]);
  const responses=[];
  for(const {candidate,worker} of order){
   const response=await request(worker,{type:'case',...entry,run});assert.equal(response.type,'case-result');
   results[candidate.label].push(response.receipt);
   console.log(JSON.stringify({candidate:candidate.label,mode,caseId:entry.source.id,block:entry.block,run,completed:results[candidate.label].length,total:entries.length*repetitions,elapsedMs:response.receipt.elapsedMs,queries:response.receipt.result.queries.length}));
   responses.push({label:candidate.label,receipt:response.receipt});
  }
  if(mode==='control')for(const {receipt}of responses){assert.equal(receipt.networkAttempts,0);assert.equal(receipt.result.queries.length,8);assert.equal(receipt.result.bytesStable,true);assert.equal(receipt.result.availabilityFailure,true);}
 }
 for(const {worker}of workers)await request(worker,{type:'close'});
 fs.writeFileSync(path.join(modeRoot,'completed.json'),JSON.stringify({completedAt:new Date().toISOString(),corpusFingerprint:corpus.corpusFingerprint,modelPolicy:policy,results},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({mode,completed:true,candidates:3,casesPerCandidate:entries.length*repetitions,providerCalls:mode==='control'?0:'recorded-in-traces'}));
}finally{for(const {worker}of workers)if(worker.connected)worker.disconnect();}
