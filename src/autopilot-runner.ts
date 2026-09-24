import { useEffect, useRef } from 'react';
import { useWorkspace } from './store';
import { makePost, platformMeta } from './model';
import type { BrandSettings, Platform, Post } from './model';
import { getBrain, verifiedFactsForContent } from './brain-data';
import { fingerprint, getGrowth, localToday, saveGrowth, shiftDay, weekKey } from './growth-data';
import type { AutopilotRules } from './growth-data';
import { workspaceKey } from './runtime';

export function nextAutopilotRun(today: string, time: string) {
  return new Date(`${shiftDay(weekKey(today), 7)}T${time || '12:00'}:00`).toISOString();
}
export function prepareAutopilotDrafts(rules: AutopilotRules, brand: BrandSettings, posts: Post[], today = localToday()): Post[] {
  const channels = rules.platforms.filter((platform): platform is Platform => platform in platformMeta);
  if (!channels.length) return [];
  const brain = getBrain();
  const verifiedFacts = verifiedFactsForContent(brain);
  const explicitTopics = rules.topics.split(/[,\n;]/).map(topic => topic.trim()).filter(Boolean);
  const verifiedTopics = brain.knowledge.filter(item => item.verification === 'verified' && ['product','service','fact','faq'].includes(item.category)).map(item => item.title);
  const topics = explicitTopics.length ? explicitTopics : verifiedTopics.length ? verifiedTopics : [brand.name, 'задачи клиентов', 'работа с продуктом'];
  const angles = ['Практика','Разбор','Вопрос аудитории','Пошаговый подход','За кадром','Полезный список','Итоги недели'];
  const count = Math.min(Math.max(Math.floor(rules.postsPerWeek), 1), 14);
  const week = weekKey(today);
  return Array.from({length:count}, (_, index) => {
    const id = `autopilot-${fingerprint(workspaceKey('plan'))}-${week}-${index}`;
    const topic = topics[index % topics.length];
    const title = `${angles[index % angles.length]}: ${topic}`;
    const platform = channels[index % channels.length];
    const fact = verifiedFacts[index % Math.max(verifiedFacts.length, 1)];
    const action = rules.goal === 'registrations' ? 'Узнайте больше о продукте и выберите свой следующий шаг.' : rules.goal === 'leads' ? 'Напишите команде, чтобы обсудить вашу задачу.' : rules.goal === 'sales' ? 'Добавьте действительную ссылку на предложение перед публикацией.' : 'Что важно для вас в этой теме? Поделитесь в комментариях.';
    const paragraphs = [title, fact || 'Добавьте подтверждённый факт или пример из базы компании перед согласованием.', action, ...brain.rules.requiredPhrases];
    let body = [...new Set(paragraphs.filter(Boolean))].join('\n\n');
    if (platform === 'threads' && body.length > 500) body = body.slice(0, 480).replace(/\s+\S*$/, '') + '…';
    return makePost(title, {id, date:shiftDay(today,Math.floor(index*7/count)),time:rules.time||'12:00',platforms:[platform],planned:true,automation:true,createdAt:new Date().toISOString(),topic,goal:rules.goal,body,format:index%4===2&&platform!=='threads'?'Карусель':'Пост',cover:['mint','blue','lavender','peach'][index%4]});
  }).filter(post => !posts.some(existing => existing.id === post.id));
}

/** Checks the persisted schedule while the application is running; publishing is never simulated. */
export function useAutopilotRunner() {
  const workspace = useWorkspace();
  const latest = useRef(workspace);
  latest.current = workspace;
  const inFlight = useRef(false);
  const lastError = useRef('');
  useEffect(() => {
    const run = () => {
      const data = getGrowth();
      const rules = data.autopilot;
      if (!rules.enabled || rules.mode === 'manual') return;
      const today = localToday();
      const week = weekKey(today);
      if (rules.lastWeek === week || rules.nextRun && Date.parse(rules.nextRun) > Date.now()) return;
      const drafts = prepareAutopilotDrafts(rules, latest.current.brand, latest.current.posts, today);
      if (!drafts.length && !rules.platforms.length) return;
      const next = {...data,autopilot:{...rules,lastWeek:week,nextRun:nextAutopilotRun(today,rules.time),queueIds:[...new Set([...rules.queueIds,...drafts.map(post=>post.id)])]}};
      // Reserve the week synchronously before creating posts, including across StrictMode mounts.
      saveGrowth(next);
      drafts.forEach(post => latest.current.addPost(post));
      if (drafts.length) latest.current.notify(`Автопилот подготовил ${drafts.length} черновиков на проверку`);
      lastError.current = '';
    };
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        if (navigator.locks?.request) await navigator.locks.request(workspaceKey('autopilot-week-lock'), {ifAvailable:true}, lock => {if (lock) run();});
        else run();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось сохранить план';
        if (lastError.current !== message) {latest.current.notify('Автопилот не смог сохранить план. Проверьте свободное место в браузере.');lastError.current=message;}
      } finally {inFlight.current=false;}
    };
    const changed = () => {void tick();};
    const timer = window.setInterval(changed, 30000);
    const initial = window.setTimeout(changed, 0);
    window.addEventListener('growth-data-change', changed);
    window.addEventListener('focus', changed);
    window.addEventListener('storage', changed);
    document.addEventListener('visibilitychange', changed);
    return () => {window.clearInterval(timer);window.clearTimeout(initial);window.removeEventListener('growth-data-change',changed);window.removeEventListener('focus',changed);window.removeEventListener('storage',changed);document.removeEventListener('visibilitychange',changed);};
  }, []);
}
