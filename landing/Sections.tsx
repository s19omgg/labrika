import {useEffect,useRef,useState} from 'react';
import Mascot from './Mascot';
import PlatformMockup from './PlatformMockup';
export {default as HeroMascot} from './HeroMascot';

const base=import.meta.env.BASE_URL;
export const Icon=({name}:{name:string})=><svg className="icon" aria-hidden="true"><use href={`#${name}`}/></svg>;

export function FeatureArt({type}:{type:'brain'|'studio'|'calendar'|'analytics'}){
 if(type==='brain')return <div className="feature-art brand-art" aria-hidden="true"><svg viewBox="0 0 340 150" className="knowledge-lines"><path d="M65 35H150Q170 35 170 65V92M300 25H230Q210 25 210 65V92M304 124H236"/></svg><div className="knowledge-doc doc-one"><Icon name="people"/><i/><i/></div><div className="knowledge-doc doc-two"><Icon name="image"/><i/><i/></div><div className="knowledge-core"><Icon name="layers"/><span>Ваш бренд</span><div><i/><i/><i/></div></div><span className="knowledge-check"><Icon name="check"/></span></div>;
 if(type==='studio')return <div className="feature-art studio-art" aria-hidden="true"><div className="creative-sheet"><span>История бренда</span><i/><i/><i/></div><div className="creative-image"><div className="creative-orbit"/><div className="creative-orbit second"/><span><Icon name="image"/></span></div><div className="creative-toolbar"><Icon name="pen"/><Icon name="image"/><Icon name="play"/></div><span className="creative-spark"><Icon name="sparkles"/></span></div>;
 if(type==='calendar')return <div className="feature-art schedule-art" aria-hidden="true"><div className="schedule-week">{['Пн','Вт','Ср','Чт','Пт'].map((day,i)=><div key={day}><small>{day}</small><span>{23+i}</span><i className={i===2?'selected':''}/></div>)}</div><div className="schedule-post"><Icon name="calendar"/><div><strong>Новая публикация</strong><span>Telegram · ВКонтакте</span></div><b>12:30</b></div></div>;
 return <div className="feature-art line-art" aria-hidden="true"><div className="chart-key"><i/>Охваты</div><svg viewBox="0 0 520 145" preserveAspectRatio="none"><path className="graph-grid" d="M0 25H520M0 75H520M0 125H520"/><path className="graph-shadow" d="M0 123C40 122 55 88 100 93S150 113 195 73 245 95 285 54 333 73 380 38 453 44 515 12L515 145H0Z"/><path className="graph-line" pathLength="1" d="M0 123C40 122 55 88 100 93S150 113 195 73 245 95 285 54 333 73 380 38 453 44 515 12"/><circle cx="515" cy="12" r="4"/></svg></div>;
}

const steps=[
 {title:'Создайте аккаунт',image:'account',name:'Регистрация',position:'right'},
 {title:'Заполните информацию про бренд',image:'brand',name:'Информация о компании',position:'right'},
 {title:'Подключите социальные сети',image:'social',name:'Подключение Telegram',position:'center'},
 {title:'Создайте первый пост',image:'studio',name:'Студия',position:'left'},
 {title:'Запланируйте публикацию в выбранные социальные сети',image:'calendar',name:'Контент-план',position:'center'},
 {title:'Собирайте статистику по охватам и взаимодействиям аудитории',image:'analytics',name:'Аналитика',position:'center'},
];

export function Walkthrough(){
 const [active,setActive]=useState(0);
 const section=useRef<HTMLElement>(null);
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const onMedia=()=>setReduced(media.matches);onMedia();media.addEventListener('change',onMedia);
  let frame=0;
  const sync=()=>{frame=0;if(!section.current||media.matches)return;const rect=section.current.getBoundingClientRect();const distance=section.current.offsetHeight-innerHeight;const progress=Math.max(0,Math.min(1,-rect.top/Math.max(distance,1)));setActive(Math.min(5,Math.floor(progress*6)));};
  const request=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  addEventListener('scroll',request,{passive:true});addEventListener('resize',request);request();
  return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',request);removeEventListener('resize',request);media.removeEventListener('change',onMedia);};
 },[]);
 const choose=(index:number)=>{setActive(index);if(!reduced&&section.current){const top=section.current.getBoundingClientRect().top+scrollY;scrollTo({top:top+(section.current.offsetHeight-innerHeight)*(index+.35)/6,behavior:'smooth'});}};
 return <section ref={section} className="walkthrough section" id="how-it-works" aria-labelledby="how-title"><div className="walkthrough-sticky"><div className="walkthrough-heading"><p className="eyebrow">Как это работает</p><h2 id="how-title">От первого шага<br/>до первой публикации.</h2></div><div className="walkthrough-scene">
  <div className="product-window product-window-left" aria-hidden="true"><div className="product-window-bar"><span/><span/><span/><b>LABRICA</b></div><div className="product-window-content">{steps.map((step,i)=><div key={step.image} className={`mockup-slide${i===active?' is-active':''}`} data-mockup-step={i}><PlatformMockup step={i}/></div>)}</div></div>
  <ol className="walkthrough-list">{steps.map((step,i)=><li key={step.title} className={i===active?'is-current':i<active?'is-complete':''}><button onClick={()=>choose(i)} aria-current={i===active?'step':undefined}><span className="step-check">{i<active?<Icon name="check"/>:String(i+1).padStart(2,'0')}</span><span>{step.title}</span></button></li>)}</ol>
  <div className="product-window product-window-right" aria-hidden="true"><div className="product-window-content">{steps.map((step,i)=><div key={step.image} className={`mockup-slide${i===active?' is-active':''}`} data-mockup-step={i}><PlatformMockup step={i} detail/></div>)}</div><div className="product-window-caption"><Icon name={['people','layers','plus','pen','calendar','analytics'][active]}/><span>{steps[active].name}</span></div></div>
 </div><div className="walkthrough-bottom"><span>{String(active+1).padStart(2,'0')} <i>/ 06</i></span><div className="step-progress">{steps.map((_,i)=><i key={i} className={i<=active?'is-done':''}/>)}</div><a className="text-link" href={`${base}labrika/?auth=signup`}><span className="button-label">Начать работу</span><Icon name="arrow-up"/></a></div></div></section>;
}

