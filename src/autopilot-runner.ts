import {requestAI} from './ai-api';
import {getTeamAccess} from './team-data';
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
export async function prepareAutopilotDrafts(rules: AutopilotRules, brand: BrandSettings, posts: Post[], today = localToday()): Promise<Post[]> {
  const channels = rules.platforms.filter((platform): platform is Platform => platform in platformMeta);
  if (!channels.length) return [];
  const brain = getBrain();
  const verifiedFacts = verifiedFactsForContent(brain);
  const count = Math.min(Math.max(Math.floor(rules.postsPerWeek), 1), 14),week=weekKey(today);
  if(Array.from({length:count},(_,i)=>`autopilot-${fingerprint(workspaceKey('plan'))}-${week}-${i}`).every(id=>posts.some(p=>p.id===id)))return [];
  const result=await requestAI<{posts:{title:string;body:string;topic?:string;format?:string}[]}>({task:'plan',format:'json',context:{brand,rules,brain,verifiedFacts,previous:posts.slice(0,40).map(p=>({title:p.title,date:p.date}))},prompt:`Подготовь ${count} разных готовых публикаций на неделю по правилам компании. Темы: ${rules.topics}. Цель: ${rules.goal}. JSON {"posts":[{"title":"заголовок","body":"полный текст","topic":"тема","format":"Пост"}]}. Не выдумывай факты и цены. Площадки: ${channels.join(', ')}. Соблюдай лимиты длины площадок.`});
  if(!Array.isArray(result.data?.posts)||result.data.posts.length!==count||result.data.posts.some(p=>!p.title?.trim()||!p.body?.trim()))throw Error('Не удалось подготовить весь план. Повторите запрос.');
  return result.data.posts.map((material,index)=>{
    const id=`autopilot-${fingerprint(workspaceKey('plan'))}-${week}-${index}`;
    return makePost(material.title,{id,date:shiftDay(today,Math.floor(index*7/count)),time:rules.time||'12:00',platforms:[channels[index%channels.length]],planned:true,automation:true,createdAt:new Date().toISOString(),topic:material.topic||rules.topics,goal:rules.goal,body:material.body,format:material.format||'Пост',cover:['mint','blue','lavender','peach'][index%4]});
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
    const run = async () => {
      if(!getTeamAccess().can('createPosts'))return;
      const data = getGrowth();
      const rules = data.autopilot;
      if (!rules.enabled || rules.mode === 'manual') return;
      const today = localToday();
      const week = weekKey(today);
      if (rules.lastWeek === week || rules.nextRun && Date.parse(rules.nextRun) > Date.now()) return;
      const drafts = await prepareAutopilotDrafts(rules, latest.current.brand, latest.current.posts, today);
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
        if (navigator.locks?.request) await navigator.locks.request(workspaceKey('autopilot-week-lock'), {ifAvailable:true}, async lock => {if (lock) await run();});
        else await run();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось сохранить план';
        if (lastError.current !== message) {latest.current.notify(message);lastError.current=message;}
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
