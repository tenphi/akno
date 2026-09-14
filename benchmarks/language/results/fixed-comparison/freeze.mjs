import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {loadConfig} from '../../packages/core/src/config/load.ts';
const base=path.resolve('tmp/akno-comparison');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
export function candidateProof(candidate){
 const root=path.resolve(candidate.root);
 assert.equal(execFileSync('git',['-C',root,'diff',candidate.commit,'--','packages','pnpm-lock.yaml'],{encoding:'utf8'}),'');
 assert.equal(execFileSync('git',['-C',root,'ls-files','--others','--exclude-standard','packages'],{encoding:'utf8'}),'');
 const digest=createHash('sha256');
 const walk=(relative)=>{for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=relative+'/'+entry.name;if(entry.isDirectory())walk(file);else{digest.update(file+'\0');digest.update(fs.readFileSync(path.join(root,file)));}}};
 for(const pkg of ['core','protocol'])for(const folder of ['src','dist'])walk('packages/'+pkg+'/'+folder);
 const req=createRequire(path.join(root,'packages/core/dist/open.js'));
 const protocol=fs.realpathSync(req.resolve('@tenphi/akno-protocol'));assert(protocol.startsWith(root+'/packages/protocol/dist/'));
 const Database=req('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();
 return {label:candidate.label,commit:candidate.commit,packageTreeSha256:digest.digest('hex'),protocol:path.relative(root,protocol),node:process.version,execPath:process.execPath,abi:process.versions.modules,lockSha256:sha(fs.readFileSync(path.join(root,'pnpm-lock.yaml')))};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 assert.equal(process.versions.modules,'127');
 const config=loadConfig();const modelPolicy=Object.fromEntries(['derive','answer','embedding','expansion'].map(role=>{const m=config.models[role];return[role,{id:m.id,enabled:m.enabled,maxOutputTokens:m.maxOutputTokens??null,timeoutMs:m.timeoutMs,reasoningEffort:m.reasoningEffort??null}];}));
 const control=read('control/completed.json');assert.equal(control.corpusFingerprint,read('corpus.json').corpusFingerprint);
 const declaration={createdAt:new Date().toISOString(),corpusFingerprint:read('corpus.json').corpusFingerprint,corpusFileSha256:sha(fs.readFileSync(path.join(base,'corpus.json'))),sourceObligationsSha256:sha(fs.readFileSync(path.join(base,'source-first-obligations.json'))),modelPolicy,candidates:read('candidates.json').map(candidateProof),design:'One exposed fixed regression suite: all V9 cases plus V22 held-out cases, two runs, eight query/answer/view coordinates. Common external case procedure; each candidate owns runtime and protocol. Rotating sequential arm submission, no selective retries.',grading:'Source-first anonymous outputs; full retention distinct from focused answer usefulness; source entailment, qualifications, language, promotion, retrieval, availability and byte stability reported separately. Preserve initial grades and coordinate-specific corrections.',selection:'Zero accepted source/qualification/language/promotion errors and unchanged bytes for rollout. Target80% complete retention, retrieval and useful answers per block/run; case availability<=5%. Report90% separately. Rank worst-block/run answer coverage, then retention/retrieval; less than8 net answers without consistent case advantage does not justify large port. Shared prose defects cannot rank arms but must be fixed.',budget:'One three-arm comparison plus at most one evidence-led integration and fixed-suite verification; earlier two iterations remain charged against original10 cap.',zeroEgressControlSha256:sha(fs.readFileSync(path.join(base,'control/completed.json')))};
 fs.writeFileSync(path.join(base,'declaration.json'),JSON.stringify(declaration,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({frozen:true,candidates:declaration.candidates.map(x=>({label:x.label,node:x.node,abi:x.abi})),corpus:declaration.corpusFingerprint}));
}
