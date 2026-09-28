import {useEffect,useState} from 'react';
import {legalUrl} from './service-urls';
import './cookie-banner.css';

type CookieChoice={essential:true;analytics:boolean;savedAt:string};
const STORAGE_KEY='labrica-cookie-consent-v1';

function saveChoice(analytics:boolean){
  const value:CookieChoice={essential:true,analytics,savedAt:new Date().toISOString()};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
  const domain=location.hostname.endsWith('.labrica.pro')?'; Domain=.labrica.pro':'';
  document.cookie=`labrica_cookie_consent=${analytics?'all':'essential'}; Max-Age=31536000; Path=/; SameSite=Lax${domain}${location.protocol==='https:'?'; Secure':''}`;
  window.dispatchEvent(new CustomEvent('labrica-cookie-consent',{detail:value}));
}

export default function CookieBanner(){
  const [visible,setVisible]=useState(false),[settings,setSettings]=useState(false),[analytics,setAnalytics]=useState(false);
  useEffect(()=>{try{const shared=document.cookie.split(';').some(item=>item.trim().startsWith('labrica_cookie_consent='));setVisible(!shared&&!localStorage.getItem(STORAGE_KEY));}catch{setVisible(true);}},[]);
  if(!visible)return null;
  const accept=(allowed:boolean)=>{saveChoice(allowed);setVisible(false);};
  return <aside className="cookie-banner" aria-label="Настройки cookie">
    <div className="cookie-copy"><strong>LABRICA использует cookie</strong><p>Необходимые cookie нужны для работы платформы. С вашего разрешения мы также используем Яндекс Метрику и другие необязательные аналитические технологии для анализа работы LABRICA.</p><a href={legalUrl('/cookies')}>Политика cookie</a></div>
    {settings&&<div className="cookie-settings"><label><span><b>Необходимые</b><small>Работа сайта и авторизация</small></span><input type="checkbox" checked disabled/></label><label><span><b>Аналитические</b><small>Измерение работы LABRICA</small></span><input type="checkbox" checked={analytics} onChange={event=>setAnalytics(event.target.checked)}/></label></div>}
    <div className="cookie-actions">{settings?<button className="cookie-primary" onClick={()=>accept(analytics)}>Сохранить выбор</button>:<button className="cookie-primary" onClick={()=>accept(true)}>Принять все</button>}<button onClick={()=>accept(false)}>Только необходимые</button><button onClick={()=>setSettings(value=>!value)}>{settings?'Скрыть настройки':'Настроить'}</button></div>
  </aside>;
}
