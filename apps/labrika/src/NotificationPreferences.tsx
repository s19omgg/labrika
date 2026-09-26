import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
import {isLabrika,personalKey} from './runtime';
import './notification-preferences.css';
export interface NotificationOptions{system:boolean;milestones:boolean;reminders:boolean;subscription:boolean}
const defaults:NotificationOptions={system:true,milestones:true,reminders:true,subscription:true};
export function getNotificationPreferences():NotificationOptions{try{const saved=JSON.parse(localStorage.getItem(personalKey('notification-preferences'))??'{}');return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved[key]==='boolean'?saved[key]:value])) as unknown as NotificationOptions;}catch{return defaults;}}
export function useNotificationPreferences(){const [preferences,setPreferences]=useState(getNotificationPreferences);useEffect(()=>{const sync=()=>setPreferences(getNotificationPreferences());window.addEventListener('storage',sync);window.addEventListener('notification-preferences-change',sync);window.addEventListener('labrika-account-change',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('notification-preferences-change',sync);window.removeEventListener('labrika-account-change',sync);};},[]);return preferences;}
export function readDismissedNotices():string[]{try{const value=JSON.parse(localStorage.getItem(personalKey('dismissed-notices'))??'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[];}catch{return [];}}
export function saveDismissedNotices(ids:string[]){localStorage.setItem(personalKey('dismissed-notices'),JSON.stringify(ids));window.dispatchEvent(new Event('notification-preferences-change'));}
export default function NotificationPreferences(){
 const preferences=useNotificationPreferences();const [error,setError]=useState('');
 const options:{key:keyof NotificationOptions;label:string}[]=[{key:'system',label:'Важные системные события'},{key:'milestones',label:'Результаты публикаций'},{key:'reminders',label:'План и согласование'},...(isLabrika?[{key:'subscription' as const,label:'Подписка и оплата'}]:[])];
 return <section className="panel notification-preferences"><h2><Bell size={19}/>Уведомления</h2>{options.map(option=><label className="notification-preference-row" key={option.key}><span>{option.label}</span><input type="checkbox" role="switch" checked={preferences[option.key]} onChange={event=>{try{localStorage.setItem(personalKey('notification-preferences'),JSON.stringify({...preferences,[option.key]:event.target.checked}));window.dispatchEvent(new Event('notification-preferences-change'));setError('');}catch{setError('Не удалось сохранить настройки');}}}/><span className="notification-switch" aria-hidden="true"/></label>)}{error&&<div role="alert" className="form-error">{error}</div>}</section>;
}
