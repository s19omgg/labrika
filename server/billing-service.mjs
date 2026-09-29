import {createPublicKey,randomUUID,verify} from 'node:crypto';
import {createPaymentStore} from './payment-store.mjs';

const plans={
  min:{name:'MIN',amount:4990},
  business:{name:'BUSINESS',amount:9990},
  pro:{name:'PRO',amount:19990},
};
const terminalStatuses=new Set(['APPROVED','EXPIRED','REFUNDED','REFUNDED_PARTIALLY']);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const amount=value=>Number(Number(value).toFixed(2));
const receiptPhone=value=>{
  const input=String(value||'').trim(),digits=input.replace(/\D/g,'');
  if(!digits)return'';
  return input.startsWith('+')?`+${digits}`:digits;
};
const publicCheckout=checkout=>({id:checkout.id,planId:checkout.planId,amount:checkout.amount,currency:'RUB',status:checkout.status,createdAt:checkout.createdAt,updatedAt:checkout.updatedAt,...(checkout.paidAt?{paidAt:checkout.paidAt}:{})});
const findDeep=(value,key)=>{
  if(!value||typeof value!=='object')return null;
  if(typeof value[key]==='string')return value[key];
  for(const child of Object.values(value)){const found=findDeep(child,key);if(found)return found;}
  return null;
};

