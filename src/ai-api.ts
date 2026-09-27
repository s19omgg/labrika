import {edition} from './runtime';
export type AITask='text'|'ideas'|'chat'|'plan'|'repurpose'|'analysis'|'adapt'|'campaign';
export interface AIRequest {task:AITask;prompt:string;context?:unknown;messages?:{role:'user'|'assistant';content:string}[];format?:'json'}
export interface AIResponse<T=unknown>{text:string;data?:T}
export interface AICapabilities{text:boolean;image:boolean;video:boolean}
export const aiHeaders=()=>({'Content-Type':'application/json','X-Product-Edition':edition});
export async function requestAI<T=unknown>(input:AIRequest,signal?:AbortSignal):Promise<AIResponse<T>>{
 const response=await fetch('/api/ai/generate',{method:'POST',headers:aiHeaders(),body:JSON.stringify(input),signal});
 let data;try{data=await response.json();}catch{throw new Error('Генерация недоступна. Проверьте соединение и повторите.');}
 if(!response.ok)throw new Error(data.error||'Не удалось получить ответ. Попробуйте позже.');return data;
}
export const generateAI=requestAI;
export async function aiCapabilities():Promise<AICapabilities>{const response=await fetch('/api/ai/capabilities',{headers:aiHeaders()});if(!response.ok)throw new Error('Не удалось проверить доступность генерации');return response.json();}
