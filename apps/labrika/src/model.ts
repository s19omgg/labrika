import { isLabrika } from './runtime';
import { getPolicy } from './admin-data';
export type Platform = 'telegram' | 'instagram' | 'vk' | 'youtube' | 'threads' | 'dzen' | 'max' | 'tiktok';
export type PostStatus = 'draft' | 'approved' | 'scheduled' | 'published';
export type Page = 'dashboard' | 'content' | 'controller' | 'calendar' | 'analytics' | 'settings' | 'profile' | 'brain' | 'assets' | 'autopilot' | 'events' | 'competitors' | 'campaigns' | 'repurpose' | 'ai' | 'billing';
export interface PublicationReceipt {id:string;url?:string;platform:Platform;publishedAt:string;visibility?:string}
export interface Post {
  deliveries?:Partial<Record<Platform,PublicationReceipt>>; originPostId?:string;
  id: string; title: string; body: string; platforms: Platform[]; status: PostStatus;
  format: string; topic: string; date: string; time: string; author: string;
  views: number; clicks: number; registrations: number; reactions: number; comments: number; shares: number;
  cover: string; abTest?: boolean; planned?: boolean; platformBodies?: Partial<Record<Platform, string>>;
  campaignId?: string; sourceEventId?: string; repurposeSourceId?: string; automation?: boolean; createdAt?: string; goal?: string; media?: {kind: 'image' | 'video'; url: string; format: string};
  videoScript?: {title: string; caption: string; scenes: {heading: string; text: string; duration: number}[]};
}
export interface BrandSettings { name: string; tone: string; audience: string; rules: string; }
export const platformMeta: Record<Platform, {name: string; color: string; short: string}> = {
  telegram: {name: 'Telegram', color: '#74b8d5', short: 'TG'},
  instagram: {name: 'Instagram', color: '#b69cda', short: 'IG'},
  vk: {name: 'ВКонтакте', color: '#8ea9e5', short: 'VK'},
  youtube: {name: 'YouTube', color: '#e5aca3', short: 'YT'},
  threads: {name: 'Threads', color: '#30343b', short: 'TH'},
  max: {name:'MAX',color:'#7c80dc',short:'MAX'},
  tiktok: {name:'TikTok',color:'#202127',short:'TT'},
  dzen: {name: 'Дзен', color: '#5d6069', short: 'ДЗ'},
};
export const statusMeta: Record<PostStatus, {name: string; color: string}> = {
  draft: {name: 'Черновик', color: 'neutral'}, approved: {name: 'Согласовано', color: 'purple'},
  scheduled: {name: 'Запланировано', color: 'blue'}, published: {name: 'Опубликовано', color: 'green'},
};
export const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
export const shortNumber = (value: number) => value >= 1000 ? `${(value / 1000).toLocaleString('ru-RU', {maximumFractionDigits: 1})} тыс.` : formatNumber(value);
const localNow = new Date();
export const TODAY = isLabrika ? `${localNow.getFullYear()}-${String(localNow.getMonth()+1).padStart(2,'0')}-${String(localNow.getDate()).padStart(2,'0')}` : '2026-09-23';
export const makePost = (title: string, patch: Partial<Post> = {}): Post => ({
  id: crypto.randomUUID(), createdAt: new Date().toISOString(), title, body: '', platforms: ['telegram'], status: 'draft', format: 'Пост', topic: 'Продукт',
  date: TODAY, time: getPolicy().defaultTime, author: 'Александр', views: 0, clicks: 0, registrations: 0, reactions: 0, comments: 0, shares: 0, cover: 'lavender', ...patch,
});
const publishedTitles = ['Контент, который работает на рост', 'От идеи до первого клиента: наш подход', '5 ошибок в контент-стратегии', 'Как мы строим продукт вместе с вами', 'Меньше шума. Больше смысла.', 'За кадром: один день нашей команды', 'Что на самом деле нужно вашей аудитории', 'Почему мы верим в системный контент', 'Ваш следующий шаг к росту', 'Продукт в деталях: новая аналитика', 'Большие идеи начинаются с вопроса', 'Одна команда. Общий результат.'];
export const seedPosts: Post[] = [
  ...publishedTitles.map((title, i) => makePost(title, {
    id: `published-${i}`, status: 'published', date: `2026-09-${String(1 + i * 2).padStart(2, '0')}`,
    platforms: [(['telegram', 'instagram', 'vk', 'youtube'] as Platform[])[i % 4]],
    views: [24860,18400,15200,12800,11300,9200,8300,7100,6200,5200,3500,2800][i],
    clicks: [1486,1120,860,740,610,530,420,350,270,210,146,100][i],
    registrations: [186,142,108,88,72,61,53,42,34,24,18,14][i],
    reactions: 220 + i * 31, comments: 14 + i * 3, shares: 21 + i * 4,
    format: i % 3 === 0 ? 'Карусель' : i % 3 === 1 ? 'Пост' : 'Видео', topic: i % 2 ? 'Продукт' : 'Экспертиза',
    body: `${title}\n\nХороший контент начинается с понимания людей. Мы собираем идеи, проверяем гипотезы и делимся тем, что помогает двигаться вперёд.\n\nВ YGROUP каждый материал — часть общей истории. Рассказываем о подходе, который помогает команде создавать полезное и видеть результат.\n\nСохраните, чтобы вернуться к этим идеям.`, cover: ['lavender','peach','mint','blue'][i%4],
  })),
  ...['Как превратить подписчиков в клиентов', 'За кулисами YGROUP', 'Три привычки сильной контент-команды', 'Новая глава: обновление платформы', 'История одного запуска', 'От данных к хорошим решениям', 'Ответы на ваши вопросы', 'Контент, к которому возвращаются'].map((title, i) => makePost(title, {
    id: `scheduled-${i}`, status: 'scheduled', date: `2026-09-${String(23 + Math.floor(i / 2)).padStart(2, '0')}`, time: i % 2 ? '18:30' : '12:00',
    platforms: [(['telegram','instagram','vk','youtube'] as Platform[])[i%4]], format: i % 3 ? 'Пост' : 'Карусель', topic: 'Экспертиза',
    body: `${title}\n\nЗа каждым результатом стоит понятная система. Делимся наблюдениями команды и практическими шагами, которые можно применить уже сегодня.\n\nКакой подход работает у вас?`, cover: ['lavender','peach','mint','blue'][i%4],
  })),
  ...['Почему охваты — ещё не результат', 'Знакомство с командой', 'Чек-лист перед публикацией', 'Как найти свой голос', 'Разбор: лучший пост месяца', 'Контент без выгорания', 'Десять вопросов к стратегии', 'История нашего клиента', 'Как мы работаем с обратной связью', 'Наши планы на октябрь', 'Как читать аналитику', 'Идеи, которые стоит проверить'].map((title, i) => makePost(title, {
    id: `draft-${i}`, status: i < 3 ? 'approved' : 'draft', platforms: [(['telegram','instagram','vk'] as Platform[])[i%3]], body: `${title}\n\nНачните с главного: какую задачу читателя решает этот материал?`, format: i % 2 ? 'Пост' : 'Карусель', cover: ['mint','blue','lavender'][i%3],
  })),
];
