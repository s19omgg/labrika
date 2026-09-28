import {authRequest} from './auth-api';
import {fullMemberName,lookupInvitation} from './team-data';
import LabricaBrand from './LabricaBrand';
import {useEffect,useState} from 'react';
import {ArrowRight,Check,Eye,EyeOff,Layers3,LoaderCircle} from 'lucide-react';
import {loginAccount,registerAccount,resetAccountPassword,type BillingAccount} from './billing-data';
import {recordRegistrationConsents} from './consent-data';
import {legalUrl,serviceUrl} from './service-urls';

type AuthMode='signup'|'login'|'forgot';

function initialMode(invite:string):AuthMode{
 if(invite)return'signup';
 if(location.pathname.endsWith('/forgot-password'))return'forgot';
 if(location.pathname.endsWith('/login')||new URLSearchParams(location.search).get('auth')==='login')return'login';
 return'signup';
}

export default function LabrikaEntry({onAuthenticated}:{onAuthenticated?:(account:BillingAccount)=>void}={}){
 const invite=new URLSearchParams(location.search).get('invite')||'',invitation=lookupInvitation(invite);
 const [mode,setMode]=useState<AuthMode>(()=>initialMode(invite));
 const [name,setName]=useState(invitation?fullMemberName(invitation.member):''),[phone,setPhone]=useState(invitation?.member.phone||''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [terms,setTerms]=useState(false),[personal,setPersonal]=useState(false),[marketing,setMarketing]=useState(false);
 const [challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[cooldown,setCooldown]=useState(0),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(value=>value-1),1000);return()=>clearTimeout(timer);},[cooldown]);

 const switchMode=(next:AuthMode)=>{setMode(next);setChallenge('');setCode('');setError('');setNotice('');history.replaceState(null,'',serviceUrl('auth',next==='forgot'?'/forgot-password':`/${next}`));};
 async function sendCode(){const result=await authRequest<{challengeId:string;retryAfter:number}>('start',{email});setChallenge(result.challengeId);setCode('');setCooldown(result.retryAfter);}
 async function submit(){
  if(mode==='login'){const account=await loginAccount(email,password);onAuthenticated?.(account);return;}
  if(!challenge){
   if(mode==='signup'){
    if(name.trim().split(/\s+/).length<2)throw Error('Укажите фамилию и имя');
    if(phone.replace(/\D/g,'').length<7)throw Error('Укажите номер телефона');
    if(!terms||!personal)throw Error('Для регистрации примите соглашение и согласие на обработку персональных данных.');
    if(invite&&!invitation)throw Error('Приглашение недействительно');
   }
   await sendCode();return;
  }
  const result=await authRequest<{proof:string}>('verify',{challengeId:challenge,code});
  if(mode==='forgot'){
   await resetAccountPassword(email,password,result.proof);setPassword('');setChallenge('');setCode('');setNotice('Пароль изменён. Теперь войдите с новым паролем.');setMode('login');history.replaceState(null,'',serviceUrl('auth','/login'));return;
  }
  const account=await registerAccount({name,email,phone,password,proof:result.proof,invite:invite||undefined});
  recordRegistrationConsents(account.id,marketing);onAuthenticated?.(account);
 }

 const title=challenge?(mode==='forgot'?'Подтвердите почту':'Подтвердите почту'):mode==='signup'?(invitation?'Присоединитесь к команде':'Начнём с вашего пространства'):mode==='forgot'?'Восстановление доступа':'С возвращением';
 return <main className="design-v2 labrika-entry entry-v6"><section className="labrika-entry-story"><a className="labrika-entry-brand" href={serviceUrl('landing','/')} aria-label="LABRICA — о платформе"><LabricaBrand light/></a><h1>Хорошие идеи<br/>заслуживают<br/><em>результата.</em></h1><div className="entry-story-art" aria-hidden="true"><div className="entry-art-card"><span>От идеи к публикации</span><Layers3 size={39}/><div><i/><i/><i/></div><strong>Одна система.<br/>Все площадки.</strong></div><span className="entry-art-orbit"/><span className="entry-art-check"><Check size={30}/></span></div></section>
  <section className="labrika-entry-form"><div className="entry-auth-tabs"><button className={mode==='signup'?'active':''} onClick={()=>switchMode('signup')}>Регистрация</button><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Войти</button></div><div className="entry-auth-heading"><h2>{title}</h2>{mode==='forgot'&&!challenge&&<p>Укажите почту аккаунта. Мы отправим код для смены пароля.</p>}</div>
   <form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{await submit();}catch(reason){setError(reason instanceof Error?reason.message:'Не удалось продолжить');}finally{setBusy(false);}}}>
    {!challenge&&<>{mode==='signup'&&<><label className="field">ФИО<input required autoComplete="name" value={name} onChange={event=>setName(event.target.value)} placeholder="Фамилия Имя Отчество"/></label><label className="field">Телефон<input required type="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+7"/></label></>}<label className="field">Почта<input type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@company.ru"/></label>{mode!=='forgot'&&<label className="field">Пароль<div className="entry-password"><input required minLength={8} autoComplete={mode==='signup'?'new-password':'current-password'} type={visible?'text':'password'} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Не менее 8 символов"/><button type="button" aria-label={visible?'Скрыть пароль':'Показать пароль'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}{mode==='login'&&<button className="entry-forgot" type="button" onClick={()=>switchMode('forgot')}>Забыли пароль?</button>}{mode==='signup'&&<div className="entry-consents"><label className="entry-consent"><input type="checkbox" checked={terms} onChange={event=>setTerms(event.target.checked)}/><span>Я принимаю <a href={legalUrl('/terms')} target="_blank" rel="noreferrer">Пользовательское соглашение</a></span></label><label className="entry-consent"><input type="checkbox" checked={personal} onChange={event=>setPersonal(event.target.checked)}/><span>Я даю согласие на <a href={legalUrl('/personal-data-consent')} target="_blank" rel="noreferrer">обработку персональных данных</a></span></label><label className="entry-consent"><input type="checkbox" checked={marketing} onChange={event=>setMarketing(event.target.checked)}/><span>Хочу получать новости и предложения LABRICA — <a href={legalUrl('/marketing-consent')} target="_blank" rel="noreferrer">условия</a></span></label><a className="entry-policy-link" href={legalUrl('/privacy')} target="_blank" rel="noreferrer">Политика обработки персональных данных</a></div>}</>}
    {challenge&&<div className="email-confirmation"><p>Код отправлен на <strong>{email}</strong></p><label className="field">Код из письма<input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))}/></label>{mode==='forgot'&&<label className="field">Новый пароль<div className="entry-password"><input required minLength={8} autoComplete="new-password" type={visible?'text':'password'} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Не менее 8 символов"/><button type="button" aria-label={visible?'Скрыть пароль':'Показать пароль'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}<div className="verification-links"><button type="button" onClick={()=>{setChallenge('');setError('');}}>Изменить данные</button><button type="button" disabled={busy||cooldown>0} onClick={async()=>{setBusy(true);setError('');try{await sendCode();}catch(reason){setError(reason instanceof Error?reason.message:'Не удалось отправить код');}finally{setBusy(false);}}}>{cooldown?`Повторить через ${cooldown} с`:'Отправить код ещё раз'}</button></div></div>}
    {notice&&<p className="entry-auth-notice" role="status">{notice}</p>}{error&&<p role="alert" className="entry-auth-error">{error}</p>}<button className="btn btn-primary" disabled={busy} type="submit">{busy?<LoaderCircle className="spin" size={17}/>:mode==='signup'?(challenge?'Подтвердить и войти':'Создать аккаунт'):mode==='forgot'?(challenge?'Изменить пароль':'Получить код'):'Войти в пространство'}<ArrowRight size={17}/></button>{mode==='forgot'&&<button className="entry-back" type="button" onClick={()=>switchMode('login')}>← Вернуться ко входу</button>}
   </form>
  </section></main>;
}
