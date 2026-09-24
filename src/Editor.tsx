import { useRef, useState } from 'react';
import { Bold, CalendarDays, Check, Clock3, Copy, Eye, Film, Image, Italic, List, MousePointer2, Plus, Sparkles, Trash2, UserRoundPlus, X } from 'lucide-react';
import { formatNumber, makePost, platformMeta } from './model';
import type { Platform, Post, PostStatus } from './model';
import { useWorkspace } from './store';
import { Avatar, DatePicker, Modal, PlatformIcon, Select, StatusBadge, TimePicker } from './ui';
import SocialPreview from './SocialPreview';
import './content.css';
import { getPolicy } from './admin-data';
import { protectBrand } from './brain-data';
import ContentHealth from './ContentHealth';

const platforms = Object.keys(platformMeta) as Platform[];
const limits: Partial<Record<Platform, number>> = {telegram: 4096, instagram: 2200, vk: 16384, youtube: 5000, threads: 500};
function adaptText(text: string, platform: Platform) {
  const clean = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  if (platform === 'instagram') return clean.replace(/\n\n0([1-3])\./g, '\n\n$1.');
  if (platform === 'youtube') return clean.replace(/в комментариях\./g, 'в комментариях к видео.');
  return platform === 'telegram' ? text : clean;
}
function platformBody(post: Post, platform: Platform) {return post.platformBodies?.[platform] ?? adaptText(post.body, platform);}
function copyText(text: string, notify: (message: string) => void) {void navigator.clipboard.writeText(text).then(() => notify('Текст скопирован'), () => notify('Не удалось скопировать текст.'));}

export default function Editor() {
  const {editorOpen, editingPost, closeEditor} = useWorkspace();
  if (!editorOpen) return null;
  const published = editingPost?.status === 'published';
  return <Modal title={published ? 'Публикация' : editingPost ? 'Редактирование поста' : 'Новая публикация'} onClose={closeEditor} wide={!published}>{published && editingPost ? <PublishedPost key={editingPost.id} post={editingPost}/> : <EditorForm key={editingPost?.id || 'new-post'} initial={editingPost}/>}</Modal>;
}

function PublishedPost({post}: {post: Post}) {
  const {brand, openEditor, notify} = useWorkspace();
  const [platform, setPlatform] = useState<Platform>(post.platforms[0] || 'telegram');
  const body = platformBody(post, platform);
  const date = new Date(`${post.date}T${post.time}:00+03:00`).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul'});
  return <div className="published-detail">
    <div className="published-detail-meta"><div><StatusBadge status="published"/><span>{date} · {post.time}</span></div>{post.platforms.length > 1 ? <Select aria-label="Площадка публикации" value={platform} onChange={value => setPlatform(value as Platform)} options={post.platforms.map(value => ({value, label: platformMeta[value].name}))}/> : <span className="published-platform-label"><PlatformIcon platform={platform} size={21}/>{platformMeta[platform].name}</span>}</div>
    <div className="published-preview-stage"><SocialPreview platform={platform} body={body} title={post.title} visual={post.media} brandName={brand.name} views={post.views}/></div>
    <div className="published-performance">{[{label: 'Просмотры', value: post.views, icon: Eye}, {label: 'Переходы', value: post.clicks, icon: MousePointer2}, {label: 'Регистрации', value: post.registrations, icon: UserRoundPlus}].map(({label, value, icon: Icon}) => <div key={label}><span><Icon size={14}/>{label}</span><strong>{formatNumber(value)}</strong></div>)}</div>
    <div className="published-engagement"><span>{formatNumber(post.reactions)} реакций</span><span>{formatNumber(post.comments)} комментариев</span><span>{formatNumber(post.shares)} репостов</span></div>
    <div className="published-footer"><button className="btn btn-ghost" onClick={() => copyText(body, notify)}><Copy size={15}/> Копировать текст</button><button className="btn btn-primary" onClick={() => openEditor(makePost(post.title, {body: post.body, platformBodies: post.platformBodies, platforms: [...post.platforms], format: post.format, topic: post.topic, cover: post.cover, goal: post.goal, media: post.media, videoScript: post.videoScript}))}><Plus size={15}/> Создать на основе</button></div>
  </div>;
}

