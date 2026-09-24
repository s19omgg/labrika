import { workspaceKey } from './runtime';
import type { Platform, Post } from './model';

export type AutopilotMode = 'manual' | 'approval' | 'full';
export interface AutopilotRules {mode: AutopilotMode; enabled: boolean; postsPerWeek: number; platforms: Platform[]; topics: string; goal: string; time: string; lastWeek: string; nextRun?: string; queueIds: string[]}
export interface BusinessSource {id: string; name: string; kind: 'crm' | 'catalog' | 'rss' | 'site'; url: string; enabled: boolean}
export interface BusinessEvent {id: string; title: string; detail: string; sourceId: string; sourceName: string; date: string; postId?: string}
export interface Competitor {id: string; name: string; url: string}
export interface Observation {id: string; competitorId: string; date: string; topic: string; format: string; reactions: number | null; frequency: number | null; note: string; postId?: string}
export interface Campaign {id: string; name: string; product: string; launchDate: string; goal: string; description: string; createdAt: string; postIds: string[]}
export interface RepurposeRun {id: string; title: string; fingerprint: string; createdAt: string; postIds: string[]; skipped: number}
export interface GrowthData {autopilot: AutopilotRules; sources: BusinessSource[]; events: BusinessEvent[]; competitors: Competitor[]; observations: Observation[]; campaigns: Campaign[]; repurposeRuns: RepurposeRun[]}
export const defaultAutopilot: AutopilotRules = {mode: 'manual', enabled: false, postsPerWeek: 5, platforms: ['telegram', 'threads'], topics: '', goal: 'registrations', time: '12:00', lastWeek: '', queueIds: []};
export const emptyGrowth = (): GrowthData => ({autopilot: {...defaultAutopilot, platforms: [...defaultAutopilot.platforms], queueIds: []}, sources: [], events: [], competitors: [], observations: [], campaigns: [], repurposeRuns: []});
export function getGrowth(): GrowthData {
  try {
    const stored = JSON.parse(localStorage.getItem(workspaceKey('growth-v1')) || 'null');
    if (!stored || typeof stored !== 'object') return emptyGrowth();
    const fallback = emptyGrowth();
    return {...fallback, autopilot: {...fallback.autopilot, ...stored.autopilot}, ...Object.fromEntries(['sources','events','competitors','observations','campaigns','repurposeRuns'].map(key => [key, Array.isArray(stored[key]) ? stored[key] : []]))};
  } catch {return emptyGrowth();}
}
export function saveGrowth(data: GrowthData) {localStorage.setItem(workspaceKey('growth-v1'), JSON.stringify(data));window.dispatchEvent(new CustomEvent('growth-data-change', {detail: {key: workspaceKey('growth-v1'), data}}));}
export function getAutopilot() {return getGrowth().autopilot;}
export function localToday() {return isoDay(new Date());}
export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function shiftDay(date: string, days: number) {const result = new Date(`${date}T12:00:00`); result.setDate(result.getDate() + days); return isoDay(result);}
export function weekKey(date: string) {const result = new Date(`${date}T12:00:00`); result.setDate(result.getDate() - (result.getDay() + 6) % 7); return isoDay(result);}
export function normalizeText(text: string) {return text.toLowerCase().replace(/ё/g, 'е').replace(/https?:\/\/\S+/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();}
const stopWords = new Set(['этот','этого','который','которые','чтобы','также','можно','нужно','наш','наша','ваш','ваша','это','как','для','или','что','все','при','про','под','без','над','его','она','они','вам','нас','том','так','уже','еще','чем','сам','после','через']);
export function textSimilarity(a: string, b: string) {
  const tokens = (text: string) => new Set(normalizeText(text).split(' ').filter(word => word.length > 2 && !stopWords.has(word)));
  const left = tokens(a), right = tokens(b); if (!left.size || !right.size) return normalizeText(a) === normalizeText(b) && normalizeText(a) ? 1 : 0;
  const common = [...left].filter(word => right.has(word)).length;
  return common / Math.max(Math.min(left.size, right.size), 1) * .6 + common / (left.size + right.size - common) * .4;
}
export function duplicatePost(candidate: Pick<Post, 'body' | 'title' | 'platforms' | 'format'>, posts: Post[]) {
  return posts.find(post => post.platforms.some(platform => candidate.platforms.includes(platform)) && post.format === candidate.format && (normalizeText(post.body) === normalizeText(candidate.body) && !!candidate.body.trim() || textSimilarity(`${post.title} ${post.body}`, `${candidate.title} ${candidate.body}`) >= .84));
}
export function fingerprint(text: string) {let hash = 2166136261; for (const char of normalizeText(text)) {hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619);} return (hash >>> 0).toString(36);}
export function validURL(text: string) {try {const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) ? url.href : null;} catch {return null;}}
export const sourceTypes: Record<BusinessSource['kind'], string> = {crm: 'CRM', catalog: 'Каталог', rss: 'RSS', site: 'Сайт'};
export const goalLabels: Record<string, string> = {registrations: 'Регистрации', leads: 'Заявки', awareness: 'Узнаваемость', sales: 'Продажи'};
export const campaignSteps: {name: string; offset: number; platform: Platform; format: string; prompt: string}[] = [
  {name: 'Тизер', offset: -7, platform: 'threads', format: 'Пост', prompt: 'Обозначьте проблему, которую решает продукт. Не раскрывайте всё сразу.'},
  {name: 'Проблема и решение', offset: -5, platform: 'telegram', format: 'Пост', prompt: 'Разберите один сценарий клиента и покажите, как продукт поможет.'},
  {name: 'Stories', offset: -4, platform: 'instagram', format: 'История', prompt: 'Кадр 1: вопрос аудитории. Кадр 2: фрагмент продукта. Кадр 3: дата запуска.'},
  {name: 'Reels', offset: -3, platform: 'instagram', format: 'Видео', prompt: 'Хук: знакомая проблема. Демонстрация продукта. Один понятный следующий шаг.'},
  {name: 'Тред о продукте', offset: -2, platform: 'threads', format: 'Тред', prompt: 'Расскажите в коротких сообщениях: для кого продукт, как работает, с чего начать.'},
  {name: 'Запуск', offset: 0, platform: 'telegram', format: 'Пост', prompt: 'Назовите продукт, покажите его пользу и добавьте действительную ссылку на запуск.'},
  {name: 'Ответы после запуска', offset: 1, platform: 'vk', format: 'Карусель', prompt: 'Соберите реальные вопросы пользователей. Один ответ — одна карточка.'},
  {name: 'Подробный разбор', offset: 3, platform: 'dzen', format: 'Статья', prompt: 'Переработайте основные материалы запуска в полезный пошаговый разбор.'},
  {name: 'Кейс и следующий шаг', offset: 7, platform: 'youtube', format: 'Видео', prompt: 'Добавьте подтверждённый результат реального клиента. До появления кейса оставьте материал в черновиках.'},
];
export function quoteImage(quote: string, source: string, brand: string) {
  const escape = (text: string) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const words = quote.replace(/\s+/g, ' ').slice(0, 230).split(' '); const lines: string[] = []; let line = '';
  words.forEach(word => {if ((line + ' ' + word).trim().length > 30) {lines.push(line); line = word;} else line = (line + ' ' + word).trim();}); if (line) lines.push(line);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#f4f5f7"/><rect x="54" y="54" width="972" height="972" rx="46" fill="white"/><rect x="96" y="105" width="80" height="80" rx="24" fill="#d5ff3f"/><text x="116" y="172" fill="#15191f" font-family="Arial,sans-serif" font-size="86">“</text>${lines.slice(0, 8).map((item, index) => `<text x="98" y="${300 + index * 68}" font-family="Arial,sans-serif" font-size="48" fill="#202631">${escape(item)}</text>`).join('')}<text x="98" y="899" font-family="Arial,sans-serif" font-size="23" fill="#8791a0">${escape(source.slice(0, 58))}</text><text x="98" y="951" font-family="Arial,sans-serif" font-size="28" fill="#202631">${escape(brand.slice(0, 38))}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
