import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminOverview,createRuntimeMonitor} from './admin-monitoring.mjs';

test('admin overview reports only factual server and integration state',()=>{
 const time=Date.parse('2026-09-29T12:00:00.000Z');
 const monitor=createRuntimeMonitor({now:()=>time});
 const overview=createAdminOverview({
  now:()=>time,
  monitor,
  accountStore:{snapshot:()=>({accounts:[{id:'a1',name:'Сергей',surname:'Байгот',email:'owner@example.test',status:'active',lastSeenAt:'2026-09-29T11:59:30.000Z',subscription:{expiresAt:'2026-10-29T12:00:00.000Z'}}],logs:[]})},
  auth:{adminStatus:()=>({smtp:{configured:true,status:'connected'},verificationEmails:{sent:2,failed:0}})},
  providers:{status:()=>({openai:{configured:true,status:'verified'},higgsfield:{configured:false,status:'disconnected'},capabilities:{text:true,image:true,video:false},encoder:true})},
  social:{adminStatus:()=>({workspaceCount:1,connectionCount:1,connectedCount:1,errorCount:0,byPlatform:{telegram:1},connections:[{workspaceId:'w1',accountId:'a1',platform:'telegram',accountName:'Канал',status:'connected'}],publications:{total:0,published:0,failed:0}})},
 });
 const value=overview();
 assert.equal(value.metrics.accounts,1);assert.equal(value.metrics.online,1);assert.equal(value.metrics.activeSubscriptions,1);
 assert.equal(value.metrics.confirmedRevenue,0);assert.equal(value.payments.configured,false);
 assert.equal(value.social.connections[0].account.email,'owner@example.test');
 assert.equal(value.server.status,'online');
});
