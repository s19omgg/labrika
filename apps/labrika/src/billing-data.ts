import {authRequest} from './auth-api';
import {acceptTeamInvitation,lookupInvitation,getTeamMembers} from './team-data';
import {workspaceKey} from './runtime';
import { useEffect, useState } from 'react';

export type PlanId = 'min' | 'business' | 'pro' | 'custom';
export type UsageKind = 'posts' | 'images' | 'videoSeconds';
export interface PlanLimits { brands: number | null; profiles: number | null; posts: number | null; images: number | null; videoSeconds: number | null; seats: number | null; }
export interface SubscriptionPlan {id: PlanId; name: string; price: number; description: string; limits: PlanLimits; features: string[]; highlighted?: boolean;}
const defaultPlans: SubscriptionPlan[] = [
  {id:'min',name:'MIN',price:4990,description:'Для уверенного начала',limits:{brands:1,profiles:5,posts:15,images:30,videoSeconds:40,seats:1},features:['Редактор текстов и календарь','Согласование публикаций','Базовая аналитика']},
  {id:'business',name:'BUSINESS',price:9990,description:'Для регулярного контента',highlighted:true,limits:{brands:1,profiles:10,posts:120,images:100,videoSeconds:200,seats:3},features:['Автоматический контент-план и идеи','Тон компании и автопостинг','Расширенная аналитика']},
  {id:'pro',name:'PRO',price:19990,description:'Для команды, которая растёт',limits:{brands:3,profiles:25,posts:300,images:500,videoSeconds:500,seats:10},features:['Стиль и правила для каждого бренда','A/B-тесты и расширенный студия','Адаптация контента и анализ воронки','Приоритетная генерация контента']},
  {id:'custom',name:'CUSTOM',price:39990,description:'Под ваши процессы',limits:{brands:null,profiles:null,posts:null,images:null,videoSeconds:null,seats:null},features:['Индивидуальные лимиты','Отдельные рабочие пространства','CRM, API и собственные роли','Процессы согласования под команду','White label и инфраструктура']},
];

