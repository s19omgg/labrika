import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Sparkles, Undo2, X } from 'lucide-react';
import { makePost, platformMeta, TODAY } from './model';
import type { Platform, Post } from './model';
import { useWorkspace } from './store';
import { DatePicker, Modal, PlatformIcon, Select, StatusBadge } from './ui';
import './planning.css';
import { getPolicy } from './admin-data';
import './planning-v3.css';

const platforms = Object.keys(platformMeta) as Platform[];
const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const planTopics = [
  ['Что меняется, когда у контента появляется цель', 'Экспертиза', 'Пост'],
  ['Наш продукт: три детали, которые экономят время', 'Продукт', 'Карусель'],
  ['Один рабочий день с командой LABRIKA', 'Команда', 'Видео'],
  ['Пять вопросов перед запуском новой рубрики', 'Экспертиза', 'Карусель'],
  ['Как выглядит путь от идеи до результата', 'Продукт', 'Пост'],
  ['Разбираем частый вопрос от клиентов', 'Продукт', 'Видео'],
  ['Что мы узнали на этой неделе', 'Команда', 'Пост'],
  ['Чек-лист полезного поста', 'Экспертиза', 'Карусель'],
  ['Маленькая привычка, которая помогает расти', 'Экспертиза', 'Пост'],
  ['Обновление, которое вы просили', 'Продукт', 'Видео'],
  ['Как мы выбираем, что делать дальше', 'Команда', 'Пост'],
  ['Почему одна метрика не расскажет всю историю', 'Экспертиза', 'Карусель'],
  ['Первый результат: с чего начать', 'Продукт', 'Пост'],
  ['История решения: от проблемы к улучшению', 'Продукт', 'Видео'],
  ['Наши любимые инструменты для работы', 'Команда', 'Карусель'],
  ['Как понять, что тема откликается аудитории', 'Экспертиза', 'Пост'],
  ['Три сценария использования платформы', 'Продукт', 'Карусель'],
  ['Знакомство с человеком за продуктом', 'Команда', 'Видео'],
  ['Что стоит перестать делать в контенте', 'Экспертиза', 'Пост'],
  ['Как мы работаем с вашими идеями', 'Продукт', 'Карусель'],
  ['Итоги недели в пяти наблюдениях', 'Команда', 'Пост'],
  ['Контент-эксперимент: проверяем новую гипотезу', 'Экспертиза', 'Видео'],
  ['Ответы на три важных вопроса', 'Продукт', 'Карусель'],
  ['Что помогает нам сохранять фокус', 'Команда', 'Пост'],
  ['От охвата к действию: разбираем пример', 'Экспертиза', 'Карусель'],
  ['Одна функция — один полезный сценарий', 'Продукт', 'Видео'],
  ['Урок, который мы заберём с собой', 'Команда', 'Пост'],
  ['Как выбрать формат под вашу задачу', 'Экспертиза', 'Карусель'],
  ['Показываем продукт в работе', 'Продукт', 'Видео'],
  ['Месяц в результатах: что получилось', 'Команда', 'Пост'],
];

