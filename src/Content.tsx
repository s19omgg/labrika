import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Check, ChevronDown, FileText, GripVertical, Columns3, List, Plus, Search } from 'lucide-react';
import { platformMeta, shortNumber, statusMeta } from './model';
import type { Platform, PostStatus } from './model';
import { useWorkspace } from './store';
import {useTeamAccess} from './team-data';
import { Avatar, PlatformIcon, PostCover, Select, StatusBadge } from './ui';
import './content.css';

const statuses: PostStatus[] = ['draft', 'approved', 'scheduled', 'published'];
const columnNames: Record<PostStatus, string> = {draft: 'Черновики', approved: 'Согласованные', scheduled: 'Запланированные', published: 'Опубликованные'};
function dateLabel(date: string) { return new Date(`${date}T12:00:00+03:00`).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul'}).replace('.', ''); }

export default function Content() {
  const {posts, openEditor, updatePost, notify, contentFilter, setContentFilter} = useWorkspace();
  const {can}=useTeamAccess();
  const mayMove=(status:PostStatus)=>status==='draft'?can('createPosts'):status==='approved'?can('approvePosts'):status==='scheduled'?can('schedulePosts'):false;
  const movable=can('createPosts')||can('approvePosts')||can('schedulePosts');
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [limit, setLimit] = useState(10);
  const [dragOver, setDragOver] = useState<PostStatus | null>(null);
  const board = contentFilter === 'board';
  const filteredPosts = useMemo(() => posts.filter(post =>
    (!statuses.includes(contentFilter as PostStatus) || post.status === contentFilter) &&
    (platform === 'all' || post.platforms.includes(platform as Platform)) &&
    `${post.title} ${post.body} ${post.topic}`.toLowerCase().includes(query.toLowerCase())
  ), [posts, contentFilter, platform, query]);
  const changeStatus = (id: string, status: PostStatus) => {
    const post = posts.find(item => item.id === id);
    if (!post || post.status === status || !mayMove(status)) return;
    if (status === 'published') {notify('Для публикации нужно подключить площадку.');return;}
    if (post.status === 'published') {openEditor(post);return;}
    if (status === 'scheduled' || status === 'approved') {openEditor({...post, status});return;}
    updatePost(id, {status});
    notify(`«${post.title}»: ${statusMeta[status].name.toLowerCase()}`);
  };
  const resetFilters = () => {setQuery('');setPlatform('all');setContentFilter('all');};

  return <div className="content-page page-enter">
    <div className="page-heading"><h1 className="page-title">Публикации <span className="content-total">{posts.length}</span></h1><button className="btn btn-primary" disabled={!can('createPosts')} onClick={() => openEditor()}><Plus size={17}/> Создать пост</button></div>
    <div className="content-toolbar">
      <label className="content-search"><Search size={17}/><input aria-label="Найти публикацию" placeholder="Найти публикацию" value={query} onChange={event => {setQuery(event.target.value);setLimit(10);}}/>{query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}>×</button>}</label>
      <div className="content-tools"><div className="publication-mode-switch" role="group" aria-label="Вид публикаций"><button aria-pressed={!board} className={!board?"active":""} onClick={()=>setContentFilter("all")}><List size={15}/>Список</button><button aria-pressed={board} className={board?"active":""} onClick={()=>setContentFilter("board")}><Columns3 size={15}/>Доска</button></div><Select className="content-platform-select" aria-label="Фильтр по площадке" value={platform} onChange={setPlatform} options={[{value: 'all', label: 'Все площадки'}, ...Object.entries(platformMeta).map(([value, meta]) => ({value, label: meta.name}))]}/></div>
    </div>
    {board ? <div className="content-board">{statuses.map(status => <section className={`content-board-column ${dragOver === status ? 'is-drag-over' : ''}`} key={status} onDragOver={event => {if (mayMove(status)) {event.preventDefault();setDragOver(status);}}} onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null);}} onDrop={event => {event.preventDefault();changeStatus(event.dataTransfer.getData('text/plain'), status);setDragOver(null);}}>
      <div className="content-board-heading"><span className={`content-status-dot dot-${status}`}/><h2>{columnNames[status]}</h2><span>{filteredPosts.filter(post => post.status === status).length}</span></div>
      <div className="content-board-stack">{filteredPosts.filter(post => post.status === status).map(post => <article className="content-board-card" key={post.id} draggable={post.status !== 'published'&&movable} onDragStart={event => {event.dataTransfer.setData('text/plain', post.id);event.dataTransfer.effectAllowed = 'move';}} onDragEnd={() => setDragOver(null)}>
        <button className="content-board-open" onClick={() => openEditor(post)}><div className={`content-board-cover cover-${post.cover}`}>{post.media?.kind === 'image' ? <img src={post.media.url} alt="" className="content-media-cover"/> : <PostCover cover={post.cover}/>}<span>{post.format}</span></div><h3>{post.title}</h3><p>{post.body.replaceAll('\n', ' ').slice(0, 78)}{post.body.length > 78 ? '…' : ''}</p></button>
        <div className="content-board-card-bottom"><div className="content-platforms">{post.platforms.map(value => <PlatformIcon key={value} platform={value} size={23}/>)}</div><span>{dateLabel(post.date)}</span>{post.status !== 'published' && movable && <GripVertical size={14}/>}</div>
        <div className="content-board-move"><span>Этап</span><Select className="content-board-stage" aria-label={`Изменить этап: ${post.title}`} value={post.status} disabled={post.status === 'published'||!movable} onChange={value => changeStatus(post.id, value as PostStatus)} options={statuses.map(value => ({value, label: statusMeta[value].name, disabled: !mayMove(value)}))}/></div>
      </article>)}{filteredPosts.every(post => post.status !== status) && <div className="content-board-empty">{status === 'published' ? 'Здесь появятся опубликованные посты' : movable ? 'Перетащите публикацию сюда' : 'Публикаций пока нет'}</div>}</div>
    </section>)}</div> : <div className="panel content-list-panel">
      <div className="content-list-head"><span>Публикация <ArrowDown size={12}/></span><span>Площадки</span><span>Статус</span><span>Дата</span><span>Автор</span><span/></div>
      {filteredPosts.slice(0, limit).map(post => <button key={post.id} className="content-list-row" onClick={() => openEditor(post)}>
        <span className="content-post-cell">{post.media?.kind === 'image' ? <img src={post.media.url} alt="" className="content-list-cover content-media-cover"/> : <PostCover cover={post.cover} className="content-list-cover"/>}<span><strong>{post.title}</strong><small>{post.format}<span>·</span>{post.topic}{post.status === 'published' && <><span>·</span>{shortNumber(post.views)} просмотров</>}</small></span></span>
        <span className="content-platforms">{post.platforms.map(value => <PlatformIcon platform={value} key={value} size={27}/>)}</span><span><StatusBadge status={post.status}/></span><span className="content-list-date">{dateLabel(post.date)}<small>{post.status === 'scheduled' || post.status === 'published' ? post.time : '—'}</small></span><span className="content-author"><Avatar name={post.author} size={28}/></span><ArrowRight className="content-row-arrow" size={16}/>
      </button>)}
      {!filteredPosts.length && <div className="content-empty"><FileText size={30}/><h3>Пока ничего нет</h3><p>Попробуйте изменить поиск или фильтры.</p><button className="btn btn-ghost" onClick={resetFilters}>Сбросить фильтры</button></div>}
      {filteredPosts.length > 0 && <div className="content-list-footer"><span>{Math.min(limit, filteredPosts.length)} из {filteredPosts.length} публикаций</span>{filteredPosts.length > limit ? <button className="btn btn-ghost" onClick={() => setLimit(limit + 10)}>Показать ещё <ChevronDown size={15}/></button> : <span className="content-all-shown"><Check size={13}/> Все публикации</span>}</div>}
    </div>}
  </div>;
}