export interface AccountSubscription {planId:PlanId;startsAt:string;expiresAt:string;source:'manual'|'paid';autoRenew:false;}
export interface BillingAccount {id:string;name:string;surname?:string;patronymic?:string;phone?:string;ownerId?:string;emailVerifiedAt?:string;email:string;status:'active'|'blocked';createdAt:string;lastSeenAt:string|null;subscription:AccountSubscription|null;}
interface StoredAccount extends BillingAccount {passwordHash:string;passwordSalt:string;}
export interface BillingPayment {id:string;accountId:string;planId:PlanId;amount:number;currency:'RUB';status:'paid'|'refunded';createdAt:string;reference:string;}
export interface CheckoutSimulation {id:string;accountId:string|null;planId:PlanId;amount:number;status:'simulation';createdAt:string;}
export interface BillingLog {id:string;createdAt:string;action:string;detail:string;accountId?:string;}
export interface UsageRecord {accountId:string;period:string;posts:number;images:number;videoSeconds:number;}
export interface BillingConfig {provider:'none'|'yookassa'|'cloudpayments';merchantId:string;legalName:string;supportEmail:string;currency:'RUB';}
interface BillingDatabase {version:1;accounts:StoredAccount[];payments:BillingPayment[];checkouts:CheckoutSimulation[];logs:BillingLog[];usage:UsageRecord[];config:BillingConfig;catalog?:SubscriptionPlan[];}
export interface BillingSnapshot {accounts:BillingAccount[];payments:BillingPayment[];checkouts:CheckoutSimulation[];logs:BillingLog[];usage:UsageRecord[];config:BillingConfig;catalog?:SubscriptionPlan[];}
const DATABASE_KEY='labrika-billing-v1';const SESSION_KEY='labrika-current-account';const CHANGE_EVENT='labrika-account-change';
const emptyDatabase=():BillingDatabase=>({version:1,accounts:[],payments:[],checkouts:[],logs:[],usage:[],config:{provider:'none',merchantId:'',legalName:'',supportEmail:'',currency:'RUB'}});
function readDatabase():BillingDatabase {try{const raw=localStorage.getItem(DATABASE_KEY);if(!raw)return emptyDatabase();const value=JSON.parse(raw);if(value?.version!==1||!Array.isArray(value.accounts))return emptyDatabase();return {...emptyDatabase(),...value};}catch{return emptyDatabase();}}
function writeDatabase(value:BillingDatabase) {try{localStorage.setItem(DATABASE_KEY,JSON.stringify(value));}catch{throw new Error('Недостаточно памяти браузера для сохранения.');}window.dispatchEvent(new Event(CHANGE_EVENT));}
function publicAccount(account:StoredAccount):BillingAccount {const {id,name,surname,patronymic,phone,ownerId,emailVerifiedAt,email,status,createdAt,lastSeenAt,subscription}=account;return{id,name,surname,patronymic,phone,ownerId,emailVerifiedAt,email,status,createdAt,lastSeenAt,subscription};}
function appendLog(database:BillingDatabase,action:string,detail:string,accountId?:string) {database.logs.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),action,detail,accountId});database.logs=database.logs.slice(0,300);}
function findAccount(database:BillingDatabase,id:string) {const account=database.accounts.find(item=>item.id===id);if(!account)throw new Error('Пользователь не найден.');return account;}
export function getBillingSnapshot():BillingSnapshot {const database=readDatabase();return{...database,accounts:database.accounts.map(publicAccount)};}
export function getAccounts():BillingAccount[] {return getBillingSnapshot().accounts;}
export function getCurrentAccount():BillingAccount|null {try{const id=sessionStorage.getItem(SESSION_KEY);const account=id?readDatabase().accounts.find(item=>item.id===id):null;return account?publicAccount(account):null;}catch{return null;}}
export function useBillingData():BillingSnapshot {const [,refresh]=useState(0);useEffect(()=>{const update=()=>refresh(value=>value+1);const storage=(event:StorageEvent)=>{if(event.key===DATABASE_KEY)update();};window.addEventListener(CHANGE_EVENT,update);window.addEventListener('storage',storage);const timer=setInterval(update,15000);return()=>{window.removeEventListener(CHANGE_EVENT,update);window.removeEventListener('storage',storage);clearInterval(timer);};},[]);return getBillingSnapshot();}
export function useBillingAccount():BillingAccount|null {useBillingData();const account=getCurrentAccount();useEffect(()=>{if(!account?.id)return;const beat=()=>{if(document.visibilityState==='visible')heartbeatAccount(account.id);};beat();const interval=setInterval(beat,20000);document.addEventListener('visibilitychange',beat);return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',beat);};},[account?.id]);return account;}
function asHex(bytes:ArrayBuffer|Uint8Array) {return Array.from(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');}
async function hashPassword(password:string,salt:string) {if(!crypto.subtle)throw new Error('Вход доступен через HTTPS или localhost.');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return asHex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:new TextEncoder().encode(salt)},key,256));}
function validEmail(value:string) {return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
export async function registerAccount(input:{name:string;email:string;phone:string;password:string;proof:string;invite?:string}):Promise<BillingAccount> {
 const names=input.name.trim().split(/\s+/),surname=names.shift()||'',name=names.shift()||'',patronymic=names.join(' '),email=input.email.trim().toLowerCase();
 if(!name||!surname)throw new Error('Укажите фамилию и имя.');if(!validEmail(email))throw new Error('Укажите корректную почту.');if(input.phone.replace(/\D/g,'').length<7)throw new Error('Укажите номер телефона.');if(input.password.length<8)throw new Error('Пароль должен содержать минимум 8 символов.');
 const database=readDatabase();if(database.accounts.some(account=>account.email===email))throw new Error('Аккаунт с этой почтой уже зарегистрирован.');
 const invitation=input.invite?lookupInvitation(input.invite):null;if(input.invite&&(!invitation||invitation.member.email!==email))throw new Error('Приглашение недействительно или почта не совпадает.');
 const salt=asHex(crypto.getRandomValues(new Uint8Array(16))),passwordHash=await hashPassword(input.password,salt);
 await authRequest('consume',{proof:input.proof,email});
 const account:StoredAccount={id:crypto.randomUUID(),name,surname,patronymic,phone:input.phone.trim(),email,status:'active',createdAt:new Date().toISOString(),emailVerifiedAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),subscription:null,passwordHash,passwordSalt:salt,...(invitation?{ownerId:invitation.ownerId,name:invitation.member.name,surname:invitation.member.surname,phone:invitation.member.phone}: {})};
 database.accounts.push(account);appendLog(database,'Регистрация',email,account.id);writeDatabase(database);
 if(input.invite)acceptTeamInvitation(input.invite,email,account.id);
 sessionStorage.setItem(SESSION_KEY,account.id);
 if(!invitation)localStorage.setItem(workspaceKey('team-v1'),JSON.stringify(getTeamMembers()));
 window.dispatchEvent(new Event(CHANGE_EVENT));return publicAccount(account);
}
export async function loginAccount(email:string,password:string):Promise<BillingAccount> {const database=readDatabase();const account=database.accounts.find(item=>item.email===email.trim().toLowerCase());if(!account||await hashPassword(password,account.passwordSalt)!==account.passwordHash)throw new Error('Проверьте электронную почту и пароль.');if(account.status==='blocked')throw new Error('Аккаунт заблокирован. Обратитесь к администратору.');account.lastSeenAt=new Date().toISOString();appendLog(database,'Вход в аккаунт',account.email,account.id);writeDatabase(database);sessionStorage.setItem(SESSION_KEY,account.id);window.dispatchEvent(new Event(CHANGE_EVENT));return publicAccount(account);}
export function logoutAccount() {const account=getCurrentAccount();if(account){const database=readDatabase();findAccount(database,account.id).lastSeenAt=null;appendLog(database,'Выход из аккаунта',account.email,account.id);writeDatabase(database);}sessionStorage.removeItem(SESSION_KEY);window.dispatchEvent(new Event(CHANGE_EVENT));}
export function heartbeatAccount(accountId:string) {const database=readDatabase();const account=database.accounts.find(item=>item.id===accountId);if(!account||account.status==='blocked')return;account.lastSeenAt=new Date().toISOString();try{writeDatabase(database);}catch{/* A heartbeat should not interrupt work. */}}
export function isAccountOnline(account:BillingAccount,now=Date.now()) {return account.status==='active'&&Boolean(account.lastSeenAt)&&now-new Date(account.lastSeenAt!).getTime()<65000;}
export function subscriptionState(account:BillingAccount|null):'none'|'active'|'expired'|'blocked' {if(!account)return'none';if(account.status==='blocked')return'blocked';if(!account.subscription)return'none';return new Date(account.subscription.expiresAt).getTime()>Date.now()?'active':'expired';}
export function getPlan(id:PlanId|string|undefined) {return getSubscriptionPlans().find(plan=>plan.id===id);}
export function grantSubscription(accountId:string,planId:PlanId,days=30) {if(!getPlan(planId))throw new Error('Выберите тариф.');if(!Number.isFinite(days)||days<1||days>3650)throw new Error('Укажите срок от 1 до 3650 дней.');const database=readDatabase();const account=findAccount(database,accountId);const now=new Date();account.subscription={planId,startsAt:now.toISOString(),expiresAt:new Date(now.getTime()+Math.round(days)*86400000).toISOString(),source:'manual',autoRenew:false};appendLog(database,'Выдана подписка',`${account.email} · ${getPlan(planId)!.name} · ${Math.round(days)} дней · без оплаты`,account.id);writeDatabase(database);}
export function revokeSubscription(accountId:string) {const database=readDatabase();const account=findAccount(database,accountId);account.subscription=null;appendLog(database,'Подписка отозвана',account.email,account.id);writeDatabase(database);}
export function extendSubscription(accountId:string,days:number) {if(!Number.isFinite(days)||days<1||days>3650)throw new Error('Укажите срок от 1 до 3650 дней.');const database=readDatabase();const account=findAccount(database,accountId);if(!account.subscription)throw new Error('Сначала выдайте подписку.');account.subscription.expiresAt=new Date(Math.max(Date.now(),new Date(account.subscription.expiresAt).getTime())+Math.round(days)*86400000).toISOString();appendLog(database,'Подписка продлена',`${account.email} · +${Math.round(days)} дней · без оплаты`,account.id);writeDatabase(database);}
export function setAccountStatus(accountId:string,status:'active'|'blocked') {const database=readDatabase();const account=findAccount(database,accountId);account.status=status;if(status==='blocked')account.lastSeenAt=null;appendLog(database,status==='blocked'?'Аккаунт заблокирован':'Аккаунт разблокирован',account.email,account.id);writeDatabase(database);}
export function updateAccount(accountId:string,input:{name:string;email:string}) {const name=input.name.trim();const email=input.email.trim().toLowerCase();if(name.length<2||!validEmail(email))throw new Error('Проверьте имя и электронную почту.');const database=readDatabase();if(database.accounts.some(account=>account.id!==accountId&&account.email===email))throw new Error('Эта почта уже используется.');const account=findAccount(database,accountId);account.name=name;account.email=email;const key=`labrika-workspace-${account.ownerId||account.id}-team-v1`;try{const members=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(members))localStorage.setItem(key,JSON.stringify(members.map(member=>member.accountId===account.id||member.id===account.id?{...member,name,email}:member)));}catch{}appendLog(database,'Данные пользователя обновлены',email,account.id);writeDatabase(database);window.dispatchEvent(new Event('team-change'));}
export function simulateCheckout(planId:PlanId):CheckoutSimulation {const plan=getPlan(planId);if(!plan)throw new Error('Тариф не найден.');const database=readDatabase();const account=getCurrentAccount();const checkout:CheckoutSimulation={id:crypto.randomUUID(),accountId:account?.id??null,planId,amount:plan.price,status:'simulation',createdAt:new Date().toISOString()};database.checkouts.unshift(checkout);database.checkouts=database.checkouts.slice(0,100);appendLog(database,'Просмотр сценария оплаты',`${plan.name} · ${plan.price} ₽ · без списания`,account?.id);writeDatabase(database);return checkout;}
export function saveBillingConfig(config:BillingConfig) {if(config.supportEmail&&!validEmail(config.supportEmail))throw new Error('Проверьте почту поддержки.');const database=readDatabase();database.config={...config,currency:'RUB'};appendLog(database,'Настройки оплаты обновлены',`${config.provider} · обработка платежей не подключена`);writeDatabase(database);}
export function currentUsage(accountId?:string|null):UsageRecord {const id=accountId??getWorkspaceAccount()?.id??'';const period=new Date().toISOString().slice(0,7);return readDatabase().usage.find(item=>item.accountId===id&&item.period===period)??{accountId:id,period,posts:0,images:0,videoSeconds:0};}
export function recordUsage(kind:UsageKind,amount=1,accountId?:string) {const id=accountId??getWorkspaceAccount()?.id;if(!id||!Number.isFinite(amount)||amount<=0)return;const database=readDatabase();const period=new Date().toISOString().slice(0,7);let usage=database.usage.find(item=>item.accountId===id&&item.period===period);if(!usage){usage={accountId:id,period,posts:0,images:0,videoSeconds:0};database.usage.push(usage);}usage[kind]+=Math.ceil(amount);writeDatabase(database);}
export function getPaidRevenue(payments:BillingPayment[]) {return payments.filter(payment=>payment.status==='paid').reduce((sum,payment)=>sum+payment.amount,0);}
export const money=(value:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(value);
export const billingDate=(value:string)=>new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});

