import { useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, Check, Clock3, FilePenLine, MousePointer2, Plus, Users } from 'lucide-react';
import { useWorkspace } from './store';
import { formatNumber, platformMeta, shortNumber, TODAY } from './model';
import type { Platform, Post } from './model';
import { PlatformIcon, Select } from './ui';
import { isLabrika, productName } from './runtime';
import './dashboard.css';

type Period = 'month' | 'week';
type Metric = 'views' | 'clicks' | 'registrations';
const metrics: Record<Metric, string> = { views: 'Просмотры', clicks: 'Переходы', registrations: 'Регистрации' };
const percent = (value: number, total: number) => total ? value / total * 100 : 0;
const formatPercent = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function daysBefore(days: number, today: string) { const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() - days); return isoDate(date); }
function periodLabel(start: string, end: string) {
  const first = new Date(`${start}T12:00:00`), last = new Date(`${end}T12:00:00`);
  const firstLabel = start.slice(0, 7) === end.slice(0, 7) ? String(first.getDate()) : first.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'}).replace('.', '');
  return `${firstLabel}–${last.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}, ${last.getFullYear()}`;
}

export default function Dashboard() {
  const { posts, navigate, setContentFilter, openEditor } = useWorkspace();
  const [period, setPeriod] = useState<Period>('month');
  const [metric, setMetric] = useState<Metric>('views');
  const today = isLabrika ? new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Istanbul'}) : TODAY;
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = daysBefore(6, today);
  const firstDate = period === 'month' ? monthStart : weekStart;
  const published = posts.filter(post => post.status === 'published' && post.date >= firstDate && post.date <= today);
  const totals = published.reduce((sum, post) => ({ views: sum.views + post.views, clicks: sum.clicks + post.clicks, registrations: sum.registrations + post.registrations }), { views: 0, clicks: 0, registrations: 0 });
  const drafts = posts.filter(post => post.status === 'draft').length;
  const approved = posts.filter(post => post.status === 'approved').length;
  const scheduled = posts.filter(post => post.status === 'scheduled').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const conversion = totals.clicks > 0 ? percent(totals.registrations, totals.clicks) : null;
  const showContent = (status: string) => { setContentFilter(status); navigate('content'); };
  const channels = (Object.keys(platformMeta) as Platform[]).map(platform => ({ platform, registrations: published.filter(post => post.platforms.length === 1 && post.platforms[0] === platform).reduce((total, post) => total + post.registrations, 0) })).filter(channel=>channel.registrations>0).sort((a, b) => b.registrations - a.registrations);
  const combinedRegistrations = published.filter(post => post.platforms.length !== 1).reduce((total, post) => total + post.registrations, 0);

  return <div className="dash-home" aria-label={`Обзор ${productName}`}>
    <div className="page-heading dash-page-heading">
      <h1 className="page-title">Обзор</h1>
      <div className="dash-heading-actions">
        <label className="dash-date-control"><CalendarDays size={16} /><Select aria-label="Период дашборда" value={period} onChange={value => setPeriod(value as Period)} options={[{value:"month",label:periodLabel(monthStart,today)},{value:"week",label:periodLabel(weekStart,today)}]}/></label>
        <button className="dash-create" onClick={() => openEditor()}><Plus size={17} />Создать пост</button>
      </div>
    </div>

    <div className="dash-layout">
      <div className="dash-main-grid">
        <section className="dash-card dash-stages">
          <div className="dash-card-heading"><h2>Публикации</h2><CircleLink label="Открыть публикации" onClick={() => showContent('all')} /></div>
          <div className="dash-stage-stack">
            <button className="dash-stage dash-stage-black" onClick={() => showContent('draft')}><span className="dash-stage-icon"><FilePenLine size={20} strokeWidth={1.6} /></span><span className="dash-stage-copy"><strong>Черновики</strong><small>В работе</small></span><strong className="dash-stage-number">{drafts}</strong></button>
            <button className="dash-stage dash-stage-lime" onClick={() => showContent('scheduled')}><span className="dash-stage-icon"><Clock3 size={21} strokeWidth={1.7} /></span><span className="dash-stage-copy"><strong>В плане</strong><small>Готовы к выходу</small></span><strong className="dash-stage-number">{scheduled.length}</strong></button>
            <button className="dash-stage dash-stage-white" onClick={() => showContent('published')}><span className="dash-stage-icon"><Check size={22} strokeWidth={1.7} /></span><span className="dash-stage-copy"><strong>Опубликовано</strong><small>{period === 'month' ? isLabrika ? 'За месяц' : 'За сентябрь' : 'За неделю'}</small></span><strong className="dash-stage-number">{published.length}</strong></button>
          </div>
          <button className="dash-approval-link" onClick={() => showContent('approved')}><span><i />{approved} согласовано</span><ArrowRight size={14} /></button>
        </section>

        <section className="dash-card dash-growth">
          <div className="dash-card-heading"><h2><span className="dash-chart-mark"><ChartNoAxesColumnIncreasing size={16} strokeWidth={1.5} /></span>Динамика</h2><div className="dash-period-tabs" role="group" aria-label="Период графика"><button className={period === 'week' ? 'active' : ''} aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Неделя</button><button className={period === 'month' ? 'active' : ''} aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Месяц</button></div></div>
          <div className="dash-chart-summary"><strong>{published.length ? formatNumber(totals[metric]) : '—'}</strong><label><Select aria-label="Показатель графика" value={metric} onChange={value => setMetric(value as Metric)} options={Object.entries(metrics).map(([value,label])=>({value,label}))}/></label></div>
          {published.length ? <GrowthBars posts={published} period={period} metric={metric} firstDate={firstDate} today={today} /> : <div className="dash-empty" style={{flex: 1, flexDirection: 'column'}}><ChartNoAxesColumnIncreasing size={30} strokeWidth={1.4}/><span>Данных за период пока нет</span></div>}
          {published.length > 0 && <div className="dash-chart-footer"><span><i />{metrics[metric]}</span><span>Накопленным итогом</span></div>}
        </section>

        <section className="dash-card dash-upcoming">
          <div className="dash-card-heading"><h2>Ближайшие публикации <span className="dash-count">{scheduled.length}</span></h2><button className="dash-calendar-link" onClick={() => navigate('calendar')}>Календарь<ArrowUpRight size={15} /></button></div>
          <div className="dash-table-scroll"><table className="dash-posts-table"><thead><tr><th>Публикация</th><th>Дата</th><th>Время</th><th>Площадка</th></tr></thead><tbody>{scheduled.slice(0, 3).map(post => <tr key={post.id} onClick={() => openEditor(post)}><td><button className="dash-post-title" onClick={event => { event.stopPropagation(); openEditor(post); }}><span className={`dash-post-symbol dash-symbol-${post.cover}`}><PlatformIcon platform={post.platforms[0]} size={32} /></span><span><strong>{post.title}</strong><small>{post.format}</small></span></button></td><td>{post.date === today ? 'Сегодня' : new Date(`${post.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}</td><td>{post.time}</td><td><span className="dash-table-platform">{platformMeta[post.platforms[0]].name}</span><ArrowUpRight className="dash-post-arrow" size={14} /></td></tr>)}</tbody></table></div>
          {!scheduled.length && <div className="dash-empty"><CalendarDays size={24} /><span>Запланируйте первую публикацию</span><button onClick={() => openEditor()}>Создать пост<Plus size={14} /></button></div>}
        </section>
      </div>

      <aside className="dash-side-grid">
        <section className="dash-card dash-result">
          <div className="dash-card-heading"><h2>Результат</h2><CircleLink label="Открыть аналитику" onClick={() => navigate('analytics')} /></div>
          <span className="dash-result-label">Новые пользователи</span>
          <div className="dash-result-number"><strong>{published.length ? formatNumber(totals.registrations) : '—'}</strong><span className="dash-result-icon"><Users size={19} strokeWidth={1.5} /></span></div>
          <div className="dash-result-divider" />
          <div className="dash-result-conversion"><span>Конверсия в регистрацию</span><strong>{conversion === null ? '—' : formatPercent(conversion)}</strong></div>
          {conversion !== null ? <div className="dash-conversion-track" role="meter" aria-label="Конверсия переходов в регистрации" aria-valuenow={Math.min(conversion, 100)} aria-valuetext={formatPercent(conversion)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(conversion, 100)}%` }} /><i style={{ left: `${Math.min(conversion, 94)}%` }}><span /><span /><span /></i></div> : <div className="dash-conversion-track" aria-hidden="true"/>}
          <div className="dash-conversion-caption"><span>{conversion === null ? 'Появится после первых переходов' : 'Из перехода в регистрацию'}</span>{conversion !== null && <ArrowUpRight size={15} />}</div>
          <button className="dash-clicks-card" onClick={() => navigate('analytics')}><span className="dash-clicks-icon"><MousePointer2 size={17} strokeWidth={1.6} /></span><span><small>Переходы на платформу</small><strong>{published.length ? formatNumber(totals.clicks) : '—'}</strong></span><ArrowUpRight size={17} /></button>
        </section>

        <section className="dash-card dash-platforms">
          <div className="dash-card-heading"><h2>Площадки</h2><CircleLink label="Открыть аналитику площадок" onClick={() => navigate('analytics')} /></div>
          <div className="dash-platform-caption"><span>Регистрации</span><span>Доля</span></div>
          <div className="dash-platform-list">{channels.map(({ platform, registrations }) => <button className="dash-platform-row" key={platform} onClick={() => navigate('analytics')}><PlatformIcon platform={platform} size={29} /><span className="dash-platform-name">{platformMeta[platform].name}</span><strong>{formatNumber(registrations)}</strong><span className="dash-platform-share">{formatPercent(percent(registrations, totals.registrations))}</span></button>)}</div>
          {combinedRegistrations > 0 && <button className="dash-platform-row" onClick={() => navigate('analytics')} title="Общий результат кросспостов без распределения по площадкам"><Users size={23}/><span className="dash-platform-name">Кросспосты</span><strong>{formatNumber(combinedRegistrations)}</strong><span className="dash-platform-share">{formatPercent(percent(combinedRegistrations, totals.registrations))}</span></button>}
          {!channels.length && !combinedRegistrations && <div className="dash-empty" style={{padding: '24px 0', fontSize: 11}}><span>{published.length ? 'Регистраций за период пока нет' : 'Пока нет данных по площадкам'}</span></div>}
        </section>
      </aside>
    </div>
  </div>;
}

function CircleLink({ label, onClick }: { label: string; onClick: () => void }) { return <button className="dash-circle-link" aria-label={label} onClick={onClick}><ArrowUpRight size={19} strokeWidth={1.4} /></button>; }

function GrowthBars({ posts, period, metric, firstDate, today }: { posts: Post[]; period: Period; metric: Metric; firstDate: string; today: string }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const earliest = posts.length ? [...posts].sort((a, b) => a.date.localeCompare(b.date))[0].date : firstDate;
  const start = new Date(`${period === 'week' ? firstDate : earliest}T12:00:00`);
  const end = new Date(`${today}T12:00:00`);
  const dayCount = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
  const pointCount = Math.min(period === 'week' ? 7 : 6, dayCount + 1);
  const values = Array.from({ length: pointCount }, (_, index) => {
    const day = new Date(start); day.setDate(day.getDate() + (period === 'week' ? index : Math.round((index + 1) * dayCount / pointCount)));
    const date = isoDate(day);
    return { date, value: posts.filter(post => post.date <= date).reduce((total, post) => total + post[metric], 0) };
  });
  const width = 460; const height = 223; const left = 35; const right = 8; const bottom = 28; const top = 12;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(...values.map(point => point.value), 1);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const step = magnitude / 5;
  const limit = Math.ceil(maximum / step) * step;
  const slot = (width - left - right) / Math.max(pointCount, 1);
  const barWidth = Math.min(slot * .7, 44);
  const selected = hover !== null && values[hover] ? hover : Math.max(0, pointCount - 2);
  return <div className="dash-bars" onMouseLeave={() => setHover(null)}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Накопленные ${metrics[metric].toLowerCase()}. ${values.map(point => `${point.date}: ${formatNumber(point.value)}`).join('; ')}`}><defs><pattern id={`dash-stripes-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(37)"><line x1="0" x2="0" y1="0" y2="5" stroke="#ffffff" strokeOpacity=".12" strokeWidth="1" /></pattern></defs>{[0, 1, 2, 3, 4].map(index => <g key={index}><line x1={left} x2={width - right} y1={top + plotHeight * index / 4} y2={top + plotHeight * index / 4} stroke="#b9bcc3" strokeDasharray="3 4" strokeWidth=".75" /><text x={left - 9} y={top + plotHeight * index / 4 + 3.5} textAnchor="end" fontSize="9" fill="#686b71">{shortNumber(limit * (4 - index) / 4).replace(' тыс.', 'к')}</text></g>)}{values.map((point, index) => {
    const x = left + slot * index + (slot - barWidth) / 2;
    const barHeight = point.value / limit * plotHeight;
    const y = height - bottom - barHeight;
    return <g key={`${point.date}-${index}`} className="dash-bar-group" onMouseEnter={() => setHover(index)}><rect x={x} y={y} width={barWidth} height={barHeight} rx={Math.min(barWidth / 2, barHeight / 2)} fill={index === selected ? '#367cfa' : '#86b5ff'} /><rect x={x} y={y} width={barWidth} height={barHeight} rx={Math.min(barWidth / 2, barHeight / 2)} fill={`url(#dash-stripes-${id})`} /><text x={x + barWidth / 2} y={height - 8} fontSize="10" fill="#4b4e54" textAnchor="middle">{new Date(`${point.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}</text><rect className="dash-bar-hit" x={left + slot * index} y={top} width={slot} height={plotHeight} fill="transparent" tabIndex={0} aria-label={`${new Date(`${point.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${formatNumber(point.value)}`} onFocus={() => setHover(index)} onBlur={() => setHover(null)}><title>{formatNumber(point.value)} · {point.date}</title></rect></g>;
  })}</svg>{hover !== null && values[hover] && <div className="dash-bar-tooltip" style={{ left: `${Math.min(Math.max((left + slot * (hover + .5)) / width * 100, 16), 84)}%` }}><strong>{formatNumber(values[hover].value)}</strong><span>{new Date(`${values[hover].date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span></div>}</div>;
}
