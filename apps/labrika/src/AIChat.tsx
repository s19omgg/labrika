import {useEffect,useRef,useState} from 'react';
import {ArrowUp,LoaderCircle,Sparkles,X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {requestAI} from './ai-api';
import {getBrain} from './brain-data';
import {useWorkspace} from './store';
import {productName} from './runtime';
import './ai-chat.css';
type Message={role:'user'|'assistant';content:string};
const suggestions=['Предложи идеи для постов','Что улучшить в контенте?','Что ты знаешь о компании?'];
export default function AIChat({onClose}:{onClose:()=>void}){
 const {brand,posts}=useWorkspace(),[messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const scroll=useRef<HTMLDivElement>(null),field=useRef<HTMLTextAreaElement>(null),request=useRef<AbortController|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;field.current?.focus();return()=>{alive.current=false;request.current?.abort();};},[]);
 useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});},[messages,busy]);
 async function send(value=input){if(!value.trim()||busy)return;const next:Message[]=[...messages,{role:'user',content:value.trim()}];setMessages(next);setInput('');setError('');setBusy(true);request.current=new AbortController();try{const result=await requestAI({task:'chat',prompt:value.trim(),messages:messages.slice(-16),context:{brand,brain:getBrain(),posts:posts.slice(0,30).map(p=>({title:p.title,body:p.body,status:p.status,platforms:p.platforms,views:p.views,clicks:p.clicks}))}},request.current.signal);if(alive.current)setMessages([...next,{role:'assistant',content:result.text}]);}catch(err){if(alive.current){setError((err as Error).message);setInput(value);setMessages(messages);}}finally{if(alive.current)setBusy(false);}}
 return createPortal(<section className="design-v2 ai-chat" role="dialog" aria-label={`${productName} AI`} onKeyDown={e=>{if(e.key==='Escape')onClose();}}><header><span><Sparkles size={18}/><strong>{productName} AI</strong></span><button className="icon-button" aria-label="Закрыть чат" onClick={onClose}><X size={18}/></button></header><div className="ai-chat-history" ref={scroll} role="log" aria-live="polite">{!messages.length&&<div className="ai-chat-empty"><Sparkles size={30}/><h3>Над чем поработаем?</h3></div>}{messages.map((message,i)=><div key={i} className={`ai-chat-message ${message.role}`}>{message.content}</div>)}{busy&&<div className="ai-chat-thinking"><LoaderCircle className="spin" size={17}/>Готовлю ответ</div>}</div><div className="ai-chat-composer">{error&&<p role="alert">{error}</p>}<div className="ai-chat-suggestions">{suggestions.map(suggestion=><button key={suggestion} disabled={busy} onClick={()=>send(suggestion)}>{suggestion}</button>)}</div><form onSubmit={e=>{e.preventDefault();send();}}><textarea ref={field} rows={2} maxLength={6000} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}} placeholder="Спросите о вашем контенте" aria-label="Сообщение AI"/><button disabled={busy||!input.trim()} type="submit" aria-label="Отправить сообщение">{busy?<LoaderCircle size={18} className="spin"/>:<ArrowUp size={20}/>}</button></form></div></section>,document.body);
}
