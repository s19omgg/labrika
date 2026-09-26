import AIChat from './AIChat';
import Onboarding from './Onboarding';
import PaymentDetails from './PaymentDetails';
import {useTeamAccess} from './team-data';
import {readWorkspace} from './runtime';
import LabricaBrand from './LabricaBrand';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, SlidersHorizontal, CalendarDays, ChartNoAxesCombined, Settings2, ChevronDown, Search, ArrowUpRight, Command, Menu, Check, CircleHelp, PanelLeftClose, PanelLeftOpen, UserRound, LogOut, ArrowRight, BrainCircuit, Workflow, Grid2X2, Repeat2 } from 'lucide-react';
import type { Page } from './model';
import { useWorkspace } from './store';
import { Avatar, Modal, PostCover, StatusBadge } from './ui';
import Dashboard from './Dashboard';
import Content from './Content';
import Editor from './Editor';
import Calendar from './Calendar';
import Analytics from './Analytics';
import Controller from './Controller';
import Settings, { Profile } from './Settings';
import { workspaceKey, productName, isLabrika } from './runtime';
import { logoutAccount } from './billing-data';
import Billing, { SubscriptionCard } from './Billing';
import BrandBrain from './BrandBrain';
import AssetLibrary from './AssetLibrary';
import GrowthStudio from './GrowthStudio';
import LabrikaAI from './LabrikaAI';
import NotificationCenter from './NotificationCenter';
import { useAutopilotRunner } from './autopilot-runner';
import { useScrollRail } from './useScrollRail';

