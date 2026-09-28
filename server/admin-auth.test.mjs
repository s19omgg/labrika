import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createAdminAuthHandler} from './admin-auth.mjs';

test('admin credentials create an HttpOnly signed session and logout clears it',async t=>{
 const handler=createAdminAuthHandler({login:'admin@labrica.com',password:'adminadmin',secret:'test-secret',overview:()=>({status:'real'})}),server=createServer(handler);await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
 const base=`http://127.0.0.1:${server.address().port}/api/admin/session`;
 const call=async(method,body,cookie='',headers={})=>{const response=await fetch(base,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')||''};};
 assert.equal((await call('GET')).data.authenticated,false);
 assert.equal((await call('POST',{login:'admin@labrica.com',password:'wrong'})).status,401);
 assert.equal((await call('POST',{login:'admin@labrica.com',password:'adminadmin'},'',{Origin:'https://evil.test',Host:'admin.labrica.pro'})).status,403);
 const signed=await call('POST',{login:'admin@labrica.com',password:'adminadmin'});assert.equal(signed.status,200);assert.match(signed.cookie,/HttpOnly/);assert.match(signed.cookie,/SameSite=Strict/);
 const pair=signed.cookie.split(';')[0];assert.equal((await call('GET',null,pair)).data.authenticated,true);
 const denied=await fetch(base.replace('/session','/overview'));assert.equal(denied.status,401);
 const overview=await fetch(base.replace('/session','/overview'),{headers:{Cookie:pair}});assert.equal(overview.status,200);assert.deepEqual(await overview.json(),{status:'real'});
 const logout=await call('DELETE',null,pair);assert.equal(logout.data.authenticated,false);assert.match(logout.cookie,/Max-Age=0/);
});
