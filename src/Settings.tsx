import TeamSettings from './TeamSettings';
import AppearanceSettings from './AppearanceSettings';
import NotificationPreferences from './NotificationPreferences';
import {useTeamAccess} from './team-data';
import { productName } from './runtime';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, Images, Database } from 'lucide-react';
import { useWorkspace } from './store';
import AssetLibrary from './AssetLibrary';
import SocialConnections from './SocialConnections';
import { Modal, Select } from './ui';

export default function Settings() {
  const access=useTeamAccess();
  const [libraryOpen,setLibraryOpen]=useState(false);
  const {brand,setBrand,notify,section,posts,profile,navigate}=useWorkspace();
  const [draft,setDraft]=useState(brand);
  const exportWorkspace=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),brand,profile,posts},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${productName.toLowerCase()}-workspace.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Копия пространства скачана');};
  return <><div className="page-heading"><h1 className="page-title">Настройки</h1>{section==='company'&&access.can('editCompany')&&<button className="btn btn-primary" onClick={()=>{if(!draft.name.trim()){notify('Добавьте название компании');return;}setBrand(draft);notify('Настройки компании сохранены');}}><Check size={16}/>Сохранить</button>}</div>
    {section==='company'&&<div className="settings-v3-grid"><section className="panel settings-form-card"><h2>Компания</h2><fieldset disabled={!access.can('editCompany')} className="company-access-fields"><label className="field">Название<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="field">Аудитория<input value={draft.audience} onChange={e=>setDraft({...draft,audience:e.target.value})}/></label><label className="field">Тон коммуникации<Select aria-label="Тон компании" value={draft.tone} onChange={tone=>setDraft({...draft,tone})} options={['Дружелюбный','Экспертный','Вдохновляющий','Деловой'].map(tone=>({value:tone,label:tone}))}/></label><label className="field">Редакционные правила<textarea rows={6} value={draft.rules} onChange={e=>setDraft({...draft,rules:e.target.value})}/></label></fieldset></section><section className="panel settings-brand-note"><span className="brand-sample-mark">{draft.name.slice(0,1)||'Y'}</span><h2>{draft.name||'Компания'}</h2><span>{draft.tone} тон</span><div className="brand-rule-sample">{draft.rules}</div><button className="text-button" onClick={()=>navigate('controller')}>Открыть студию<ArrowUpRight size={15}/></button></section></div>}
    {section==='social'&&<SocialConnections/>}{section==='team'&&<TeamSettings/>}
    {section==='workspace'&&<><button className="workspace-library-card" onClick={()=>setLibraryOpen(true)}><span><Images size={23}/></span><div><strong>Медиатека</strong><small>Материалы компании и созданные креативы</small></div><ArrowUpRight size={19}/></button><div className="settings-v3-grid"><section className="panel settings-form-card workspace-storage"><span className="storage-icon"><Database size={24}/></span><h2>Данные пространства</h2><div className="workspace-stats"><div><strong>{posts.length}</strong><span>публикаций</span></div><div><strong>{new Blob([JSON.stringify(posts)]).size>1048576?`${(new Blob([JSON.stringify(posts)]).size/1048576).toFixed(1)} МБ`:`${Math.round(new Blob([JSON.stringify(posts)]).size/1024)} КБ`}</strong><span>в этом браузере</span></div></div><div className="storage-status"><i/>Автосохранение включено</div><button className="btn btn-primary" onClick={exportWorkspace}><ArrowDownToLine size={16}/>Скачать копию</button></section><AppearanceSettings/><NotificationPreferences/></div></>}
    {libraryOpen&&<Modal title="Медиатека" onClose={()=>setLibraryOpen(false)} wide><div className="workspace-library"><AssetLibrary/></div></Modal>}

  </>;
}
export {default as Profile} from './Profile';
