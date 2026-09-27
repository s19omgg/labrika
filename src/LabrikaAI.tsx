import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check, CheckCheck, CircleHelp, Clock3, Fingerprint, FlaskConical, Layers3, PencilLine, Plus, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useWorkspace } from './store';
import { getLearning, preferenceSummary } from './learning';
import { getBrain, knowledgeLabels, verificationLabels } from './brain-data';
import { formatNumber } from './model';
import { goalOptions } from './media-generation';
import './labrika-ai.css';

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

function Overview({ onCompany, onCreate }: { onCompany: () => void; onCreate: () => void }) {
  return <div className="ai-bento">
    <section className="ai-bento-card ai-intro">
      <span className="ai-card-label"><BrainCircuit size={17} /> Интеллект внутри LABRICA</span>
      <h2>Не с чистого листа.<br />С опытом <em>вашего бизнеса</em></h2>
      <p>Знания о компании, решения команды и результаты контента — основа для следующей публикации.</p>
      <div className="ai-orbit" aria-hidden="true"><div className="ai-orbit-line" /><span className="ai-orbit-node ai-orbit-brand"><BookOpen size={19} /></span><span className="ai-orbit-node ai-orbit-edit"><PencilLine size={19} /></span><span className="ai-orbit-node ai-orbit-result"><TrendingUp size={19} /></span><span className="ai-orbit-core"><BrainCircuit size={39} /></span><span className="ai-orbit-caption">Ваш контекст. Ваша система.</span></div>
      <button className="ai-intro-link" onClick={onCompany}>Что LABRICA знает о вас <ArrowUpRight size={18} /></button>
    </section>
    <section className="ai-bento-card ai-memory">
      <span className="ai-card-label"><BookOpen size={17} /> Brand Memory</span>
      <h3>Помнит главное</h3><p>Продукты, аудиторию и правила бренда. Чтобы не объяснять бизнес заново.</p>
      <div className="ai-memory-stack" aria-hidden="true"><span>Ваш продукт <Check size={14} /></span><span>Ваш голос <Check size={14} /></span><span>Ваши правила <Check size={14} /></span></div>
    </section>
    <section className="ai-bento-card ai-edits">
      <span className="ai-card-label"><PencilLine size={17} /> Edit Learning</span>
      <h3>Правки имеют значение</h3><p>Сравнивает версии текста и сохраняет редакционные предпочтения команды.</p>
      <div className="ai-edit-example" aria-hidden="true"><s>В рамках нашей деятельности</s><ArrowRight size={14} /><strong>Мы делаем</strong></div>
    </section>
    <section className="ai-bento-card ai-performance">
      <span className="ai-card-label"><TrendingUp size={17} /> Performance Learning</span>
      <h3>Видит связь<br />между контентом<br />и результатом</h3><p>Темы, форматы, переходы и регистрации — в общей картине.</p>
      <div className="ai-signal-chart" aria-hidden="true">{[27, 40, 34, 62, 55, 84, 100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}<ArrowUpRight size={26} /></div>
    </section>
    <section className="ai-bento-card ai-preferences">
      <span className="ai-card-label"><Fingerprint size={17} /> Content DNA</span>
      <div className="ai-dna-art" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <i key={index} />)}<Fingerprint size={40} /></div>
      <h3>Узнаваемый<br />голос компании</h3><p>Выбранные варианты, любимая подача и длина текстов складываются в профиль бренда.</p>
    </section>
    <section className="ai-bento-card ai-strategy">
      <span className="ai-card-label"><FlaskConical size={17} /> Strategy & Experiments</span>
      <h3>Опыт — основа.<br />Идеи — движение.</h3><p>Контентный микс и A/B-варианты помогают сравнивать подходы и проверять новое.</p>
      <div className="ai-experiment-art" aria-hidden="true"><span><span>A</span><i /><i /><i /></span><span><span>B</span><i /><i /><i /></span></div>
    </section>
    <section className="ai-bento-card ai-loop">
      <div><span className="ai-card-label"><Layers3 size={17} /> Один непрерывный процесс</span><h3>Опыт остаётся в компании</h3></div>
      <ol>{['Знания', 'Создание', 'Ваши правки', 'Результаты'].map((label, index) => <li key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}{index < 3 ? <ArrowRight size={15} /> : <ArrowDownLeft size={15} />}</li>)}</ol>
      <button className="ai-round-link" aria-label="Перейти к созданию контента" onClick={onCreate}><ArrowUpRight size={22} /></button>
    </section>
  </div>;
}

