import test from 'node:test';
import assert from 'node:assert/strict';
import {editionRoutes,infrastructureGate} from './routing.mjs';

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

test('infrastructure subdomains expose only their intended surface',()=>{
 const gate=(url,host)=>{let status=0,body='',passed=false;const req={url,headers:{host}},res={writeHead(value){status=value;},end(value=''){body=value;}};infrastructureGate(req,res,()=>{passed=true;});return{url:req.url,status,body,passed};};
 assert.equal(gate('/api/admin/overview','api.labrica.pro').passed,true);
 assert.equal(gate('/','api.labrica.pro').status,404);
 assert.equal(gate('/api/social/telegram/webhook','hooks.labrica.pro').passed,true);
 assert.equal(gate('/api/billing/tochka/webhook','hooks.labrica.pro').passed,true);
 assert.equal(gate('/api/auth/session','hooks.labrica.pro').status,404);
 assert.equal(gate('/','status.labrica.pro').url,'/api/health');
 assert.equal(gate('/brand/labrica-symbol.svg','assets.labrica.pro').passed,true);
 assert.equal(gate('/admin','assets.labrica.pro').status,404);
 assert.equal(gate('/anything','files.labrica.pro').status,404);
});

test('local path fallbacks work and removed admin route is 404',()=>{
 assert.equal(route('/app','127.0.0.1').url,'/app/index.html');
 assert.equal(route('/auth/login','127.0.0.1').url,'/auth/index.html');
 assert.equal(route('/legal/privacy','127.0.0.1').url,'/legal/index.html');
 assert.equal(route('/legal/main.tsx','127.0.0.1').url,'/legal/main.tsx');
 const removed=route('/labrika/admin/','127.0.0.1');assert.equal(removed.status,404);assert.match(removed.body,/адрес удалён/i);
});
