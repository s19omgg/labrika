import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const emailOK=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value);
const emptyDatabase=()=>({version:1,accounts:[],logs:[]});
const publicAccount=account=>({
 id:account.id,
 name:account.name,
 ...(account.surname?{surname:account.surname}:{}),
 ...(account.patronymic?{patronymic:account.patronymic}:{}),
 ...(account.phone?{phone:account.phone}:{}),
 ...(account.ownerId?{ownerId:account.ownerId}:{}),
 ...(account.emailVerifiedAt?{emailVerifiedAt:account.emailVerifiedAt}:{}),
 email:account.email,
 status:account.status,
 createdAt:account.createdAt,
 lastSeenAt:account.lastSeenAt??null,
 subscription:account.subscription??null,
});

export function createAccountStore({directory='.data',now=()=>Date.now()}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const file=join(directory,'accounts.json');
 const read=()=>{
  if(!existsSync(file))return emptyDatabase();
  try{
   const value=JSON.parse(readFileSync(file,'utf8'));
   if(value?.version!==1||!Array.isArray(value.accounts))return emptyDatabase();
   return {...emptyDatabase(),...value,logs:Array.isArray(value.logs)?value.logs:[]};
  }catch{return emptyDatabase();}
 };
 const save=database=>{
  const temp=file+'.tmp';
  writeFileSync(temp,JSON.stringify(database,null,2),{mode:0o600});
  renameSync(temp,file);
 };
 const log=(database,action,detail,accountId)=>{
  database.logs.unshift({id:randomUUID(),createdAt:new Date(now()).toISOString(),action,detail,...(accountId?{accountId}:{})});
  database.logs=database.logs.slice(0,500);
 };
 const find=(database,id)=>{
  const account=database.accounts.find(item=>item.id===id);
  if(!account)throw fail(404,'Пользователь не найден.');
  return account;
 };
 const passwordRecord=password=>{
  if(typeof password!=='string'||password.length<8)throw fail(400,'Пароль должен содержать минимум 8 символов.');
  const salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,32).toString('hex');
  return{passwordSalt:salt,passwordHash:hash};
 };
 const passwordMatches=(password,account)=>{
  if(!account?.passwordSalt||!account?.passwordHash)return false;
  const actual=scryptSync(String(password),account.passwordSalt,32);
  const expected=Buffer.from(account.passwordHash,'hex');
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
 };

 return{
  create(input){
   const database=read(),email=String(input.email||'').trim().toLowerCase();
   if(!emailOK(email))throw fail(400,'Укажите корректную почту.');
   if(database.accounts.some(account=>account.email===email))throw fail(409,'Аккаунт с этой почтой уже зарегистрирован.');
   const timestamp=new Date(now()).toISOString();
   const requestedId=typeof input.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)?input.id:null;
   if(requestedId&&database.accounts.some(account=>account.id===requestedId))throw fail(409,'Идентификатор аккаунта уже используется.');
   const account={
    id:requestedId||randomUUID(),
    name:String(input.name||'').trim(),
    surname:String(input.surname||'').trim(),
    patronymic:String(input.patronymic||'').trim(),
    phone:String(input.phone||'').trim(),
    ...(input.ownerId?{ownerId:String(input.ownerId)}:{}),
    email,
    status:'active',
    createdAt:timestamp,
    emailVerifiedAt:timestamp,
    lastSeenAt:timestamp,
    subscription:null,
    ...passwordRecord(input.password),
   };
   if(!account.name||!account.surname)throw fail(400,'Укажите фамилию и имя.');
   if(account.phone.replace(/\D/g,'').length<7)throw fail(400,'Укажите номер телефона.');
   database.accounts.push(account);log(database,'Регистрация',email,account.id);save(database);return publicAccount(account);
  },
  authenticate(email,password){
   const database=read(),normalized=String(email||'').trim().toLowerCase(),account=database.accounts.find(item=>item.email===normalized);
   if(!account||!passwordMatches(password,account))throw fail(401,'Проверьте электронную почту и пароль.');
   if(account.status==='blocked')throw fail(403,'Аккаунт заблокирован. Обратитесь к администратору.');
   account.lastSeenAt=new Date(now()).toISOString();log(database,'Вход в аккаунт',account.email,account.id);save(database);return publicAccount(account);
  },
  resetPassword(email,password){
   const database=read(),normalized=String(email||'').trim().toLowerCase(),account=database.accounts.find(item=>item.email===normalized);
   if(!account)throw fail(404,'Аккаунт с этой почтой не найден.');
   Object.assign(account,passwordRecord(password));log(database,'Пароль изменён',normalized,account.id);save(database);return publicAccount(account);
  },
  get(id){const account=read().accounts.find(item=>item.id===id);return account?publicAccount(account):null;},
  getByEmail(email){const normalized=String(email||'').trim().toLowerCase(),account=read().accounts.find(item=>item.email===normalized);return account?publicAccount(account):null;},
  touch(id){const database=read(),account=database.accounts.find(item=>item.id===id);if(!account||account.status!=='active')return null;account.lastSeenAt=new Date(now()).toISOString();save(database);return publicAccount(account);},
  setOffline(id){const database=read(),account=database.accounts.find(item=>item.id===id);if(!account)return;account.lastSeenAt=null;log(database,'Выход из аккаунта',account.email,account.id);save(database);},
  list(){return read().accounts.map(publicAccount);},
  snapshot(){const database=read();return{accounts:database.accounts.map(publicAccount),logs:database.logs};},
  update(id,input){
   const database=read(),account=find(database,id),name=String(input.name??account.name).trim(),email=String(input.email??account.email).trim().toLowerCase();
   if(name.length<2||!emailOK(email))throw fail(400,'Проверьте имя и электронную почту.');
   if(database.accounts.some(item=>item.id!==id&&item.email===email))throw fail(409,'Эта почта уже используется.');
   account.name=name;account.email=email;log(database,'Данные пользователя обновлены',email,account.id);save(database);return publicAccount(account);
  },
  setStatus(id,status){
   if(!['active','blocked'].includes(status))throw fail(400,'Некорректный статус.');
   const database=read(),account=find(database,id);account.status=status;if(status==='blocked')account.lastSeenAt=null;log(database,status==='blocked'?'Аккаунт заблокирован':'Аккаунт разблокирован',account.email,account.id);save(database);return publicAccount(account);
  },
  grantSubscription(id,planId,days=30){
   if(!['min','business','pro','custom'].includes(planId))throw fail(400,'Выберите тариф.');
   if(!Number.isFinite(days)||days<1||days>3650)throw fail(400,'Укажите срок от 1 до 3650 дней.');
   const database=read(),account=find(database,id),start=new Date(now()),rounded=Math.round(days);
   account.subscription={planId,startsAt:start.toISOString(),expiresAt:new Date(start.getTime()+rounded*86400000).toISOString(),source:'manual',autoRenew:false};
   log(database,'Выдана подписка',`${account.email} · ${planId.toUpperCase()} · ${rounded} дней · без оплаты`,account.id);save(database);return publicAccount(account);
  },
  revokeSubscription(id){const database=read(),account=find(database,id);account.subscription=null;log(database,'Подписка отозвана',account.email,account.id);save(database);return publicAccount(account);},
  extendSubscription(id,days){
   if(!Number.isFinite(days)||days<1||days>3650)throw fail(400,'Укажите срок от 1 до 3650 дней.');
   const database=read(),account=find(database,id);if(!account.subscription)throw fail(409,'Сначала выдайте подписку.');const rounded=Math.round(days);
   account.subscription.expiresAt=new Date(Math.max(now(),new Date(account.subscription.expiresAt).getTime())+rounded*86400000).toISOString();
   log(database,'Подписка продлена',`${account.email} · +${rounded} дней · без оплаты`,account.id);save(database);return publicAccount(account);
  },
 };
}