export function getSubscriptionPlans():SubscriptionPlan[] {const stored=readDatabase().catalog;return defaultPlans.map(base=>{const saved=stored?.find(plan=>plan.id===base.id);return saved?{...base,...saved,limits:{...base.limits,...saved.limits}}:{...base,limits:{...base.limits},features:[...base.features]};});}
export function useSubscriptionPlans(){useBillingData();return getSubscriptionPlans();}
export function saveSubscriptionPlan(input:SubscriptionPlan){
 if(!defaultPlans.some(plan=>plan.id===input.id))throw new Error('Тариф не найден');
 const name=input.name.trim(),description=input.description.trim(),features=input.features.map(feature=>feature.trim()).filter(Boolean);
 if(!name||name.length>40||!description||description.length>1000)throw new Error('Укажите название до 40 символов и описание до 1000 символов');
 if(!Number.isSafeInteger(input.price)||input.price<0||input.price>100000000)throw new Error('Цена — целое число от 0 до 100 000 000 ₽');
 if(features.length>30||features.some(feature=>feature.length>300))throw new Error('До 30 возможностей, каждая — до 300 символов');
 for(const value of Object.values(input.limits))if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>100000000))throw new Error('Лимиты должны быть целыми неотрицательными числами');
 const database=readDatabase();database.catalog=getSubscriptionPlans().map(plan=>plan.id===input.id?{...input,name,description,features,limits:{...input.limits}}:input.highlighted?{...plan,highlighted:false}:plan);
 appendLog(database,'Тариф обновлён',`${name} · ${input.price} ₽ / месяц`);writeDatabase(database);
}

export function getWorkspaceAccount(){const current=getCurrentAccount();return current?.ownerId?getAccounts().find(a=>a.id===current.ownerId)||current:current;}
export function useWorkspaceBillingAccount(){useBillingData();return getWorkspaceAccount();}

/** Explicitly requested local administrator. Existing accounts and passwords are never reset. */
export function ensureLocalAdministrator(){
 const database=readDatabase();if(database.accounts.some(account=>account.email==='admin@labrica.com'||account.id==='labrica-local-admin'))return;
 const createdAt=new Date().toISOString();
 database.accounts.push({id:'labrica-local-admin',name:'Администратор',surname:'LABRICA',phone:'',email:'admin@labrica.com',status:'active',createdAt,lastSeenAt:null,subscription:null,passwordSalt:'labrica-local-owner-2026',passwordHash:'4019463d67b7a2401e920b5485d687af3bd198ecca9bba89b48d43c8250bbb20'});
 appendLog(database,'Создан локальный администратор','admin@labrica.com','labrica-local-admin');writeDatabase(database);
}