export function AIChat(){
 const host=useRef<HTMLDivElement>(null);
 const [stage,setStage]=useState(0);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');let timers:ReturnType<typeof setTimeout>[]=[];
  const play=()=>{timers.forEach(clearTimeout);if(media.matches){setStage(3);return;}setStage(1);timers=[setTimeout(()=>setStage(2),650),setTimeout(()=>setStage(3),2200)];};
  const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){play();observer.disconnect();}},{threshold:.45});
  if(host.current)observer.observe(host.current);media.addEventListener('change',play);
  return()=>{observer.disconnect();timers.forEach(clearTimeout);media.removeEventListener('change',play);};
 },[]);
 return <div className={`ai-conversation chat-stage-${stage}`} ref={host}><div className="ai-message-user">Давай придумаем квиз в наш тг-канал по бренду</div><div className="ai-message"><span className="ai-avatar"><Icon name="sparkles"/></span><div><span className="mini-label">LABRICA AI</span><div className="chat-answer-space"><span className="typing-indicator" aria-label="Ассистент печатает"><i/><i/><i/></span><div className="chat-answer"><p>Отлично, изучил похожие форматы у конкурентов и собрал несколько фактов из ваших социальных сетей. Вот несколько вариантов:</p><div className="quiz-ideas"><span><b>01</b>Правда или миф?</span><span><b>02</b>Угадайте продукт по факту</span><span><b>03</b>Насколько хорошо вы нас знаете?</span></div></div></div></div></div></div>;
}

const plans=[
 {name:'LITE',description:'Для уверенного начала',price:'4 990',limits:['1 бренд · 5 профилей','30 постов','30 изображений','40 секунд видео','2 участника'],features:['Редактор текстов и календарь','Согласование публикаций','Базовая аналитика']},
 {name:'BUSINESS',description:'Для регулярного контента',price:'9 990',limits:['1 бренд · 10 профилей','50 постов','100 изображений','200 секунд видео','5 участников'],features:['Автоматический контент-план и идеи','Тон компании и автопостинг','Расширенная аналитика']},
 {name:'PRO',description:'Для команды, которая растёт',price:'19 990',limits:['3 бренда · 25 профилей','100 постов','500 изображений','500 секунд видео','10 участников'],features:['Стили и правила для каждого бренда','A/B-тесты и расширенная студия','Адаптация контента и анализ воронки','Приоритетная генерация контента']},
 {name:'CUSTOM',description:'Под ваши процессы',price:'39 990',limits:['Бренды и профили — индивидуально','Посты — индивидуально','Изображения — индивидуально','Видео — индивидуально','Участники — индивидуально'],features:['Индивидуальные лимиты','Отдельные рабочие пространства','CRM, API и собственные роли','Процессы согласования под команду','White label и инфраструктура']},
];
export function Pricing(){return <section className="pricing section" id="pricing" aria-labelledby="pricing-title"><div className="section-heading"><div><p className="eyebrow">Тарифы</p><h2 id="pricing-title">Для ваших задач.<br/>В масштабе вашей команды.</h2></div></div><div className="pricing-cards">{plans.map((plan,i)=><article key={plan.name} className={`pricing-card${i===1?' pricing-featured':''}`}><div className="pricing-name"><h3>{plan.name}</h3>{i===1&&<span>Лучший выбор</span>}</div><p className="pricing-description">{plan.description}</p><div className="pricing-price">{i===3&&<span>от </span>}<strong>{plan.price}</strong><span> ₽</span><small>в месяц</small></div><a className={`button ${i===1?'button-green':'pricing-link'}`} href={`${base}labrika/?auth=signup`}><span className="button-label">{i===3?'Узнать подробнее':'Выбрать тариф'}</span><Icon name="arrow"/></a><ul className="pricing-limits">{plan.limits.map((limit,j)=><li key={limit}><Icon name={['layers','pen','image','play','people'][j]}/>{limit}</li>)}</ul><ul className="pricing-features">{plan.features.map(feature=><li key={feature}><Icon name="check"/>{feature}</li>)}</ul></article>)}</div></section>;}

export function Peek(){return <div className="mascot-peek" aria-hidden="true"><Mascot peek/></div>;}
