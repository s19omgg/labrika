import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBillingHandler} from './billing-service.mjs';

const environment={
  TOCHKA_API_BASE_URL:'https://tochka.example/uapi',
  TOCHKA_JWT_TOKEN:'server-only-token',
  TOCHKA_CUSTOMER_CODE:'1234567ab',
  TOCHKA_MERCHANT_ID:'200000000001056',
  TOCHKA_RECEIPTS_ENABLED:'true',
  TOCHKA_TAX_SYSTEM_CODE:'usn_income',
  TOCHKA_VAT_TYPE:'none',
  TOCHKA_PAYMENT_MODES:'sbp,card',
  TOCHKA_REDIRECT_ORIGIN:'https://app.labrica.pro',
};

test('Tochka checkout uses server prices and activates a paid subscription once',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'labrica-billing-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const account={id:'account-1',name:'Сергей',surname:'Байгот',email:'owner@example.test',phone:'+7 (999) 999-99-99',status:'active',subscription:null};
  let providerStatus='CREATED',operationId='',activations=0,createBody=null;
  const accountStore={
    get:id=>id===account.id?account:null,
    activatePaidSubscription(id,planId,days,reference){assert.equal(id,account.id);assert.equal(planId,'business');assert.equal(days,30);assert.equal(reference,operationId);activations++;account.subscription={planId,source:'paid',autoRenew:false,startsAt:new Date(0).toISOString(),expiresAt:new Date(30*86400000).toISOString()};return account;},
  };
  const fetchImpl=async(url,init={})=>{
    assert.equal(init.headers.Authorization,'Bearer server-only-token');
    if(init.method==='POST'){
      createBody=JSON.parse(init.body);operationId='operation-1';
      return new Response(JSON.stringify({Data:{operationId,paymentLink:'https://secure.tochka.example/pay/1',status:'CREATED'}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.match(String(url),/\/acquiring\/v1\.0\/payments\/operation-1$/);
    return new Response(JSON.stringify({Data:{Operation:[{operationId,amount:'9990.00',customerCode:'1234567ab',merchantId:'200000000001056',status:providerStatus}]}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const handler=createBillingHandler({directory,accountStore,resolveAccount:()=>account,fetchImpl,env:environment,webhookVerifier:async()=>({operationId})});
  const server=createServer(handler);await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const checkoutResponse=await fetch(`${base}/api/billing/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:'business',amount:1})});
  assert.equal(checkoutResponse.status,201);const created=await checkoutResponse.json();assert.equal(created.paymentUrl,'https://secure.tochka.example/pay/1');
  assert.equal(createBody.Data.amount,'9990.00');assert.equal(createBody.Data.Items[0].amount,'9990.00');assert.equal(createBody.Data.Client.phone,'+79999999999');assert.equal(createBody.Data.preAuthorization,false);assert.deepEqual(createBody.Data.paymentMode,['sbp','card']);
  const pendingResponse=await fetch(`${base}/api/billing/checkout/${created.checkoutId}`);assert.equal((await pendingResponse.json()).checkout.status,'pending');assert.equal(activations,0);
  providerStatus='APPROVED';
  const webhookResponse=await fetch(`${base}/api/billing/tochka/webhook`,{method:'POST',headers:{'Content-Type':'text/plain'},body:'signed.jwt.value'});assert.equal(webhookResponse.status,200);assert.equal(activations,1);
  const paidResponse=await fetch(`${base}/api/billing/checkout/${created.checkoutId}`),paid=await paidResponse.json();assert.equal(paid.checkout.status,'paid');assert.equal(paid.account.subscription.source,'paid');assert.equal(activations,1);
  assert.equal(handler.adminStatus().confirmedRevenue,9990);assert.equal(handler.adminStatus().confirmedPayments,1);
});

test('checkout remains disabled without server credentials',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'labrica-billing-empty-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const account={id:'account-1',name:'Сергей',email:'owner@example.test',status:'active'};
  const handler=createBillingHandler({directory,accountStore:{get:()=>account},resolveAccount:()=>account,fetchImpl:async()=>{throw new Error('must not call');},env:{}});
  const server=createServer(handler);await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/billing/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:'min'})});
  assert.equal(response.status,503);assert.match((await response.json()).error,/не настроена/i);
});
