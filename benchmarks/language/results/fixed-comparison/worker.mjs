import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {bindRuntime} from './common-case.mjs';

let execute, config, destination, active, sequence=0, networkAttempts=0;
const send=value=>process.send(value);
const append=event=>fs.appendFileSync(path.join(destination,'trace.jsonl'),JSON.stringify({...active,...event})+'\n');
const category=error=>/timeout|timed out/i.test(String(error))?'timeout':/schema|parse|json/i.test(String(error))?'schema-or-parse':'operation-failure';
function instrument(prototype,name){
 const original=prototype[name];assert.equal(typeof original,'function');
 prototype[name]=async function(...args){
  const id=++sequence,started=Date.now();
  const messages=args[0],options=args[1];
  append({event:'model-start',id,method:name,model:this.modelId,messages,maxTokens:options?.maxTokens??null});
  try{
   const result=await original.apply(this,args);
   append({event:'model-result',id,method:name,elapsedMs:Date.now()-started,ok:result.ok,reason:result.reason??null,value:result.value??null,usage:result.usage??null,endpointRequests:result.endpointRequests??null,errorCategory:result.error?category(result.error):null});
   return result;
  }catch(error){append({event:'model-throw',id,method:name,elapsedMs:Date.now()-started,errorCategory:category(error)});throw error;}
 };
}
process.on('message',async message=>{
 try{
  if(message.type==='initialize'){
   destination=path.resolve(message.destination);fs.mkdirSync(destination,{recursive:true});
   assert(!fs.existsSync(path.join(destination,'trace.jsonl')));config=message.config;
   if(message.control){globalThis.fetch=async()=>{networkAttempts++;throw new Error('Zero-egress control attempted network');};}
   const root=path.resolve(message.root);
   const {open}=await import(pathToFileURL(path.join(root,'packages/core/dist/open.js')).href);
   const {ModelClient}=await import(pathToFileURL(path.join(root,'packages/core/dist/models/client.js')).href);
   instrument(ModelClient.prototype,'chat');instrument(ModelClient.prototype,'chatTransport');
   const observedOpen=async options=>{
    let memory;
    try{memory=await open(options);}catch(error){
     let message=error instanceof Error?error.message:'Open failed';
     for(const provider of Object.values(config.providers))if(provider.apiKey)message=message.replaceAll(provider.apiKey,'[redacted]');
     append({event:'open-throw',errorCategory:category(error),message});throw error;
    }
    const wrapped=new Map();
    return new Proxy(memory,{get(target,key){
     const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
     if(!wrapped.has(key))wrapped.set(key,async(...args)=>{
      const started=Date.now();
      try{const result=await value.apply(target,args);if(['retain','read','recall','context','answer','index'].includes(key))append({event:'public-result',operation:key,input:args[0]??null,result,elapsedMs:Date.now()-started});return result;}
      catch(error){append({event:'public-throw',operation:key,errorCategory:category(error),elapsedMs:Date.now()-started});throw error;}
     });return wrapped.get(key);
    }});
   };
   execute=bindRuntime(observedOpen);send({type:'ready'});return;
  }
  if(message.type==='case'){
   assert(execute);active={caseId:message.source.id,run:message.run,block:message.block};
   const started=Date.now();append({event:'case-start'});
   const result=await execute(config,message.source,'v9',message.run);
   const receipt={...active,elapsedMs:Date.now()-started,networkAttempts,result};
   fs.appendFileSync(path.join(destination,'cases.jsonl'),JSON.stringify(receipt)+'\n');
   append({event:'case-finish',elapsedMs:receipt.elapsedMs,observedQueries:result.queries.length,error:result.error});
   send({type:'case-result',receipt});active=null;return;
  }
  if(message.type==='close'){send({type:'closed',networkAttempts});process.disconnect();return;}
  throw new Error('Unknown worker message');
 }catch(error){send({type:'worker-failure',errorCategory:category(error),message:error instanceof Error?error.message:'Worker failed'});}
});
