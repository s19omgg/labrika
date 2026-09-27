import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApprovalHandler} from './approvals.mjs';
test('private issuer, anonymous review, scoped immutable snapshot and terminal decisions',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'labrika-approval-'));let now=Date.now();const server=createServer(createApprovalHandler({directory,issuerKey:'local-test-key',now:()=>now}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/approvals`;
 const input={edition:'labrika',workspaceId:'workspace-a',brand:'Company',posts:[{id:'p1',title:'Approved facts',body:'A factual post for review.',platforms:['telegram']}]};
 const post=(url,value,key)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?{'X-Approval-Key':key}:{})},body:JSON.stringify(value)});
 try{
  assert.equal((await post(base,input)).status,401);
  const created=await post(base,input,'local-test-key');assert.equal(created.status,201);const {id,token}=await created.json();assert.equal(token.length,43);
  assert.ok(!readFileSync(join(directory,'approvals.json'),'utf8').includes(token));
  const url=base+'/'+token;const snapshot=await(await fetch(url)).json();assert.equal(snapshot.posts[0].body,input.posts[0].body);assert.equal(snapshot.workspaceId,undefined);assert.equal(snapshot.tokenHash,undefined);
  assert.equal((await post(url,{action:'comment',comment:'Please check the date'})).status,200);
  assert.equal((await(await post(url,{action:'approve'})).json()).status,'approved');
  assert.equal((await post(url,{action:'reject'})).status,409);
  assert.equal((await fetch(base+'/records/'+id)).status,401);
  assert.equal((await fetch(base+'/records/'+id,{method:'DELETE',headers:{'X-Approval-Key':'local-test-key'}})).status,200);assert.equal((await fetch(url)).status,410);
  const second=await(await post(base,{...input,expiresInMs:60000},'local-test-key')).json();now+=60001;assert.equal((await fetch(base+'/'+second.token)).status,410);
  assert.equal((await fetch(base+'/'+('a'.repeat(43)))).status,404);
 }finally{await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
});
