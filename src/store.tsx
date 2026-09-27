import {getTeamAccess,useTeamAccess,updateOwnIdentity} from './team-data';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { seedPosts } from './model';
import { audit, validatePosts } from './admin-data';
import { workspaceKey, personalKey, isLabrika } from './runtime';
import { getCurrentAccount, recordUsage, updateAccount } from './billing-data';
import { learnPerformance, learnEdit } from './learning';
import { protectBrand } from './brain-data';
import type { Post, Page, BrandSettings, PublicationReceipt } from './model';

function readLocal<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key==='ygroup-profile-v1'?personalKey(key):workspaceKey(key)); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
const initialBrand: BrandSettings = {name: isLabrika ? 'Моя компания' : 'YGROUP', tone: 'Дружелюбный', audience: isLabrika ? '' : 'Предприниматели, маркетологи и продуктовые команды', rules: isLabrika ? '' : 'Пишем просто и по делу. Обращаемся на «вы». Избегаем канцелярита, клише и громких обещаний. Один пост — одна мысль.'};
interface Workspace {
  recordPublication: (post:Post,receipt:PublicationReceipt)=>void;
  posts: Post[]; replacePosts: (posts: Post[]) => void; addPost: (post: Post) => void; updatePost: (id: string, patch: Partial<Post>) => void; deletePost: (id: string) => void;
  page: Page; navigate: (page: Page, section?:string) => void; editingPost: Post | null; openEditor: (post?: Post) => void; closeEditor: () => void; editorOpen: boolean;
  notify: (message: string) => void; brand: BrandSettings; setBrand: (brand: BrandSettings) => void;
  contentFilter: string; setContentFilter: (filter: string) => void;
  section: string; setSection: (section: string) => void;
  profile: {name: string; surname?:string; phone?:string; avatar?:string; email: string; role: string}; setProfile: (profile: {name: string; surname?:string; phone?:string; avatar?:string; email: string; role: string}) => void;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({children}: {children: ReactNode}) {
  const [posts, setPosts] = useState<Post[]>(() => readLocal('ygroup-posts-v1', isLabrika ? [] : seedPosts));
  const [brand, setBrand] = useState(() => readLocal('ygroup-brand-v1', initialBrand));
  const [page, setPage] = useState<Page>('dashboard');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [contentFilter, setContentFilter] = useState('all');
  const [sections, setSections] = useState<Record<Page,string>>({dashboard:'overview',content:'all',controller:'ideas',calendar:'month',analytics:'effectiveness',settings:'company',profile:'personal',brain:'overview',assets:'all',autopilot:'rules',events:'feed',competitors:'overview',campaigns:'all',repurpose:'all',ai:'overview',billing:'plans'});
  const access=useTeamAccess();
  const [profile,setProfile] = useState<Workspace['profile']>(() => readLocal('ygroup-profile-v1', {name:isLabrika ? getCurrentAccount()?.name ?? 'Пользователь' : 'Александр',email:isLabrika ? getCurrentAccount()?.email ?? '' : '',surname:access.member?.surname||'',phone:access.member?.phone||'',role:access.isOwner?'Руководитель':access.member?.position||'Сотрудник'}));
  const [toast, setToast] = useState('');
  useEffect(()=>{const sync=()=>{const member=getTeamAccess().member;if(member)setProfile(current=>({...current,name:member.name,surname:member.surname,email:member.email,phone:member.phone,role:member.role==='owner'?'Руководитель':member.position}));};sync();window.addEventListener('team-change',sync);window.addEventListener('labrika-account-change',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('team-change',sync);window.removeEventListener('labrika-account-change',sync);window.removeEventListener('storage',sync);};},[]);
  useEffect(() => { try { localStorage.setItem(workspaceKey('ygroup-posts-v1'), JSON.stringify(posts)); } catch { setToast('Память браузера заполнена. Скачайте видео перед закрытием страницы.'); } }, [posts]);
  useEffect(() => {try {localStorage.setItem(workspaceKey('ygroup-brand-v1'), JSON.stringify(brand));}catch{setToast('Недостаточно памяти для сохранения настроек');}}, [brand]);
  useEffect(() => {try {localStorage.setItem(personalKey('ygroup-profile-v1'), JSON.stringify(profile));}catch{setToast('Недостаточно памяти для сохранения профиля');}}, [profile]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3800); return () => clearTimeout(timeout); }, [toast]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(!event.newValue)return;try{const value=JSON.parse(event.newValue);if(event.key===workspaceKey('ygroup-posts-v1')&&validatePosts(value))setPosts(value);if(event.key===workspaceKey('ygroup-brand-v1')&&['name','tone','audience','rules'].every(key=>typeof value?.[key]==='string'))setBrand(value);if(event.key===personalKey('ygroup-profile-v1')&&['name','email','role'].every(key=>typeof value?.[key]==='string'))setProfile(value);}catch{/* Ignore incomplete external writes. */}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  useEffect(()=>{learnPerformance(posts);},[posts]);
  const allowed=(permission:string)=>{if(getTeamAccess().can(permission))return true;setToast('Недостаточно прав для этого действия');return false;};
  const recordPublication=(post:Post,receipt:PublicationReceipt)=>{
    if(!allowed('schedulePosts'))return;
    const stamp=new Date(receipt.publishedAt);const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'}).format(stamp);
    setPosts(current=>{const snapshotId=`remote-${post.id}-${receipt.platform}`;if(current.some(item=>item.id===snapshotId))return current;const source=current.find(item=>item.id===post.id);const draft={...post,...source,deliveries:{...source?.deliveries,[receipt.platform]:receipt}};const snapshot:Post={...post,id:snapshotId,originPostId:post.id,author:profile.name,status:'published',platforms:[receipt.platform],date,time,deliveries:{[receipt.platform]:receipt},views:0,clicks:0,registrations:0,reactions:0,comments:0,shares:0};return [snapshot,...(source?current.map(item=>item.id===post.id?draft:item):[{...draft,status:'draft' as const},...current])];});
    if(isLabrika&&!posts.some(item=>item.id===post.id))recordUsage('posts',1);audit('Публикация отправлена',`${post.title} · ${receipt.platform}`);
  };
  const navigate = (next: Page, section?:string) => { if(next==='events'||next==='competitors'){section=next;next='brain';} setPage(next);if(section)setSections(s=>({...s,[next]:section})); document.querySelector('.main-shell')?.scrollTo({top:0,behavior:'instant'}); window.scrollTo({top: 0, behavior: 'instant'}); };
  return <Context.Provider value={{posts, recordPublication, replacePosts: next => {if(!allowed('createPosts'))return;setPosts(next);audit("Восстановление данных", `${next.length} публикаций`);}, addPost: post => {if(!allowed('createPosts')||post.status==='approved'&&!allowed('approvePosts')||post.status==='scheduled'&&!allowed('schedulePosts')||post.status==='published')return;setPosts(p => [{...post,author:profile.name}, ...p]);if(isLabrika)recordUsage('posts',1);audit("Создана публикация",post.title);}, updatePost: (id, patch) => {if(patch.status==='published'){setToast('Статус обновится после подтверждения площадки');return;}if(patch.status==='draft'&&!allowed('createPosts')||patch.status==='approved'&&!allowed('approvePosts')||patch.status==='scheduled'&&!allowed('schedulePosts')||Object.keys(patch).some(key=>!['status','date','time','planned'].includes(key))&&!allowed('createPosts')||['date','time','planned'].some(key=>key in patch)&&!allowed('schedulePosts'))return;const previous=posts.find(p=>p.id===id);if(previous?.status==='published'){setToast('Опубликованный материал нельзя изменить');return;}if(previous&&['approved','scheduled','published'].includes(patch.status??previous.status)){const guard=protectBrand(patch.body??previous.body,patch.title??previous.title);if(!guard.allowed||guard.issues.some(i=>i.code==='unsourced-number')){setToast('Проверьте факты и правила бренда перед согласованием');return;}}if(previous&&patch.body!==undefined)learnEdit(previous.body,patch.body,patch.goal ?? previous.goal);setPosts(p => p.map(post => post.id === id ? {...post, ...patch} : post));audit("Обновлена публикация",patch.title ?? posts.find(p=>p.id===id)?.title ?? id);}, deletePost: id => {if(!allowed('createPosts'))return;setPosts(p => p.filter(post => post.id !== id));audit("Удалена публикация",posts.find(p=>p.id===id)?.title ?? id);}, page, navigate, editingPost, editorOpen, openEditor: (post) => {setEditingPost(post ?? null);setEditorOpen(true);}, closeEditor: () => setEditorOpen(false), notify: setToast, brand, setBrand: next => {if(!allowed('editCompany'))return;setBrand(next);audit("Настройки компании",next.name);}, contentFilter, setContentFilter: filter => {setContentFilter(filter);setSections(s=>({...s,content:filter}));}, section:page==='content'?contentFilter:sections[page],setSection:section=>{document.querySelector('.main-shell')?.scrollTo({top:0,behavior:'instant'});setSections(s=>({...s,[page]:section}));if(page==='content')setContentFilter(section);},profile,setProfile:next=>{if(!getTeamAccess().isOwner){setProfile(current=>({...current,avatar:next.avatar}));return;}const account=getCurrentAccount();if(account)updateAccount(account.id,{name:next.name,email:next.email});updateOwnIdentity(next);setProfile(next);}}}>{children}{toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}<button aria-label="Закрыть уведомление" onClick={() => setToast('')}>×</button></div>}</Context.Provider>;
}
export function useWorkspace() { const context = useContext(Context); if (!context) throw new Error('Workspace provider missing'); return context; }
