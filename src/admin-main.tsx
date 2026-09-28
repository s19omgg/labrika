import React,{useEffect,useState} from 'react';
import ReactDOM from 'react-dom/client';
import {ArrowRight,Eye,EyeOff} from 'lucide-react';
import LabricaBrand from './LabricaBrand';
import LabrikaAdmin from './LabrikaAdmin';
import CookieBanner from './CookieBanner';
import {serviceUrl} from './service-urls';
import './product-styles';
import './labrika-admin.css';

function AdminRoot(){
 const [status,setStatus]=useState<'checking'|'signed-out'|'signed-in'>('checking'),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/admin/session',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(result=>{if(active)setStatus(result.authenticated?'signed-in':'signed-out');}).catch(()=>{if(active){setError('Не удалось проверить сессию. Обновите страницу.');setStatus('signed-out');}});return()=>{active=false;};},[]);
 if(status==='signed-in')return <LabrikaAdmin/>;
 return <><main className="design-v2 labrika-entry entry-v6 admin-login"><section className="labrika-entry-story"><a className="labrika-entry-brand" href={serviceUrl('landing','/')}><LabricaBrand light/></a><h1>Управление<br/>платформой<br/><em>LABRICA.</em></h1></section><section className="labrika-entry-form"><div className="entry-auth-heading"><p className="admin-login-label">ADMIN</p><h2>{status==='checking'?'Проверяем сессию':'Вход в панель управления'}</h2></div>{status==='signed-out'&&<form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/admin/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,password})}),result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'Не удалось войти');setStatus('signed-in');}catch(reason){setError(reason instanceof Error?reason.message:'Не удалось войти');}finally{setBusy(false);}}}><label className="field">Логин<input required autoComplete="username" type="text" value={login} onChange={event=>setLogin(event.target.value)} placeholder="sergiolabenzo" spellCheck={false}/></label><label className="field">Пароль<div className="entry-password"><input required autoComplete="current-password" type={visible?'text':'password'} value={password} onChange={event=>setPassword(event.target.value)}/><button type="button" aria-label={visible?'Скрыть пароль':'Показать пароль'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<p className="entry-auth-error" role="alert">{error}</p>}<button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Проверяем…':'Войти'}<ArrowRight size={17}/></button></form>}</section></main><CookieBanner/></>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AdminRoot/></React.StrictMode>);