export default function Calendar() {
  const { posts, addPost, updatePost, openEditor, notify, section } = useWorkspace();
  const [month, setMonth] = useState(new Date(`${TODAY}T12:00:00`));
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [duration, setDuration] = useState(7);
  const [startDate, setStartDate] = useState(TODAY);
  const [planPlatform, setPlanPlatform] = useState<Platform | 'all'>('all');
  const week = section === 'week';
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<{post: Post; x: number; y: number} | null>(null);
  const [lastMove, setLastMove] = useState<{id: string; date: string; planned?: boolean; next: string} | null>(null);
  const nativeDrag = useRef<string | null>(null);
  const suppressClick = useRef(0);
  const hold = useRef<{post: Post; x: number; y: number; pointer: number; node: HTMLButtonElement; timer: number; active: boolean; target: string | null} | null>(null);
  const moveRef = useRef<(id: string, date: string) => void>(() => {});

  function movePost(id: string, date: string) {
    const post = posts.find(item => item.id === id);
    if (!post || post.status === 'published' || post.date === date) return;
    if (post.status === 'scheduled' && posts.filter(p=>p.id!==id&&p.status==='scheduled'&&p.date===date).length>=getPolicy().maxPerDay) { notify('Достигнут дневной лимит публикаций'); return; }
    if (post.status === 'scheduled' && new Date(`${date}T${post.time}:00+03:00`).getTime() <= Date.now()) { notify('Выберите будущую дату и время публикации'); return; }
    setLastMove({id, date: post.date, planned: post.planned, next: date});
    updatePost(id, {date, planned: true});
  }
  moveRef.current = movePost;
  function clearDrag() {
    if (hold.current) { window.clearTimeout(hold.current.timer); if (hold.current.node.hasPointerCapture(hold.current.pointer)) hold.current.node.releasePointerCapture(hold.current.pointer); }
    hold.current = null; nativeDrag.current = null;
    setDragging(null); setDropDate(null); setPreview(null);
    document.body.classList.remove('calendar-is-dragging');
  }
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = hold.current;
      if (!current || current.pointer !== event.pointerId) return;
      if (!current.active) { if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 9) { window.clearTimeout(current.timer); hold.current = null; } return; }
      event.preventDefault();
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-calendar-date]');
      current.target = cell?.dataset.calendarDate || null;
      setDropDate(current.target); setPreview({post: current.post, x: event.clientX, y: event.clientY});
      if (event.clientY < 80) window.scrollBy(0, -13);
      if (event.clientY > window.innerHeight - 60) window.scrollBy(0, 13);
      const scroll = document.querySelector<HTMLElement>('.calendar-v3 .calendar-scroll');
      if (scroll) { const rect = scroll.getBoundingClientRect(); if (event.clientX > rect.right - 30) scroll.scrollLeft += 12; if (event.clientX < rect.left + 30) scroll.scrollLeft -= 12; }
    };
    const end = (event: PointerEvent) => {
      const current = hold.current;
      if (!current || current.pointer !== event.pointerId) return;
      if (current.active) { event.preventDefault(); suppressClick.current = Date.now() + 600; if (current.target) moveRef.current(current.post.id, current.target); }
      clearDrag();
    };
    const cancel = (event?: Event) => { if (event?.type === 'pointercancel' && nativeDrag.current) return; if (hold.current?.active) suppressClick.current = Date.now() + 600; clearDrag(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('pointermove', move, {passive: false}); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); if (hold.current) window.clearTimeout(hold.current.timer); document.body.classList.remove('calendar-is-dragging'); };
  }, []);
  function startHold(event: ReactPointerEvent<HTMLButtonElement>, post: Post) {
    if (post.status === 'published' || event.button !== 0) return;
    const node = event.currentTarget;
    const pending = {post, x: event.clientX, y: event.clientY, pointer: event.pointerId, node, timer: 0, active: false, target: post.date as string | null};
    pending.timer = window.setTimeout(() => {
      if (hold.current !== pending) return;
      pending.active = true; node.setPointerCapture(pending.pointer);
      setDragging(post.id); setDropDate(post.date); setPreview({post, x: pending.x, y: pending.y});
      document.body.classList.add('calendar-is-dragging');
    }, 230);
    hold.current = pending;
  }
  function startNative(event: DragEvent<HTMLButtonElement>, post: Post) {
    if (post.status === 'published') { event.preventDefault(); return; }
    if (hold.current?.active) { event.preventDefault(); return; }
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null; nativeDrag.current = post.id;
    setDragging(post.id); event.dataTransfer.setData('application/x-ygroup-post', post.id); event.dataTransfer.setData('text/plain', post.id); event.dataTransfer.effectAllowed = 'move';
  }

  const plannedPosts = useMemo(() => posts.filter(post => (post.status === 'scheduled' || post.status === 'published' || post.planned || post.id.startsWith('plan-')) && (platform === 'all' || post.platforms.includes(platform))), [posts, platform]);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstDay = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weekStart = new Date(month); weekStart.setDate(month.getDate() - (month.getDay() + 6) % 7);
  const cells = week ? Array.from({length: 7}, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)) : Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - firstDay + 1));
  const monthPosts = plannedPosts.filter(post => week ? post.date >= toISO(cells[0]) && post.date <= toISO(cells[6]) : post.date.startsWith(toISO(month).slice(0, 7)));
  const dayPosts = selectedDay ? plannedPosts.filter(post => post.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time)) : [];
  const moveMonth = (offset: number) => setMonth(week ? new Date(month.getFullYear(), month.getMonth(), month.getDate() + offset * 7) : new Date(month.getFullYear(), month.getMonth() + offset, 1));

  function generatePlan() {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { notify('Выберите дату начала плана'); return; }
    const channelScores = platforms.map(channel => ({ channel, score: posts.filter(post => post.status === 'published' && post.platforms.includes(channel)).reduce((sum, post) => sum + post.registrations, 0) })).sort((a, b) => b.score - a.score);
    for (let i = 0; i < duration; i++) {
      const day = new Date(`${startDate}T12:00:00`);
      day.setDate(day.getDate() + i);
      const channel = planPlatform === 'all' ? channelScores[i % channelScores.length].channel : planPlatform;
      const bestPost = posts.filter(post => post.status === 'published' && post.platforms.includes(channel)).sort((a, b) => b.registrations - a.registrations)[0];
      const [title, topic, format] = planTopics[i % planTopics.length];
      addPost(makePost(title, {
        id: `plan-${crypto.randomUUID()}`, planned: true, date: toISO(day), time: bestPost?.time || '12:00', platforms: [channel], topic, format,
        body: `${title}\n\nТезис: сформулируйте главную мысль материала.\n\nПример: добавьте историю, факт или кейс команды.\n\nСледующий шаг: предложите читателю одно понятное действие.`,
        cover: ['lavender', 'mint', 'blue', 'peach'][i % 4],
      }));
    }
    setMonth(new Date(`${startDate}T12:00:00`));
    setPlatform('all');
    setPlanOpen(false);
    notify(`Создано ${duration} черновиков`);
  }

  return <div className={`planning-page calendar-v3${week ? ' calendar-week-view' : ''}`}>
    <div className="page-heading">
      <h1 className="page-title">Контент-план</h1>
      <button className="btn btn-primary" onClick={() => setPlanOpen(true)}><Sparkles size={16} /> Создать план</button>
    </div>
    <div className="calendar-summary">
      <span><i className="calendar-dot published" />{monthPosts.filter(post => post.status === 'published').length} опубликовано</span>
      <span><i className="calendar-dot scheduled" />{monthPosts.filter(post => post.status === 'scheduled').length} запланировано</span>
      {monthPosts.some(post => post.status === 'draft') && <span><i className="calendar-dot draft" />{monthPosts.filter(post => post.status === 'draft').length} в работе</span>}
    </div>
    <section className="panel calendar-panel" aria-label="Календарь публикаций">
      <div className="calendar-toolbar">
        <div className="calendar-month-navigation">
          <h2>{week ? `${dateLabel(toISO(cells[0]))} — ${dateLabel(toISO(cells[6]))}` : month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</h2>
          <div className="calendar-arrows"><button className="icon-button" aria-label={week ? 'Предыдущая неделя' : 'Предыдущий месяц'} onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button><button className="icon-button" aria-label={week ? 'Следующая неделя' : 'Следующий месяц'} onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div>
          <button className="btn btn-ghost calendar-today" onClick={() => setMonth(new Date(`${TODAY}T12:00:00`))}>Сегодня</button>
        </div>
        <Select className="calendar-platform-filter" aria-label="Площадка в календаре" value={platform} onChange={value => setPlatform(value as Platform | 'all')} options={[{value: 'all', label: 'Все площадки'}, ...platforms.map(channel => ({value: channel, label: platformMeta[channel].name}))]} />
      </div>
      <div className="calendar-scroll">
        <div className="calendar-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map(day => {
            const iso = toISO(day);
            const isOutside = day.getMonth() !== month.getMonth();
            const events = plannedPosts.filter(post => post.date === iso).sort((a, b) => a.time.localeCompare(b.time));
            return <div className={`calendar-cell${isOutside && !week ? ' outside' : ''}${iso === TODAY ? ' today' : ''}${dragging && dropDate === iso ? ' calendar-drop-target' : ''}`} data-calendar-date={iso} key={iso} onDragOver={event => { if (nativeDrag.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropDate(iso); } }} onDrop={event => { event.preventDefault(); const id = nativeDrag.current || event.dataTransfer.getData('application/x-ygroup-post'); if (id) { movePost(id, iso); suppressClick.current = Date.now() + 600; } clearDrag(); }}>
              <button className="calendar-day-number" aria-current={iso === TODAY ? 'date' : undefined} aria-label={`Открыть ${dateLabel(iso)}`} onClick={() => setSelectedDay(iso)}>{day.getDate()}</button>
              <button className="calendar-day-add" aria-label={`Создать пост на ${dateLabel(iso)}`} onClick={() => openEditor(makePost('', { date: iso, planned: true }))}><Plus size={13} /></button>
              <div className="calendar-events">
                {events.slice(0, week ? events.length : 2).map(post => <CalendarEvent key={post.id} post={post} dragging={dragging === post.id} onPointerDown={event => startHold(event, post)} onDragStart={event => startNative(event, post)} onDragEnd={() => { suppressClick.current = Date.now() + 600; clearDrag(); }} onMove={offset => { const day = new Date(`${post.date}T12:00:00`); day.setDate(day.getDate() + offset); movePost(post.id, toISO(day)); }} onClick={() => { if (Date.now() > suppressClick.current && !hold.current?.active) openEditor(post); }} />)}
                {!week && events.length > 2 && <button className="calendar-more" onClick={() => setSelectedDay(iso)}>Ещё {events.length - 2}</button>}
              </div>
            </div>;
          })}
        </div>
      </div>
      <div className="calendar-footer"><span><CalendarDays size={14} /> Часовой пояс: Стамбул · UTC+3</span></div>
    </section>
    {lastMove && <div className="calendar-move-notice" role="status"><Check size={15} /><span>Перенесено на {dateLabel(lastMove.next)}</span><button onClick={() => { updatePost(lastMove.id, {date: lastMove.date, planned: lastMove.planned}); setLastMove(null); notify('Перенос отменён'); }}><Undo2 size={14} />Отменить</button><button aria-label="Закрыть уведомление о переносе" onClick={() => setLastMove(null)}><X size={14} /></button></div>}
    {preview && createPortal(<div className="calendar-drag-preview" aria-hidden="true" style={{left: preview.x + 14, top: preview.y + 14}}><PlatformIcon platform={preview.post.platforms[0]} size={22} /><strong>{preview.post.title}</strong><span>{dropDate ? dateLabel(dropDate) : 'Выберите день'}</span></div>, document.body)}

    {selectedDay && <Modal title={dateLabel(selectedDay)} onClose={() => setSelectedDay(null)}>
      <div className="calendar-day-dialog">
        {dayPosts.length ? dayPosts.map(post => <button className="day-post-row" key={post.id} onClick={() => { setSelectedDay(null); openEditor(post); }}><span className="day-post-time">{post.time}</span><PlatformIcon platform={post.platforms[0]} size={28} /><span className="day-post-title">{post.title}<span>{platformMeta[post.platforms[0]].name}</span></span><StatusBadge status={post.status} /></button>) : <div className="calendar-empty"><CalendarDays size={32} /><p>День для новых идей</p><span>Публикаций пока нет</span></div>}
        <button className="btn btn-primary calendar-dialog-add" onClick={() => { const date = selectedDay; setSelectedDay(null); openEditor(makePost('', { date, planned: true })); }}><Plus size={16} /> Добавить публикацию</button>
      </div>
    </Modal>}

    {planOpen && <Modal title="Новый контент-план" onClose={() => setPlanOpen(false)}>
      <div className="plan-form">
        <span className="plan-form-label">На сколько дней</span>
        <div className="plan-duration" role="group" aria-label="Длительность контент-плана">{[3, 7, 10, 30].map(days => <button key={days} onClick={() => setDuration(days)} className={duration === days ? 'selected' : ''} aria-pressed={duration === days}><span>{days}</span><small>{days === 3 ? 'дня' : 'дней'}</small>{duration === days && <Check size={14} />}</button>)}</div>
        <div className="plan-form-fields"><div className="plan-form-control"><span>Начало плана</span><DatePicker aria-label="Начало плана" value={startDate} onChange={setStartDate} /></div><div className="plan-form-control"><span>Площадки</span><Select aria-label="Площадки контент-плана" value={planPlatform} onChange={value => setPlanPlatform(value as Platform | 'all')} options={[{value: 'all', label: 'Все площадки'}, ...platforms.map(channel => ({value: channel, label: platformMeta[channel].name}))]} /></div></div>
        
        <button className="btn btn-primary plan-submit" onClick={generatePlan}><Sparkles size={16} /> Создать {duration} черновиков</button>
      </div>
    </Modal>}
  </div>;
}

function CalendarEvent({ post, onClick, onPointerDown, onDragStart, onDragEnd, onMove, dragging }: { post: Post; onClick: () => void; onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void; onDragStart: (event: DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void; onMove: (offset: number) => void; dragging: boolean }) {
  const movable = post.status !== 'published';
  return <button className={`calendar-event ${post.status}${dragging ? ' calendar-event-dragging' : ''}`} onClick={onClick} draggable={movable} onPointerDown={onPointerDown} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={event => {if (movable) event.preventDefault();}} onKeyDown={event => {if (movable && event.altKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {event.preventDefault(); onMove(event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : 7);}}} title={`${post.time} · ${post.title}`}><span className="calendar-event-meta"><PlatformIcon platform={post.platforms[0]} size={14} /><span>{post.time}</span>{post.status === 'published' && <Check size={11} />}</span><span className="calendar-event-title">{post.title}</span></button>;
}
