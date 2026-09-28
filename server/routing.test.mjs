import test from 'node:test';
import assert from 'node:assert/strict';
import {editionRoutes} from './routing.mjs';

function route(url,host){let status=0,headers={},body='';const req={url,headers:{host}},res={writeHead(value,next={}){status=value;headers=next;},end(value=''){body=value;}};let passed=false;editionRoutes(req,res,()=>{passed=true;});return{url:req.url,status,headers,body,passed};}

test('subdomains resolve to independent entry files',()=>{
 assert.equal(route('/workspace','app.labrica.pro').url,'/app/index.html');
 assert.equal(route('/forgot-password','auth.labrica.pro').url,'/auth/index.html');
 assert.equal(route('/','admin.labrica.pro').url,'/admin/index.html');
 assert.equal(route('/terms','legal.labrica.pro').url,'/legal/index.html');
});

test('assets and APIs are not swallowed by host routing',()=>{
 assert.equal(route('/assets/main.js','app.labrica.pro').url,'/assets/main.js');
 assert.equal(route('/@vite/client','app.localhost').url,'/@vite/client');
 assert.equal(route('/api/auth/email/start','auth.labrica.pro').url,'/api/auth/email/start');
 assert.equal(route('/legal-documents/terms.docx','legal.labrica.pro').url,'/legal-documents/terms.docx');
});

test('local path fallbacks work and removed admin route is 404',()=>{
 assert.equal(route('/app','127.0.0.1').url,'/app/index.html');
 assert.equal(route('/auth/login','127.0.0.1').url,'/auth/index.html');
 assert.equal(route('/legal/privacy','127.0.0.1').url,'/legal/index.html');
 assert.equal(route('/legal/main.tsx','127.0.0.1').url,'/legal/main.tsx');
 const removed=route('/labrika/admin/','127.0.0.1');assert.equal(removed.status,404);assert.match(removed.body,/адрес удалён/i);
});
