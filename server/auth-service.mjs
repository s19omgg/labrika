import {verificationEmail} from './email-template.mjs';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import nodemailer from 'nodemailer';
import {createAccountStore} from './account-store.mjs';

const digest=value=>createHash('sha256').update(value).digest();
const same=(a,b)=>timingSafeEqual(digest(String(a)),digest(String(b)));
const emailOK=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value);
const fail=(status,message)=>Object.assign(new Error(message),{status});

export function createAuthHandler({directory='.data',issuerKey=process.env.APPROVAL_ISSUER_KEY,now=()=>Date.now(),transportFactory=options=>nodemailer.createTransport(options),accountStore}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const keyPath=join(directory,'approval-issuer.key');
 if(!issuerKey){if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('hex'),{mode:0o600});issuerKey=readFileSync(keyPath,'utf8').trim();}
 const accounts=accountStore||createAccountStore({directory,now});
 const sessionKeyPath=join(directory,'account-session.key');
 if(!existsSync(sessionKeyPath))writeFileSync(sessionKeyPath,randomBytes(32).toString('hex'),{mode:0o600});
 const sessionSecret=readFileSync(sessionKeyPath,'utf8').trim();
 const encryptionKey=digest(`smtp:${issuerKey}`),file=join(directory,'smtp.json');
 const envConfig=()=>process.env.POSTBOX_SMTP_HOST&&process.env.POSTBOX_SMTP_USER&&process.env.POSTBOX_SMTP_PASSWORD&&process.env.POSTBOX_FROM_EMAIL?{host:process.env.POSTBOX_SMTP_HOST,port:Number(process.env.POSTBOX_SMTP_PORT||587),secure:Number(process.env.POSTBOX_SMTP_PORT||587)===465,user:process.env.POSTBOX_SMTP_USER,password:process.env.POSTBOX_SMTP_PASSWORD,from:process.env.POSTBOX_FROM_EMAIL,fromName:process.env.POSTBOX_FROM_NAME||'LABRICA'}:null;
 const read=()=>{const env=envConfig();if(env)return env;if(!existsSync(file))return null;const value=JSON.parse(readFileSync(file,'utf8')),decipher=createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString());};
 const save=config=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv),data=Buffer.concat([cipher.update(JSON.stringify(config)),cipher.final()]);writeFileSync(file+'.tmp',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});renameSync(file+'.tmp',file);};
 const view=config=>config?{host:config.host,port:config.port,secure:config.secure,user:config.user,from:config.from,fromName:config.fromName,configured:!!config.password}:{host:'',port:465,secure:true,user:'',from:'',fromName:'LABRICA',configured:false};
 const challenges=new Map(),proofs=new Map(),limits=new Map();
 const transport=config=>transportFactory({host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,auth:{user:config.user,pass:config.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
 const takeLimit=(key,max,windowMs)=>{let bucket=limits.get(key);if(!bucket||bucket.until<=now()){bucket={count:0,until:now()+windowMs};limits.set(key,bucket);}if(bucket.count>=max)throw fail(429,'Слишком много попыток. Попробуйте позже.');bucket.count++;};
 const cleanup=()=>{for(const map of [challenges,proofs,limits])for(const [key,value] of map)if((value.expiresAt??value.until)<=now())map.delete(key);};
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw fail(413,'Слишком большой запрос');}try{return JSON.parse(text||'{}');}catch{throw fail(400,'Некорректный запрос');}}
 const consumeProof=(proof,email)=>{const normalized=String(email||'').trim().toLowerCase(),record=proofs.get(String(proof||''));if(!record||record.email!==normalized)throw fail(400,'Подтвердите почту кодом из письма');proofs.delete(String(proof));return normalized;};
 const sign=payload=>createHmac('sha256',sessionSecret).update(payload).digest('base64url');
 const issueSession=accountId=>{const payload=`${accountId}.${now()+30*86400000}.${randomBytes(18).toString('base64url')}`;return `${payload}.${sign(payload)}`;};
 const sessionToken=req=>String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('labrica_session='))?.slice('labrica_session='.length)||'';
 const sessionAccount=req=>{
  const raw=sessionToken(req),split=raw.lastIndexOf('.');if(split<1)return null;const payload=raw.slice(0,split),signature=raw.slice(split+1),parts=payload.split('.');if(parts.length<3||!same(signature,sign(payload)))return null;
  const expires=Number(parts[1]);if(!Number.isFinite(expires)||expires<=now())return null;const account=accounts.get(parts[0]);return account?.status==='active'?account:null;
 };
 const cookieValue=(req,value,maxAge)=>{
  const host=String(req.headers.host||'').split(':')[0].toLowerCase(),secure=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
  const domain=host==='labrica.pro'||host.endsWith('.labrica.pro')?'; Domain=.labrica.pro':'';
  return `labrica_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${domain}${secure?'; Secure':''}`;
 };

 return async function auth(req,res,next=()=>{res.statusCode=404;res.end();}){
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/auth/'))return next();
  const reply=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));};
  try{
   cleanup();
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Запрос запрещён');

   if(path.startsWith('/api/auth/smtp')){
    if(!same(req.headers['x-approval-key']||'',issuerKey))throw fail(401,'Введите ключ управления');
    if(path==='/api/auth/smtp'&&req.method==='GET')return reply(200,view(read()));
    if(path==='/api/auth/smtp'&&req.method==='PUT'){
     const input=await body(req),previous=read(),config={host:String(input.host||'').trim(),port:Number(input.port),secure:input.secure===true,user:String(input.user||'').trim(),password:String(input.password||previous?.password||''),from:String(input.from||'').trim(),fromName:String(input.fromName||'LABRICA').trim()};
     if(!/^[a-zA-Z0-9.-]+$/.test(config.host)||!Number.isInteger(config.port)||config.port<1||config.port>65535||!config.user||!config.password||!emailOK(config.from)||/[\r\n]/.test(config.fromName)||config.fromName.length>100)throw fail(400,'Проверьте сервер, порт, логин, пароль и адрес отправителя');
     save(config);return reply(200,view(config));
    }
    if(path==='/api/auth/smtp/check'&&req.method==='POST'){const config=read();if(!config)throw fail(409,'Сначала сохраните настройки');try{await transport(config).verify();}catch{throw fail(502,'Не удалось подключиться к почтовому серверу. Проверьте настройки.');}return reply(200,{connected:true});}
    throw fail(405,'Метод недоступен');
   }

   if(path==='/api/auth/session'){
    if(req.method==='GET'){
     const account=sessionAccount(req);if(!account)return reply(200,{authenticated:false,account:null});
     const touched=accounts.touch(account.id)||account;return reply(200,{authenticated:true,account:touched});
    }
    if(req.method==='DELETE'){
     const account=sessionAccount(req);if(account)accounts.setOffline(account.id);
     return reply(200,{authenticated:false,account:null},{'Set-Cookie':cookieValue(req,'',0)});
    }
    throw fail(405,'Метод недоступен');
   }

   if(path==='/api/auth/heartbeat'){
    if(req.method!=='POST')throw fail(405,'Метод недоступен');const account=sessionAccount(req);if(!account)throw fail(401,'Сессия истекла. Войдите снова.');return reply(200,{account:accounts.touch(account.id)});
   }

   if(path==='/api/auth/account/profile'){
    if(req.method!=='PATCH')throw fail(405,'Метод недоступен');const account=sessionAccount(req);if(!account)throw fail(401,'Сессия истекла. Войдите снова.');const input=await body(req);return reply(200,{account:accounts.update(account.id,input)});
   }

   if(path==='/api/auth/account/login'){
    if(req.method!=='POST')throw fail(405,'Метод недоступен');const input=await body(req),ip=req.socket.remoteAddress||'local';takeLimit(`login:${ip}`,30,15*60*1000);
    const account=accounts.authenticate(input.email,input.password);return reply(200,{account},{'Set-Cookie':cookieValue(req,issueSession(account.id),30*86400)});
   }

   if(path==='/api/auth/account/register'){
    if(req.method!=='POST')throw fail(405,'Метод недоступен');const input=await body(req),email=consumeProof(input.proof,input.email),names=String(input.name||'').trim().split(/\s+/),surname=names.shift()||'',name=names.shift()||'',patronymic=names.join(' ');
    const account=accounts.create({id:input.legacyId,surname,name,patronymic,phone:input.phone,email,password:input.password});return reply(200,{account},{'Set-Cookie':cookieValue(req,issueSession(account.id),30*86400)});
   }

   if(path==='/api/auth/account/password/reset'){
    if(req.method!=='POST')throw fail(405,'Метод недоступен');const input=await body(req),email=consumeProof(input.proof,input.email),account=accounts.resetPassword(email,input.password);return reply(200,{account});
   }

   if(req.method!=='POST')throw fail(405,'Метод недоступен');
   const input=await body(req),ip=req.socket.remoteAddress||'local';
   if(path==='/api/auth/email/start'){
    const email=String(input.email||'').trim().toLowerCase();if(!emailOK(email))throw fail(400,'Укажите корректную почту');
    const config=read();if(!config?.password)throw fail(503,'Отправка писем ещё не настроена. Попробуйте зарегистрироваться позже.');
    takeLimit(`cooldown:${email}`,1,60000);takeLimit(`email:${email}`,5,3600000);takeLimit(`ip:${ip}`,30,3600000);
    const code=String(randomInt(0,1000000)).padStart(6,'0'),id=randomBytes(24).toString('base64url');
    try{
     const emailContent=verificationEmail(code);
     const receipt=await transport(config).sendMail({from:{name:config.fromName,address:config.from},to:email,subject:emailContent.subject,text:emailContent.text,html:emailContent.html});
     if(!receipt.accepted?.some(address=>String(address).toLowerCase()===email))throw Error('rejected');
    }catch{throw fail(502,'Не удалось отправить письмо. Попробуйте через минуту.');}
    for(const [key,value] of challenges)if(value.email===email)challenges.delete(key);
    challenges.set(id,{email,hash:digest(`${id}:${code}`).toString('hex'),attempts:0,expiresAt:now()+600000});return reply(200,{challengeId:id,expiresIn:600,retryAfter:60});
   }
   if(path==='/api/auth/email/verify'){
    takeLimit(`verify:${ip}`,60,60000);const id=String(input.challengeId||''),challenge=challenges.get(id);if(!challenge||challenge.attempts>=5)throw fail(400,'Код истёк. Запросите новый.');challenge.attempts++;
    if(!/^\d{6}$/.test(String(input.code))||!same(challenge.hash,digest(`${id}:${input.code}`).toString('hex')))throw fail(400,'Неверный код');
    challenges.delete(id);const proof=randomBytes(32).toString('base64url');proofs.set(proof,{email:challenge.email,expiresAt:now()+300000});return reply(200,{proof,email:challenge.email});
   }
   if(path==='/api/auth/email/consume'){consumeProof(input.proof,input.email);return reply(200,{verified:true});}
   throw fail(404,'Не найдено');
  }catch(error){return reply(error.status||500,{error:error.status?error.message:'Не удалось выполнить запрос'});}
 };
}
