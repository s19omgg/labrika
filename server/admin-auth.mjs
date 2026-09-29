import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createAccountStore} from './account-store.mjs';

const digest=value=>createHash('sha256').update(String(value)).digest();
const same=(left,right)=>timingSafeEqual(digest(left),digest(right));
const fail=(status,message)=>Object.assign(new Error(message),{status});
const cookieValue=(req,value,maxAge)=>{
 const secure=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
 return `labrica_admin_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
};

export function createAdminAuthHandler({login=process.env.ADMIN_LOGIN||'sergiolabenzo',password=process.env.ADMIN_PASSWORD||'',secret=process.env.ADMIN_SESSION_SECRET||randomBytes(32).toString('hex'),now=()=>Date.now(),accountStore,overview=()=>null,billing}={}){
 const accounts=accountStore||createAccountStore({now});
 const attempts=new Map();
 const sign=payload=>createHmac('sha256',secret).update(payload).digest('base64url');
 const issue=()=>{const payload=`${now()+12*60*60*1000}.${randomBytes(18).toString('base64url')}`;return `${payload}.${sign(payload)}`;};
 const valid=req=>{const raw=String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('labrica_admin_session='))?.slice('labrica_admin_session='.length)||'';const split=raw.lastIndexOf('.');if(split<1)return false;const payload=raw.slice(0,split),signature=raw.slice(split+1),expires=Number(payload.split('.')[0]);return Number.isFinite(expires)&&expires>now()&&same(signature,sign(payload));};
 async function readBody(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw fail(413,'Слишком большой запрос');}try{return JSON.parse(text||'{}');}catch{throw fail(400,'Некорректный запрос');}}
 return async function adminAuth(req,res,next=()=>{res.statusCode=404;res.end();}){
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/admin/'))return next();
  const reply=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));};
  try{
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Запрос запрещён');
   if(path==='/api/admin/session'){
    if(req.method==='GET')return reply(200,{authenticated:valid(req)});
    if(req.method==='DELETE')return reply(200,{authenticated:false},{'Set-Cookie':cookieValue(req,'',0)});
    if(req.method!=='POST')throw fail(405,'Метод недоступен');
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim(),ip=forwarded||req.socket.remoteAddress||'local',bucket=attempts.get(ip);if(bucket&&bucket.until>now()&&bucket.count>=10)throw fail(429,'Слишком много попыток. Попробуйте позже.');if(!bucket||bucket.until<=now())attempts.set(ip,{count:0,until:now()+15*60*1000});attempts.get(ip).count++;
    if(!password)throw fail(503,'Вход администратора не настроен на сервере.');
    const input=await readBody(req);if(!same(String(input.login||'').trim().toLowerCase(),login.trim().toLowerCase())||!same(input.password||'',password))throw fail(401,'Проверьте логин и пароль.');
    attempts.delete(ip);return reply(200,{authenticated:true},{'Set-Cookie':cookieValue(req,issue(),12*60*60)});
   }

   if(!valid(req))throw fail(401,'Сессия администратора истекла. Войдите снова.');

   if(path==='/api/admin/overview'&&req.method==='GET')return reply(200,overview());

   if(path==='/api/admin/billing'&&req.method==='GET'){
    const snapshot=accounts.snapshot();
    const paymentSnapshot=billing?.snapshot?.()||{payments:[],checkouts:[],config:{provider:'none',merchantId:'',legalName:'',supportEmail:'',currency:'RUB'}};
    return reply(200,{...snapshot,...paymentSnapshot,usage:[]});
   }

   const match=path.match(/^\/api\/admin\/accounts\/([^/]+)(?:\/(.*))?$/);
   if(match){
    const id=decodeURIComponent(match[1]),action=match[2]||'';
    if(!action&&req.method==='PATCH'){const input=await readBody(req);return reply(200,{account:accounts.update(id,input)});}
    if(action==='status'&&req.method==='POST'){const input=await readBody(req);return reply(200,{account:accounts.setStatus(id,input.status)});}
    if(action==='subscription/grant'&&req.method==='POST'){const input=await readBody(req);return reply(200,{account:accounts.grantSubscription(id,String(input.planId||''),Number(input.days))});}
    if(action==='subscription/revoke'&&req.method==='POST')return reply(200,{account:accounts.revokeSubscription(id)});
    if(action==='subscription/extend'&&req.method==='POST'){const input=await readBody(req);return reply(200,{account:accounts.extendSubscription(id,Number(input.days))});}
    throw fail(405,'Метод недоступен');
   }

   throw fail(404,'Не найдено');
  }catch(error){return reply(error.status||500,{error:error.status?error.message:'Не удалось выполнить запрос'});}
 };
}