export default function LabrikaAI() {
  const { brand, posts, section, setSection, navigate } = useWorkspace();
  const [brain, setBrain] = useState(getBrain);
  const [learning, setLearning] = useState(getLearning);
  useEffect(() => {
    const updateBrain = () => setBrain(getBrain());
    const updateLearning = () => setLearning(getLearning());
    const updateAll = () => { updateBrain(); updateLearning(); };
    window.addEventListener('brand-brain-change', updateBrain);
    window.addEventListener('workspace-learning', updateLearning);
    window.addEventListener('storage', updateAll);
    return () => {
      window.removeEventListener('brand-brain-change', updateBrain);
      window.removeEventListener('workspace-learning', updateLearning);
      window.removeEventListener('storage', updateAll);
    };
  }, []);

  const prefs = preferenceSummary();
  const verified = brain.knowledge.filter(item => item.verification === 'verified');
  const pending = brain.knowledge.length - verified.length;
  const products = brain.knowledge.filter(item => item.category === 'product' || item.category === 'service');
  const facts = verified.filter(item => !['product', 'service', 'competitor'].includes(item.category));
  const readySources = brain.sources.filter(source => source.status === 'ready');
  const selections = learning.events.filter(event => event.type === 'selection');
  const edits = learning.events.filter(event => event.type === 'edit');
  const published = posts.filter(post => post.status === 'published');
  const performance = published.flatMap(post => learning.performance[post.id] ? [learning.performance[post.id]] : []);
  const views = performance.reduce((sum, post) => sum + post.views, 0);
  const clicks = performance.reduce((sum, post) => sum + post.clicks, 0);
  const registrations = performance.reduce((sum, post) => sum + post.registrations, 0);
  const hasResults = performance.some(post => post.views || post.clicks || post.registrations || post.reactions);
  const topicResults = performance.reduce<Record<string, { clicks: number; views: number; count: number }>>((all, post) => {
    const previous = all[post.topic] ?? { clicks: 0, views: 0, count: 0 };
    all[post.topic] = { clicks: previous.clicks + post.clicks, views: previous.views + post.views, count: previous.count + 1 };
    return all;
  }, {});
  const leadingTopic = Object.entries(topicResults).sort((a, b) => b[1].clicks - a[1].clicks)[0];
  const formats = Object.entries(published.reduce<Record<string, number>>((all, post) => { all[post.format] = (all[post.format] ?? 0) + 1; return all; }, {})).sort((a, b) => b[1] - a[1]);
  const averageLength = published.length ? Math.round(published.reduce((sum, post) => sum + post.body.length, 0) / published.length) : 0;
  const name = brain.company.name || (brand.name !== 'Моя компания' ? brand.name : '') || 'Ваша компания';
  const tone = brain.company.tone || brand.tone;
  const audience = brain.company.audience || brand.audience;
  const recent = learning.events.filter(event => event.type === 'selection' || event.type === 'edit').slice(0, 5);
  const rules = [
    ...(brain.rules.requireSourceForNumbers ? ['Цены и цифры — только из подтверждённых фактов'] : []),
    ...(brain.rules.blockUnverifiedFacts ? ['Предположения не используются как факты'] : []),
    ...(brain.rules.blockCompetitorMentions ? ['Без упоминаний конкурентов'] : []),
  ];

  return <div className="ai-page ai-page-v2">
    <div className="page-heading"><h1 className="page-title">LABRICA AI</h1>{section === 'company' && <button className="ai-header-action" onClick={() => navigate('brain')}>База знаний <ArrowUpRight size={16} /></button>}</div>
    {section !== 'company' ? <Overview onCompany={() => setSection('company')} onCreate={() => navigate('controller')} /> : <div className="ai-company-grid">
      <section className="ai-company-card ai-company-passport">
        <div className="ai-section-top"><span className="ai-card-label"><BookOpen size={17} /> Память компании</span>{brain.updatedAt && <span className="ai-updated">Обновлено {dateLabel(brain.updatedAt)}</span>}</div>
        <h2>{name}</h2>
        {brain.company.description ? <p className="ai-company-description">{brain.company.description}</p> : <p className="ai-empty-line">Описание компании пока не добавлено</p>}
        <div className="ai-company-fields"><div><span>Аудитория</span><p>{audience || 'Пока не указана'}</p></div><div><span>Сайт</span><p>{brain.company.website || 'Пока не добавлен'}</p></div></div>
        <div className="ai-passport-footer"><span className={`ai-verification ${brain.company.verified ? 'verified' : ''}`}>{brain.company.verified ? <CheckCheck size={14} /> : <CircleHelp size={14} />}{brain.company.verified ? 'Подтверждено командой' : 'Данные требуют подтверждения'}</span><button onClick={() => navigate('brain')} aria-label="Изменить данные компании"><PencilLine size={17} /></button></div>
      </section>
      <section className="ai-company-card ai-evidence-counts">
        <span className="ai-card-label"><BrainCircuit size={17} /> Накопленный контекст</span>
        <div>{[{ value: verified.length, label: 'подтверждённых сведений' }, { value: readySources.length, label: 'прочитанных источников' }, { value: selections.length, label: 'выбранных вариантов' }, { value: edits.length, label: 'сохранённых правок' }].map(item => <div key={item.label}><strong>{formatNumber(item.value)}</strong><span>{item.label}</span></div>)}</div>
      </section>
      <section className="ai-company-card ai-company-products">
        <div className="ai-section-top"><h3>Продукты и услуги</h3><span className="ai-count">{products.length}</span></div>
        {products.length ? <div className="ai-record-list">{products.slice(0, 5).map(item => <article key={item.id}><span className="ai-record-icon"><Layers3 size={19} /></span><div><span className="ai-record-category">{knowledgeLabels[item.category]}</span><h4>{item.title}</h4><p>{item.content}</p>{item.verification!=='verified'&&<small className="ai-value-origin">{verificationLabels[item.verification]}</small>}</div></article>)}</div> : <div className="ai-data-empty"><Layers3 size={26} /><p>Какие задачи решает ваш продукт?</p><button onClick={() => navigate('brain')}>Добавить сведения <Plus size={15} /></button></div>}
        {products.length > 5 && <button className="ai-text-link" onClick={() => navigate('brain')}>Все продукты и услуги <ArrowRight size={15} /></button>}
      </section>
      <section className="ai-company-card ai-company-voice">
        <span className="ai-card-label"><Fingerprint size={17} /> Голос бренда</span>
        <h3>{tone || 'Пока не настроен'}</h3><span className="ai-value-origin">Заданный тон</span>
        <p className="ai-voice-rules">{brain.rules.voiceRules || brand.rules || 'Редакционные правила пока не добавлены'}</p>
        <div className="ai-observation"><PencilLine size={17} /><div><strong>{prefs.favoriteTone ? `Чаще выбираете: ${prefs.favoriteTone.toLocaleLowerCase('ru-RU')}` : 'Предпочтения ещё формируются'}</strong><p>{prefs.favoriteTone ? `На основе ${formatNumber(selections.length)} сохранённых выборов` : 'Здесь появятся закономерности в выборе вариантов'}</p></div></div>
        {prefs.edits >= 2 && <div className="ai-observation"><CheckCheck size={17} /><div><strong>{Math.abs(1 - prefs.averageRatio) < .01 ? 'Сохраняете объём текста' : `${prefs.averageRatio < 1 ? 'Сокращаете' : 'Дополняете'} тексты в среднем на ${Math.round(Math.abs(1 - prefs.averageRatio) * 100)}%`}</strong><p>По {formatNumber(prefs.edits)} сохранённым правкам</p></div></div>}
      </section>
      <section className="ai-company-card ai-company-facts">
        <div className="ai-section-top"><h3>Что уже известно</h3><ShieldCheck size={19} /></div>
        {facts.length ? <div className="ai-fact-list">{facts.slice(0, 6).map(item => <article key={item.id}><div><span className="ai-record-category">{knowledgeLabels[item.category]}</span><Check size={14} /></div><h4>{item.title}</h4><p>{item.content}</p><small>{item.sourceId ? brain.sources.find(source => source.id === item.sourceId)?.name || 'Подтверждено командой' : 'Подтверждено командой'}</small></article>)}</div> : <div className="ai-data-empty"><BookOpen size={26} /><p>Факты и особенности бренда появятся после заполнения базы знаний</p><button onClick={() => navigate('brain')}>Заполнить базу <ArrowRight size={15} /></button></div>}
        {(pending > 0 || facts.length > 6) && <button className="ai-text-link" onClick={() => navigate('brain')}>{pending ? `Сведений на проверке: ${pending}` : 'Все сведения'} <ArrowRight size={15} /></button>}
      </section>
      <section className="ai-company-card ai-company-guard">
        <span className="ai-card-label"><ShieldCheck size={17} /> Границы бренда</span><h3>Точность важнее<br />красивого обещания</h3>
        <ul className="ai-guard-list">{rules.map(rule => <li key={rule}><Check size={14} /><span>{rule}</span></li>)}</ul>
        {brain.rules.forbiddenWords.filter(Boolean).length > 0 && <div className="ai-guard-detail"><span>Не используем</span><div className="ai-word-tags">{brain.rules.forbiddenWords.filter(Boolean).map(word => <span key={word}>{word}</span>)}</div></div>}
        {brain.rules.requiredPhrases.filter(Boolean).length > 0 && <div className="ai-guard-detail"><span>Обязательные формулировки</span><p>{brain.rules.requiredPhrases.filter(Boolean).join(' · ')}</p></div>}
        {brain.rules.avoidClaims.filter(Boolean).length > 0 && <div className="ai-guard-detail"><span>Недопустимые обещания</span><p>{brain.rules.avoidClaims.filter(Boolean).join(' · ')}</p></div>}
        <button className="ai-text-link" onClick={() => navigate('brain')}>Настроить правила <ArrowUpRight size={15} /></button>
      </section>
      <section className="ai-company-card ai-company-performance">
        <div className="ai-section-top"><h3>Опыт опубликованного контента</h3><TrendingUp size={19} /></div>
        {hasResults ? <><div className="ai-result-metrics">{[{ value: views, label: 'просмотров' }, { value: clicks, label: 'переходов' }, { value: registrations, label: 'регистраций' }].map(item => <div key={item.label}><strong>{formatNumber(item.value)}</strong><span>{item.label}</span></div>)}</div>{leadingTopic && leadingTopic[1].clicks > 0 && <div className="ai-leading-topic"><Target size={20} /><div><span>Больше всего переходов</span><strong>{leadingTopic[0]}</strong></div><b>{formatNumber(leadingTopic[1].clicks)}</b></div>}<div className="ai-performance-footer"><span>По {performance.length} публикациям с сохранённой статистикой</span><button className="ai-text-link" onClick={() => navigate('analytics')}>Аналитика <ArrowUpRight size={15} /></button></div></> : <div className="ai-data-empty"><TrendingUp size={26} /><p>Пока нет результатов для сравнения</p><span>Выводы о темах и форматах появятся вместе со статистикой публикаций</span></div>}
      </section>
      <section className="ai-company-card ai-company-dna">
        <div className="ai-section-top"><h3>Профиль контента</h3><Fingerprint size={19} /></div>
        {published.length ? <><div className="ai-length-stat"><strong>{formatNumber(averageLength)}</strong><span>символов в среднем<br />в опубликованном тексте</span></div><div className="ai-format-bars">{formats.map(([format, count]) => <div key={format}><span>{format}</span><div><i style={{ width: `${count / published.length * 100}%` }} /></div><strong>{count}</strong></div>)}</div></> : <div className="ai-data-empty"><Fingerprint size={27} /><p>Профиль начнёт складываться после первых публикаций</p><button onClick={() => navigate('controller')}>К идеям <ArrowRight size={15} /></button></div>}
      </section>
      <section className="ai-company-card ai-company-sources">
        <div className="ai-section-top"><h3>Источники знаний</h3><span className="ai-count">{brain.sources.length}</span></div>
        {brain.sources.length ? <div className="ai-source-list">{brain.sources.slice(0, 5).map(source => <div key={source.id}><BookOpen size={17} /><div><strong>{source.name}</strong><span>{source.status === 'ready' ? 'Текст прочитан' : source.status === 'configured' ? 'Ожидает импорта' : 'Нужен текст вручную'} · {verificationLabels[source.verification]}</span></div></div>)}</div> : <div className="ai-data-empty"><BookOpen size={25} /><p>Документы, сайт и материалы компании</p><button onClick={() => navigate('brain')}>Добавить источник <Plus size={15} /></button></div>}
        {brain.sources.length > 5 && <button className="ai-text-link" onClick={() => navigate('brain')}>Все источники <ArrowRight size={15} /></button>}
      </section>
      <section className="ai-company-card ai-company-history">
        <div className="ai-section-top"><h3>Решения команды</h3><Clock3 size={18} /></div>
        {recent.length ? <div className="ai-learning-list">{recent.map(event => <div key={event.id}><span>{event.type === 'edit' ? <PencilLine size={15} /> : <CheckCheck size={15} />}</span><div><strong>{event.type === 'edit' ? 'Сохранены правки текста' : 'Выбран вариант публикации'}</strong><p>{event.type === 'edit' && event.beforeLength !== undefined && event.afterLength !== undefined ? `${formatNumber(event.beforeLength)} → ${formatNumber(event.afterLength)} символов` : [event.tone, goalOptions.find(option=>option.value===event.goal)?.label].filter(Boolean).join(' · ') || 'Выбор добавлен в предпочтения'}</p></div><time dateTime={event.at}>{dateLabel(event.at)}</time></div>)}</div> : <div className="ai-data-empty"><Sparkles size={25} /><p>История пока чистая</p><span>Здесь будут ваши выбранные варианты и сохранённые изменения</span></div>}
      </section>
    </div>}
  </div>;
}