const navigation = [
  {id:'dashboard' as Page,name:'Обзор',icon:LayoutDashboard},
  {id:'controller' as Page,name:'Студия',icon:SlidersHorizontal},
  {id:'calendar' as Page,name:'Контент-план',icon:CalendarDays},
  {id:'analytics' as Page,name:'Аналитика',icon:ChartNoAxesCombined},
];
const sections:Record<Page,{id:string;name:string}[]>={
  dashboard:[{id:'overview',name:'Сводка'}],
  content:[{id:'all',name:'Все'},{id:'draft',name:'Черновики'},{id:'approved',name:'Согласованные'},{id:'scheduled',name:'В плане'},{id:'published',name:'Опубликованные'}],
  controller:[{id:'ideas',name:'Идеи'},{id:'create',name:'Создание'},{id:'campaigns',name:'Кампании'}],
  calendar:[{id:'month',name:'Месяц'},{id:'week',name:'Неделя'}],
  analytics:[{id:'effectiveness',name:'Эффективность'},{id:'audience',name:'Воронка'},{id:'timing',name:'Время выхода'}],
  settings:[{id:'company',name:'Компания'},{id:'social',name:'Социальные сети'},{id:'workspace',name:'Пространство'},{id:'team',name:'Команда'}],
  profile:[{id:'personal',name:'Профиль'}],
  brain:[{id:'overview',name:'Обзор'},{id:'knowledge',name:'Знания'},{id:'rules',name:'Правила'},{id:'sources',name:'Источники'},{id:'events',name:'События бизнеса'},{id:'competitors',name:'Конкуренты'}],
  assets:[{id:'all',name:'Все материалы'}],
  autopilot:[{id:'rules',name:'Правила'},{id:'review',name:'На согласовании'}],
  events:[{id:'feed',name:'События'},{id:'sources',name:'Источники'}],
  competitors:[{id:'overview',name:'Конкуренты'},{id:'gaps',name:'Возможности'}],
  campaigns:[{id:'all',name:'Кампании'}],repurpose:[{id:'all',name:'Repurpose'}],ai:[{id:'overview',name:'Обзор'},{id:'company',name:'О компании'}],billing:[{id:'plans',name:'Тарифы'},{id:'payment',name:'Оплата'}],
};
function Brand({onClick,company=''}: {onClick:()=>void;company?:string}) {return <button className={`brand-lockup ${company?'brand-with-company':''}`} onClick={onClick} aria-label={`${productName}${company?` × ${company}`:''} — на главную`} title={company?`${productName} × ${company}`:productName}><LabricaBrand company={company}/></button>;}
export default function App() {
  useAutopilotRunner();
  const [chatOpen,setChatOpen]=useState(false);
  const access=useTeamAccess();const [companyReady,setCompanyReady]=useState(()=>readWorkspace<{completed?:boolean}>('onboarding-v1',{}).completed===true);
  const {page,navigate,posts,openEditor,editorOpen,section,setSection,profile,brand} = useWorkspace();
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===workspaceKey('onboarding-v1'))setCompanyReady(readWorkspace<{completed?:boolean}>('onboarding-v1',{}).completed===true);};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:760px)').matches);
  useEffect(()=>{const media=window.matchMedia('(max-width:760px)');const update=()=>{setCompact(media.matches);if(!media.matches)setMobileNav(false);};media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const [searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[notifications,setNotifications]=useState(false),[help,setHelp]=useState(false),[mobileNav,setMobileNav]=useState(false),[profileOpen,setProfileOpen]=useState(false);
  const [expanded,setExpanded]=useState(()=>localStorage.getItem(workspaceKey('ygroup-sidebar-expanded'))==='true');
  const [signedOut,setSignedOut]=useState(()=>sessionStorage.getItem(workspaceKey('ygroup-session'))==='signed-out');
  const rootRef=useRef<HTMLDivElement>(null);
  useScrollRail(rootRef, `${page}:${section}`, expanded, mobileNav, !signedOut);
  const profileButton=useRef<HTMLButtonElement>(null),profileMenu=useRef<HTMLDivElement>(null);
  useEffect(()=>{localStorage.setItem(workspaceKey('ygroup-sidebar-expanded'),String(expanded));},[expanded]);
  useEffect(()=>{if(profileOpen)profileMenu.current?.querySelector<HTMLElement>('button')?.focus();},[profileOpen]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'&&!signedOut){e.preventDefault();setSearchOpen(v=>!v);}if(e.key==='Escape'){setNotifications(false);setMobileNav(false);setProfileOpen(false);}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[signedOut]);
  const move=(next:Page)=>{navigate(next);setMobileNav(false);setNotifications(false);setProfileOpen(false);};
  const visibleSections=sections[page].filter(item=>!(page==='billing'&&item.id==='payment'&&!access.isOwner));
  const matches=posts.filter(p=>(p.title+' '+p.body).toLowerCase().includes(query.toLowerCase())).slice(0,7);
  if(signedOut)return <div className="design-v2 workspace-entry"><Brand onClick={()=>{}}/><div className="entry-card"><Avatar name={profile.name} size={64}/><h1>До встречи, {profile.name.split(' ')[0]}</h1><span>Локальное пространство сохранено</span><button className="btn btn-primary" onClick={()=>{sessionStorage.removeItem(workspaceKey('ygroup-session'));setSignedOut(false);move('dashboard');}}>Вернуться в пространство<ArrowRight size={16}/></button></div></div>;
  return <div ref={rootRef} className={`app-layout design-v2 workspace-v3 workspace-v5 workspace-v6 ${expanded?'sidebar-expanded':''}`}>
    {mobileNav&&<button className="sidebar-shade" aria-label="Закрыть меню" onClick={()=>setMobileNav(false)}/>}
    <header className="topbar">
      <Brand onClick={()=>move('dashboard')} company={companyReady?brand.name.trim():''}/>
      <nav className="main-nav" aria-label="Подразделы текущей вкладки">{(visibleSections.length>1&&!(page==='content'&&section==='board')?visibleSections:[]).map(({id,name})=><button key={id} onClick={()=>setSection(id)} className={`nav-item ${section===id?'nav-active':''}`} aria-current={section===id?'page':undefined}>{name}</button>)}</nav>
      <div className="topbar-actions"><button className="icon-button ai-chat-trigger" aria-label="Открыть AI-чат" aria-expanded={chatOpen} onClick={()=>setChatOpen(!chatOpen)}>AI</button><button className="icon-button search-trigger" aria-label="Поиск по пространству" title="Поиск · ⌘K" onClick={()=>setSearchOpen(true)}><Search size={19} strokeWidth={1.6}/></button><NotificationCenter open={notifications} onToggle={()=>{setNotifications(!notifications);setProfileOpen(false);}} onClose={()=>setNotifications(false)}/>
      <div className="profile-wrapper"><button ref={profileButton} className="profile-button" onClick={()=>{setProfileOpen(!profileOpen);setNotifications(false);}} aria-label="Меню профиля" aria-haspopup="menu" aria-expanded={profileOpen}><Avatar name={profile.name} src={profile.avatar} size={35}/><ChevronDown size={14}/></button>{profileOpen&&<><button className="popover-dismiss" aria-label="Закрыть меню профиля" onClick={()=>setProfileOpen(false)}/><div ref={profileMenu} className="profile-popover" role="menu" aria-label="Аккаунт" onKeyDown={e=>{const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const i=items.indexOf(document.activeElement as HTMLButtonElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}if(e.key==='Escape'){setProfileOpen(false);profileButton.current?.focus();}if(e.key==='Tab')setProfileOpen(false);}}><div className="profile-menu-name"><strong>{profile.name}</strong><span>{profile.role}</span></div><button role="menuitem" onClick={()=>move('profile')}><UserRound size={16}/>Профиль</button><button role="menuitem" onClick={()=>move('settings')}><Settings2 size={16}/>Настройки</button><button role="menuitem" onClick={()=>{setProfileOpen(false);if(isLabrika)logoutAccount();else{sessionStorage.setItem(workspaceKey('ygroup-session'),'signed-out');setSignedOut(true);}}}><LogOut size={16}/>Выйти</button></div></>}</div>
      <button className="icon-button mobile-menu" onClick={()=>setMobileNav(!mobileNav)} aria-label="Открыть меню" aria-expanded={mobileNav}><Menu size={20}/></button></div>
    </header>
    <aside className={`sidebar scroll-rail ${mobileNav?'mobile-open':''}`} aria-label="Главное меню">
      <span className="rail-surface" aria-hidden="true"/>
      <div className="rail-navigation"><button className="rail-button rail-toggle" onClick={()=>{if(compact)setMobileNav(!mobileNav);else setExpanded(!expanded);}} aria-label={(compact?mobileNav:expanded)?'Свернуть меню':'Раскрыть меню'} aria-expanded={compact?mobileNav:expanded}>{expanded?<PanelLeftClose size={19}/>:<PanelLeftOpen size={19}/>}<span className="rail-label">Свернуть меню</span><span className="rail-tooltip">{expanded?'Свернуть':'Раскрыть'} меню</span></button><div className="rail-divider"/>{navigation.map(({id,name,icon:Icon})=><button key={id} onClick={()=>move(id)} className={`rail-button ${page===id?'rail-active':''}`} aria-label={`Перейти: ${name}`} aria-current={page===id?'page':undefined}><Icon size={20} strokeWidth={1.65}/><span className="rail-label">{name}</span><span className="rail-tooltip">{name}</span></button>)}<button className={`rail-button ${['brain','autopilot','events','competitors','repurpose'].includes(page)?'rail-active':''}`} onClick={()=>setToolsOpen(true)} aria-label="Инструменты"><Grid2X2 size={20}/><span className="rail-label">Инструменты</span><span className="rail-tooltip">Инструменты</span></button></div>
      <div className="rail-bottom">{isLabrika&&<><button className={`rail-button ${page==='ai'?'rail-active':''}`} aria-label="Перейти: LABRICA AI" onClick={()=>move('ai')}><BrainCircuit size={20}/><span className="rail-label">LABRICA AI</span><span className="rail-tooltip">LABRICA AI</span></button><SubscriptionCard onOpen={()=>move('billing')}/></>}<button className={`rail-button ${page==='settings'?'rail-active':''}`} onClick={()=>move('settings')} aria-label="Настройки"><Settings2 size={20} strokeWidth={1.65}/><span className="rail-label">Настройки</span><span className="rail-tooltip">Настройки</span></button><button className="rail-button" onClick={()=>{setHelp(true);setMobileNav(false);}} aria-label="Как всё устроено"><CircleHelp size={20} strokeWidth={1.65}/><span className="rail-label">Помощь</span><span className="rail-tooltip">Помощь</span></button></div>
    </aside>
    <div className="main-shell"><main className="main-content" key={page}>{page==='dashboard'?<Dashboard/>:page==='content'?<Content/>:page==='controller'?(section==='campaigns'?<GrowthStudio/>:<Controller/>):page==='calendar'?<Calendar/>:page==='analytics'?<Analytics/>:page==='profile'?<Profile/>:page==='brain'?(['events','competitors'].includes(section)?<GrowthStudio view={section as 'events'|'competitors'}/>:<BrandBrain/>):page==='assets'?<AssetLibrary/>:page==='ai'&&isLabrika?<LabrikaAI/>:page==='billing'&&isLabrika?(section==='payment'?<PaymentDetails/>:<Billing/>):['autopilot','events','competitors','campaigns','repurpose'].includes(page)?<GrowthStudio/>:<Settings/>}</main></div>
    {toolsOpen&&<Modal title="Инструменты" onClose={()=>setToolsOpen(false)}><div className="workspace-tool-grid">{[{id:'brain' as Page,title:'Brand Brain',icon:BrainCircuit,copy:'Память о компании'},{id:'autopilot' as Page,title:'Автопилот',icon:Workflow,copy:'Контент по вашим правилам'},{id:'repurpose' as Page,title:'Repurpose',icon:Repeat2,copy:'Один материал — много форматов'}].map(({id,title,icon:Icon,copy})=><button key={id} onClick={()=>{setToolsOpen(false);move(id);}}><span><Icon size={22}/></span><div><strong>{title}</strong><small>{copy}</small></div><ArrowUpRight size={18}/></button>)}</div></Modal>}
    {page==='controller'&&!companyReady&&access.can('editCompany')&&<Modal title="О вашей компании" onClose={()=>move('dashboard')}><Onboarding onComplete={()=>setCompanyReady(true)}/></Modal>}
    {chatOpen&&<AIChat onClose={()=>setChatOpen(false)}/>}
    {editorOpen&&<Editor/>}
    {searchOpen&&<Modal title="Поиск по пространству" onClose={()=>setSearchOpen(false)}><div className="search-modal"><div className="search-field"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Тема, название или фраза из поста" aria-label="Найти публикацию"/><kbd>esc</kbd></div><div className="search-results">{matches.map(p=><button key={p.id} onClick={()=>{setSearchOpen(false);openEditor(p);}}><PostCover cover={p.cover}/><span><strong>{p.title}</strong><small>{p.format}</small></span><StatusBadge status={p.status}/></button>)}{!matches.length&&<div className="empty-state"><Search size={28}/><h3>Ничего не нашлось</h3></div>}</div><div className="search-hint"><Command size={12}/> K — открыть поиск</div></div></Modal>}
    {help&&<Modal title="От идеи к результату" onClose={()=>setHelp(false)}><div className="help-content">{[{num:'01',title:'Студия',body:'Идеи, тексты и визуал под вашу цель.'},{num:'02',title:'Публикации',body:'Черновики и согласования — из дашборда.'},{num:'03',title:'Контент-план',body:'Переносите карточки между датами.'},{num:'04',title:'Аналитика',body:'Сравнивайте результат площадок, тем и форматов.'}].map(item=><div className="help-step" key={item.num}><span>{item.num}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></div>)}<button className="btn btn-primary" onClick={()=>setHelp(false)}>Понятно<Check size={16}/></button></div></Modal>}
  </div>;
}
