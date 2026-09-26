import {getTeamAccess} from './team-data';
import type {Platform} from './model';
import {edition,readWorkspace,saveWorkspace,workspaceKey} from './runtime';
export interface SocialConnection {platform:Platform;accountId:string;accountName:string;accountHandle?:string;connectedAt:string;checkedAt:string;status:'connected'|'error';error?:string;capabilities:{text:boolean;image:boolean;video:boolean;requiresPublicMedia:boolean}}
export interface SocialConfig {token?:string;account?:string;clientId?:string;clientSecret?:string;refreshToken?:string}
export interface SocialSnapshot {title:string;body:string;media?:{kind:'image'|'video';url:string;format?:string}}
export interface SocialPublication {id:string;url?:string;platform:Platform;publishedAt:string;visibility?:string;status?:'published';snapshot?:SocialSnapshot}
export interface ProcessingPublication {platform:Platform;postId:string;status:'processing'|'failed'|'unknown';publishId?:string;error?:string;snapshot?:SocialSnapshot}
export type SocialDelivery=SocialPublication|ProcessingPublication;
export interface TikTokCreator {nickname:string;username:string;privacyLevels:string[];commentDisabled:boolean;duetDisabled:boolean;stitchDisabled:boolean;maxVideoDurationSec:number}
export interface TikTokSettings {privacyLevel:string;allowComment:boolean;allowDuet:boolean;allowStitch:boolean;commercialContent:boolean;brandOrganic:boolean;brandedContent:boolean;isAigc:boolean;consent:boolean;durationSec:number}
export function isPublished(value:SocialDelivery):value is SocialPublication{return value.status===undefined||value.status==='published';}
interface Credentials {workspaceId:string;workspaceKey:string}
const pending=new Map<string,Promise<Credentials>>();
async function decode<T>(response:Response):Promise<T>{let value;try{value=await response.json();}catch{throw new Error('Локальный сервер недоступен. Обновите страницу.');}if(!response.ok)throw Object.assign(new Error(value.error||'Не удалось выполнить запрос'),{code:value.code,status:response.status});return value;}
async function credentials():Promise<Credentials>{const saved=readWorkspace<Credentials|null>('social-server-v1',null);if(saved?.workspaceId&&saved.workspaceKey)return saved;const scope=workspaceKey('social-server-v1');let current=pending.get(scope);if(!current){current=fetch('/api/social/workspaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edition})}).then(decode<Credentials>).then(value=>{localStorage.setItem(scope,JSON.stringify(value));return value;}).finally(()=>pending.delete(scope));pending.set(scope,current);}return current;}
export async function socialRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{if((path.startsWith('/connections')&&method!=='GET'&&!path.endsWith('creator-info'))&&!getTeamAccess().can('manageSocial'))throw new Error('Нет прав на управление подключениями');if(path==='/publish'&&!getTeamAccess().can('schedulePosts'))throw new Error('Нет прав на публикацию');const owner=await credentials();const response=await fetch(`/api/social${path}`,{method,headers:{'Content-Type':'application/json','X-Social-Workspace':owner.workspaceId,'X-Social-Key':owner.workspaceKey},...(body===undefined?{}:{body:JSON.stringify(body)})});return decode<T>(response);}
export async function listConnections(){return(await socialRequest<{connections:SocialConnection[]}>('/connections')).connections;}
export function connectionsChanged(){window.dispatchEvent(new Event('social-connections-change'));}
export function saveConnection(platform:Platform,config:SocialConfig){return socialRequest<{connection:SocialConnection}>('/connections','POST',{platform,config});}
export function checkConnection(platform:Platform){return socialRequest<{connection:SocialConnection}>(`/connections/${platform}/check`,'POST',{});}
export function deleteConnection(platform:Platform){return socialRequest(`/connections/${platform}`,'DELETE');}
export async function publishSocial(input:{postId:string;platform:Platform;title:string;body:string;media?:{kind:'image'|'video';url:string;format?:string};visibility?:string;tiktok?:TikTokSettings}){const key=`social-request-${input.postId}-${input.platform}`;let requestId=readWorkspace<string|null>(key,null);if(!requestId){requestId=crypto.randomUUID();saveWorkspace(key,requestId);}return(await socialRequest<{publication:SocialDelivery}>('/publish','POST',{...input,requestId})).publication;}