function EditorForm({initial}: {initial: Post | null}) {
  const {posts, addPost, updatePost, deletePost, closeEditor, notify, brand} = useWorkspace();
  const [post, setPost] = useState<Post>(() => initial ? {...initial, platforms: [...initial.platforms]} : makePost(''));
  const [previewPlatform, setPreviewPlatform] = useState<Platform>(post.platforms[0] || 'telegram');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const existing = posts.some(item => item.id === post.id);
  const patch = (value: Partial<Post>) => {setPost(current => ({...current, ...value, ...(value.body !== undefined ? {platformBodies: undefined} : {})}));setError('');};
  const previewBody = platformBody(post, previewPlatform);
  const previewLimit = limits[previewPlatform];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const togglePlatform = (platform: Platform) => {
    const next = post.platforms.includes(platform) ? post.platforms.filter(value => value !== platform) : [...post.platforms, platform];
    patch({platforms: next});
    if (!next.includes(previewPlatform)) setPreviewPlatform(next[0] || platform);
  };
  const wrapSelection = (before: string, after: string) => {
    const field = bodyRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selection = post.body.slice(start, end) || 'текст';
    patch({body: post.body.slice(0, start) + before + selection + after + post.body.slice(end)});
    requestAnimationFrame(() => {field.focus();field.setSelectionRange(start + before.length, start + before.length + selection.length);});
  };
  const save = () => {
    if (!post.title.trim()) {setError('Добавьте название публикации.');return;}
    if (!post.platforms.length) {setError('Выберите хотя бы одну площадку.');return;}
    if (post.status !== 'draft' && !post.body.trim()) {setError('Добавьте текст перед согласованием или планированием.');return;}
    const tooLong = post.platforms.find(platform => limits[platform] !== undefined && platformBody(post, platform).trim().length > limits[platform]!);
    if (post.status !== 'draft' && tooLong) {setError(`Текст превышает лимит ${platformMeta[tooLong].name}: ${formatNumber(limits[tooLong]!)} символов.`);return;}
    const protection=protectBrand(post.body,post.title);
    if(post.status!=='draft'&&(!protection.allowed||protection.issues.some(i=>i.code==='unsourced-number'))){setError(protection.issues[0]?.message??'Проверьте правила бренда');return;}
    const policy=getPolicy();
    if (post.status !== 'draft' && policy.requireMedia && !post.media) {setError('Добавьте медиа: это обязательное правило компании.');return;}
    if (post.status === 'scheduled' && policy.requireApproval && initial?.status !== 'approved' && initial?.status !== 'scheduled') {setError('Сначала согласуйте публикацию.');return;}
    if (post.status === 'scheduled' && posts.filter(p=>p.id!==post.id&&p.status==='scheduled'&&p.date===post.date).length >= policy.maxPerDay) {setError(`Лимит компании: ${policy.maxPerDay} публикаций в день.`);return;}
    const scheduledAt = new Date(`${post.date}T${post.time}:00+03:00`).getTime();
    if (post.status === 'scheduled' && (!post.date || !post.time || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now())) {setError('Выберите будущую дату и время публикации.');return;}
    const platformBodies = Object.fromEntries(post.platforms.map(platform => [platform, platformBody(post, platform).trim()])) as Partial<Record<Platform, string>>;
    const finalPost = {...post, title: post.title.trim(), body: post.body.trim(), platformBodies, planned: post.status === 'scheduled' || post.planned};
    if (existing) updatePost(post.id, finalPost); else addPost(finalPost);
    closeEditor();
    notify(post.status === 'scheduled' ? 'Публикация добавлена в контент-план' : post.status === 'approved' ? 'Публикация согласована' : 'Черновик сохранён');
  };
  const topics = Array.from(new Set(['Продукт', 'Экспертиза', 'Команда', 'Кейсы', 'Новости', post.topic]));
  const formats = Array.from(new Set(['Пост', 'Карусель', 'Видео', 'История', post.format]));
  return <div className="editor-shell editor-v3">
    <div className="editor-columns"><div className="editor-main">
      <div className="editor-label-row"><label className="editor-field-label" htmlFor="post-title">Название</label>{post.abTest && <span className="editor-ab-mark">A/B</span>}</div>
      <input id="post-title" className="editor-title-input" value={post.title} onChange={event => patch({title: event.target.value})} placeholder="О чём расскажем?" autoFocus/>
      <div className="editor-classification"><div><span>Формат</span><Select aria-label="Формат публикации" value={post.format} onChange={value => patch({format: value})} options={formats.map(value => ({value, label: value}))}/></div><div><span>Тема</span><Select aria-label="Тема публикации" value={post.topic} onChange={value => patch({topic: value})} options={topics.map(value => ({value, label: value}))}/></div></div>
      <div className="editor-label-row"><label className="editor-field-label" htmlFor="post-body">Текст публикации</label><span className="editor-field-hint">{platformMeta[previewPlatform].name}</span></div>
      <div className="editor-writing"><div className="editor-format-toolbar"><button title="Жирный текст" aria-label="Жирный текст" onClick={() => wrapSelection('**', '**')}><Bold size={16}/></button><button title="Курсив" aria-label="Курсив" onClick={() => wrapSelection('_', '_')}><Italic size={16}/></button><span/><button title="Добавить пункт списка" aria-label="Добавить пункт списка" onClick={() => wrapSelection('\n• ', '')}><List size={17}/></button></div><textarea id="post-body" ref={bodyRef} value={post.body} onChange={event => patch({body: event.target.value})} placeholder="Начните с главного. Что вы хотите рассказать?"/><div className="editor-writing-bottom"><span>{post.body.trim() ? post.body.trim().split(/\s+/).length : 0} слов</span><span className={previewLimit && previewBody.length > previewLimit ? 'editor-over-limit' : ''}>{formatNumber(previewBody.length)}{previewLimit ? ` / ${formatNumber(previewLimit)}` : ' символов'}</span></div></div>
      {post.media && <div className="editor-media-attachment">{post.media.kind === 'image' ? <img src={post.media.url} alt=""/> : <span className="editor-media-video"><Film size={19}/></span>}<span><strong>{post.media.kind === 'image' ? 'Изображение' : 'Видео'}</strong><small>{post.media.format}</small></span>{post.media.kind === 'image' ? <Image size={16}/> : <Film size={16}/>}<button className="icon-button" aria-label="Удалить медиа из публикации" onClick={() => patch({media: undefined})}><X size={16}/></button></div>}
      {post.videoScript && <details className="editor-script"><summary>Сценарий видео <span>{post.videoScript.scenes.reduce((sum, scene) => sum + scene.duration, 0)} сек.</span></summary><div>{post.videoScript.scenes.map((scene, index) => <section key={`${scene.heading}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{scene.heading}<small>{scene.duration} сек.</small></h3><p>{scene.text}</p></div></section>)}</div></details>}
      <div className="editor-label-row editor-platform-label"><span className="editor-field-label">Площадки</span></div><div className="editor-platform-selection">{platforms.map(platform => <button className={post.platforms.includes(platform) ? 'is-selected' : ''} key={platform} aria-pressed={post.platforms.includes(platform)} onClick={() => togglePlatform(platform)}><PlatformIcon platform={platform} size={23}/><span>{platformMeta[platform].name}</span>{post.platforms.includes(platform) && <Check size={13}/>}</button>)}</div>
      <ContentHealth title={post.title} body={post.body} media={post.media} postId={post.id} goal={post.goal} onChange={body=>patch({body})}/><div className="editor-brand-note"><span className="editor-brand-spark"><Sparkles size={14}/></span><span>Голос бренда<span>{brand.name} · {brand.tone}</span></span><span className="editor-brand-rules" title={brand.rules}>{brand.rules}</span></div>
    </div><aside className="editor-side">
      <div className="editor-preview-heading"><span>Предпросмотр</span><Select className="editor-preview-select" aria-label="Площадка предпросмотра" value={previewPlatform} onChange={value => setPreviewPlatform(value as Platform)} options={(post.platforms.length ? post.platforms : [previewPlatform]).map(value => ({value, label: platformMeta[value].name}))}/></div>
      <div className="editor-native-preview"><SocialPreview platform={previewPlatform} body={previewBody} title={post.title} visual={post.media} brandName={brand.name}/></div>
      <div className="editor-planning"><label className="editor-field-label" htmlFor="post-status">Этап публикации</label><Select className="editor-stage-select" id="post-status" value={post.status} onChange={value => patch({status: value as PostStatus})} options={[{value: 'draft', label: 'Черновик'}, {value: 'approved', label: 'Согласовано'}, {value: 'scheduled', label: 'Запланировано'}]}/>{post.status === 'scheduled' && <><div className="editor-date-fields"><div><span><CalendarDays size={14}/> Дата</span><DatePicker aria-label="Дата публикации" min={today} value={post.date} onChange={value => patch({date: value})}/></div><div><span><Clock3 size={14}/> Время</span><TimePicker aria-label="Время публикации" value={post.time} onChange={value => patch({time: value})}/></div></div><span className="editor-timezone">Стамбул · UTC+3</span></>}</div>
      <div className="editor-owner"><Avatar name={post.author} size={25}/><span>{post.author}</span><span>Автор</span></div>
    </aside></div>
    {error && <p role="alert" className="editor-error">{error}</p>}
    <div className="editor-footer"><div>{existing && (deleteConfirm ? <div className="editor-delete-confirm"><span>Удалить публикацию?</span><button onClick={() => {deletePost(post.id);closeEditor();notify('Публикация удалена');}}>Удалить</button><button onClick={() => setDeleteConfirm(false)}>Отмена</button></div> : <button className="editor-delete" onClick={() => setDeleteConfirm(true)}><Trash2 size={16}/><span>Удалить</span></button>)}</div><div><button className="btn btn-ghost" onClick={closeEditor}>Отмена</button><button className="btn btn-primary" onClick={save}>{post.status === 'scheduled' ? <CalendarDays size={16}/> : <Check size={16}/>} {post.status === 'draft' ? 'Сохранить черновик' : post.status === 'approved' ? 'Согласовать' : 'Запланировать'}</button></div></div>
  </div>;
}
