import type { Post } from './model';
import { workspaceKey } from './runtime';
export interface AuditEntry {id:string;date:string;action:string;detail:string;actor:string}
export interface Member {id:string;name:string;email:string;role:'owner'|'editor'|'analyst';active:boolean}
export interface Source {id:string;name:string;url:string;kind:'site'|'rss'|'channel';active:boolean}
export interface EditorialPolicy {requireApproval:boolean;requireMedia:boolean;maxPerDay:number;defaultTime:string}
export const defaultPolicy:EditorialPolicy={requireApproval:false,requireMedia:false,maxPerDay:10,defaultTime:'12:00'};
export function readStored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(workspaceKey(key))??'null')??fallback;}catch{return fallback;}}
export function writeStored(key:string,value:unknown){localStorage.setItem(workspaceKey(key),JSON.stringify(value));}
export function getPolicy(){return {...defaultPolicy,...readStored<Partial<EditorialPolicy>>('ygroup-policy-v1',{})};}
export function audit(action:string,detail:string){const rows=readStored<AuditEntry[]>('ygroup-audit-v1',[]);const actor=readStored('ygroup-profile-v1',{name:'Александр'}).name;try{writeStored('ygroup-audit-v1',[{id:crypto.randomUUID(),date:new Date().toISOString(),action,detail,actor},...rows].slice(0,400));window.dispatchEvent(new Event('ygroup-audit'));}catch{/* Content is preserved when the journal reaches browser capacity. */}}
export function validatePosts(input:unknown):input is Post[]{
 if(!Array.isArray(input)||input.length>10000)return false;const ids=new Set();
 return input.every(post=>{if(!post||typeof post!=='object')return false;const p=post as Record<string,unknown>;const keys=['id','title','body','format','topic','date','time','author','cover'];if(keys.some(key=>typeof p[key]!=='string')||ids.has(p.id))return false;ids.add(p.id);if(!['draft','approved','scheduled','published'].includes(p.status as string))return false;if(!Array.isArray(p.platforms)||!p.platforms.length||p.platforms.some(v=>!['telegram','instagram','vk','youtube','threads','dzen','max','tiktok'].includes(v)))return false;if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date as string)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time as string)||!Number.isFinite(new Date(`${p.date}T${p.time}:00+03:00`).getTime()))return false;if(['views','clicks','registrations','reactions','comments','shares'].some(key=>typeof p[key]!=='number'||!Number.isFinite(p[key])||(p[key] as number)<0))return false;if (p.platformBodies && (typeof p.platformBodies!=='object'||Object.entries(p.platformBodies).some(([key,value])=>!['telegram','instagram','vk','youtube','threads','dzen','max','tiktok'].includes(key)||typeof value!=='string')))return false;
 if(p.videoScript){const script=p.videoScript as Record<string,unknown>;if(typeof script.title!=='string'||typeof script.caption!=='string'||!Array.isArray(script.scenes)||script.scenes.length>5||script.scenes.some((scene:Record<string,unknown>)=>!scene||typeof scene.heading!=='string'||typeof scene.text!=='string'||typeof scene.duration!=='number'||!Number.isFinite(scene.duration)||scene.duration<=0||scene.duration>60))return false;}
 if(p.media){const m=p.media as Record<string,unknown>;if(!['image','video'].includes(m.kind as string)||typeof m.url!=='string'||!/^data:(image\/|video\/)/.test(m.url)||typeof m.format!=='string')return false;}return true;});
}