export function createBillingHandler({
  directory='.data',
  accountStore,
  resolveAccount=()=>null,
  fetchImpl=fetch,
  now=()=>Date.now(),
  store=createPaymentStore({directory}),
  env=process.env,
  webhookVerifier,
}={}){
  const baseUrl=String(env.TOCHKA_API_BASE_URL||'https://enter.tochka.com/uapi').replace(/\/$/,'');
  const token=String(env.TOCHKA_JWT_TOKEN||'').trim();
  const customerCode=String(env.TOCHKA_CUSTOMER_CODE||'').trim();
  const merchantId=String(env.TOCHKA_MERCHANT_ID||'').trim();
  const receipts=String(env.TOCHKA_RECEIPTS_ENABLED||'true').toLowerCase()!=='false';
  const taxSystemCode=String(env.TOCHKA_TAX_SYSTEM_CODE||'').trim();
  const vatType=String(env.TOCHKA_VAT_TYPE||'').trim();
  const redirectOrigin=String(env.TOCHKA_REDIRECT_ORIGIN||'https://app.labrica.pro').replace(/\/$/,'');
  const modes=String(env.TOCHKA_PAYMENT_MODES||'sbp,card').split(',').map(value=>value.trim()).filter(value=>['sbp','card','tinkoff','dolyame'].includes(value));
  const configured=Boolean(token&&customerCode&&merchantId&&modes.length&&(!receipts||(taxSystemCode&&vatType)));
  let publicKeyCache=null;
  const telemetry={lastError:null,lastRequestAt:null,lastSuccessAt:null};

  async function readBody(req,limit=16384){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>limit)throw fail(413,'Слишком большой запрос');}try{return JSON.parse(text||'{}');}catch{throw fail(400,'Некорректный запрос');}}
  async function readText(req,limit=65536){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>limit)throw fail(413,'Слишком большой запрос');}return text.trim();}
  async function tochka(path,init={}){
    if(!configured)throw fail(503,'Оплата ещё не настроена.');
    telemetry.lastRequestAt=new Date(now()).toISOString();
    let response;
    try{response=await fetchImpl(`${baseUrl}${path}`,{...init,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},signal:AbortSignal.timeout(20000)});}catch{telemetry.lastError='Точка API недоступен';throw fail(502,'Платёжный сервис временно недоступен. Попробуйте позже.');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){telemetry.lastError=`Точка API: HTTP ${response.status}`;throw fail(502,'Точка не смогла создать или проверить платёж. Попробуйте позже.');}
    telemetry.lastSuccessAt=new Date(now()).toISOString();telemetry.lastError=null;return data;
  }
  async function defaultWebhookVerifier(tokenValue){
    const parts=String(tokenValue).split('.');if(parts.length!==3)throw fail(400,'Некорректный webhook');
    let header,payload;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));payload=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw fail(400,'Некорректный webhook');}
    if(header.alg!=='RS256')throw fail(401,'Неподдерживаемая подпись webhook');
    if(!publicKeyCache){
      const response=await fetchImpl('https://enter.tochka.com/doc/openapi/static/keys/public',{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw fail(502,'Не удалось получить ключ проверки webhook');
      publicKeyCache={key:createPublicKey(await response.text()),expiresAt:now()+86400000};
    }else if(publicKeyCache.expiresAt<=now())publicKeyCache=null;
    if(!publicKeyCache)return defaultWebhookVerifier(tokenValue);
    const valid=verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),publicKeyCache.key,Buffer.from(parts[2],'base64url'));
    if(!valid)throw fail(401,'Подпись webhook не прошла проверку');
    if(payload.exp&&Number(payload.exp)*1000<now())throw fail(401,'Webhook истёк');
    return payload;
  }
  const verifyWebhook=webhookVerifier||defaultWebhookVerifier;

  async function reconcile(checkout){
    if(!checkout?.operationId)throw fail(404,'Платёж не найден.');
    const response=await tochka(`/acquiring/v1.0/payments/${encodeURIComponent(checkout.operationId)}`);
    const operation=response?.Data?.Operation?.[0];
    if(!operation||operation.operationId!==checkout.operationId)throw fail(502,'Точка вернула некорректные данные платежа.');
    if(amount(operation.amount)!==checkout.amount||operation.customerCode!==customerCode||(operation.merchantId&&operation.merchantId!==merchantId))throw fail(409,'Реквизиты платежа не совпадают с заказом.');
    const status=String(operation.status||'').toUpperCase(),updatedAt=new Date(now()).toISOString();
    if(status==='APPROVED'){
      const account=accountStore.activatePaidSubscription(checkout.accountId,checkout.planId,30,checkout.operationId);
      const paidAt=operation.paidAt||updatedAt;
      return{checkout:store.update(checkout.id,{status:'paid',providerStatus:status,paidAt,updatedAt,activatedAt:updatedAt}),account};
    }
    if(status==='EXPIRED')return{checkout:store.update(checkout.id,{status:'expired',providerStatus:status,updatedAt}),account:accountStore.get(checkout.accountId)};
    if(status==='REFUNDED'||status==='REFUNDED_PARTIALLY')return{checkout:store.update(checkout.id,{status:status==='REFUNDED'?'refunded':'refunded_partially',providerStatus:status,updatedAt}),account:accountStore.get(checkout.accountId)};
    if(terminalStatuses.has(status))throw fail(409,'Не удалось обработать итоговый статус платежа.');
    return{checkout:store.update(checkout.id,{status:'pending',providerStatus:status||'CREATED',updatedAt}),account:accountStore.get(checkout.accountId)};
  }

  const handler=async function billing(req,res,next=()=>{res.statusCode=404;res.end();}){
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/api/billing/'))return next();
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try{
      if(path==='/api/billing/tochka/webhook'){
        if(req.method!=='POST')throw fail(405,'Метод недоступен');
        const payload=await verifyWebhook(await readText(req)),operationId=findDeep(payload,'operationId');
        if(!operationId)throw fail(400,'В webhook отсутствует operationId');
        store.webhookReceived(new Date(now()).toISOString());
        const checkout=store.findByOperation(operationId);if(checkout)await reconcile(checkout);
        return reply(200,{received:true});
      }
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Запрос запрещён');
      const account=resolveAccount(req);if(!account)throw fail(401,'Сессия истекла. Войдите снова.');
      const owner=account.ownerId?accountStore.get(account.ownerId):account;if(!owner)throw fail(403,'Владелец пространства не найден.');
      if(path==='/api/billing/config'&&req.method==='GET')return reply(200,{provider:'tochka',configured,receipts,paymentModes:modes});
      if(path==='/api/billing/checkout'&&req.method==='POST'){
        if(!configured)throw fail(503,'Оплата через Точку ещё не настроена на сервере.');
        const input=await readBody(req),plan=plans[String(input.planId||'')];if(!plan)throw fail(400,'Этот тариф оформляется через менеджера.');
        const id=randomUUID(),createdAt=new Date(now()).toISOString(),checkout={id,provider:'tochka',accountId:owner.id,planId:String(input.planId),amount:plan.amount,currency:'RUB',status:'creating',createdAt,updatedAt:createdAt};
        store.create(checkout);
        const returnUrl=`${redirectOrigin}/?page=billing&payment=return&checkout=${encodeURIComponent(id)}`;
        const failureUrl=`${redirectOrigin}/?page=billing&payment=failed&checkout=${encodeURIComponent(id)}`;
        const data={customerCode,amount:plan.amount.toFixed(2),purpose:`Подписка LABRICA ${plan.name} на 30 дней`,redirectUrl:returnUrl,failRedirectUrl:failureUrl,paymentMode:modes,saveCard:false,consumerId:owner.id,merchantId,preAuthorization:false,ttl:1440,paymentLinkId:id};
        if(receipts){const phone=receiptPhone(owner.phone);Object.assign(data,{taxSystemCode,Client:{name:[owner.surname,owner.name,owner.patronymic].filter(Boolean).join(' '),email:owner.email,...(phone?{phone}:{})},Items:[{vatType,name:`Подписка LABRICA ${plan.name} на 30 дней`,amount:plan.amount.toFixed(2),quantity:1,paymentMethod:'full_payment',paymentObject:'service',measure:'шт.'}]});}
        try{
          const response=await tochka(`/acquiring/v1.0/${receipts?'payments_with_receipt':'payments'}`,{method:'POST',body:JSON.stringify({Data:data})}),result=response?.Data;
          if(!result?.operationId||!/^https:\/\//.test(String(result.paymentLink||'')))throw fail(502,'Точка не вернула платёжную ссылку.');
          store.update(id,{operationId:String(result.operationId),paymentLink:String(result.paymentLink),status:'pending',providerStatus:String(result.status||'CREATED'),updatedAt:new Date(now()).toISOString()});
          return reply(201,{checkoutId:id,paymentUrl:String(result.paymentLink)});
        }catch(error){store.update(id,{status:'failed',updatedAt:new Date(now()).toISOString()});throw error;}
      }
      const match=path.match(/^\/api\/billing\/checkout\/([^/]+)$/);
      if(match&&req.method==='GET'){
        const checkout=store.get(decodeURIComponent(match[1]));if(!checkout||checkout.accountId!==owner.id)throw fail(404,'Платёж не найден.');
        const result=checkout.status==='paid'||checkout.status==='refunded'||checkout.status==='refunded_partially'?{checkout,account:owner}:await reconcile(checkout);
        return reply(200,{checkout:publicCheckout(result.checkout),account:result.account});
      }
      throw fail(404,'Не найдено');
    }catch(error){return reply(error.status||500,{error:error.status?error.message:'Не удалось выполнить запрос'});}
  };
  handler.adminStatus=()=>{
    const snapshot=store.snapshot(),paid=snapshot.checkouts.filter(item=>item.status==='paid');
    return{provider:'tochka',configured,receipts,customerCode:customerCode||null,merchantId:merchantId||null,confirmedPayments:paid.length,confirmedRevenue:paid.reduce((sum,item)=>sum+item.amount,0),lastWebhookAt:snapshot.lastWebhookAt,lastError:telemetry.lastError,lastRequestAt:telemetry.lastRequestAt,lastSuccessAt:telemetry.lastSuccessAt};
  };
  handler.snapshot=()=>{
    const snapshot=store.snapshot();
    return{
      checkouts:snapshot.checkouts.map(publicCheckout),
      payments:snapshot.checkouts.filter(item=>['paid','refunded','refunded_partially'].includes(item.status)).map(item=>({id:item.id,accountId:item.accountId,planId:item.planId,amount:item.amount,currency:'RUB',status:item.status==='paid'?'paid':'refunded',createdAt:item.paidAt||item.createdAt,reference:item.operationId})),
      config:{provider:'tochka',merchantId,legalName:'ИП Байгот Сергей Русланович',supportEmail:'',currency:'RUB',configured,receipts},
    };
  };
  return handler;
}
