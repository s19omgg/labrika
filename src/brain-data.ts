import { workspaceKey } from './runtime';
import type { Post } from './model';

export type Verification = 'verified' | 'unverified' | 'inferred';
export type KnowledgeCategory = 'product' | 'service' | 'faq' | 'fact' | 'price' | 'audience' | 'competitor';
export interface KnowledgeItem {id: string; category: KnowledgeCategory; title: string; content: string; verification: Verification; sourceId?: string; updatedAt: string;}
export interface BrainSource {id: string; type: 'url' | 'text' | 'file'; name: string; url?: string; text?: string; assetId?: string; status: 'configured' | 'ready' | 'unsupported'; verification: Verification; reason?: string; truncated?: boolean; createdAt: string;}
export interface BrandBrainData {
  version: 1;
  company: {name: string; description: string; website: string; audience: string; tone: string; verified: boolean};
  knowledge: KnowledgeItem[];
  rules: {voiceRules: string; forbiddenWords: string[]; requiredPhrases: string[]; avoidClaims: string[]; requireSourceForNumbers: boolean; blockCompetitorMentions: boolean; blockUnverifiedFacts: boolean};
  sources: BrainSource[];
  updatedAt: string;
}
export const knowledgeLabels: Record<KnowledgeCategory, string> = {product: 'Продукты', service: 'Услуги', faq: 'Вопросы и ответы', fact: 'Факты', price: 'Цены', audience: 'Аудитория', competitor: 'Конкуренты'};
export const verificationLabels: Record<Verification, string> = {verified: 'Подтверждено', unverified: 'Не проверено', inferred: 'Предположение'};
export const emptyBrain = (): BrandBrainData => ({version: 1, company: {name: '', description: '', website: '', audience: '', tone: 'Дружелюбный', verified: false}, knowledge: [], rules: {voiceRules: '', forbiddenWords: [], requiredPhrases: [], avoidClaims: [], requireSourceForNumbers: true, blockCompetitorMentions: false, blockUnverifiedFacts: true}, sources: [], updatedAt: ''});
export function getBrain(): BrandBrainData {
  try {const saved = JSON.parse(localStorage.getItem(workspaceKey('brain-v1')) || 'null');if (saved?.version === 1 && Array.isArray(saved.knowledge) && Array.isArray(saved.sources)) {const fallback = emptyBrain();return {...fallback, ...saved, company: {...fallback.company, ...saved.company}, rules: {...fallback.rules, ...saved.rules}};}} catch {/* Start with an empty knowledge base when no valid data exists. */}
  return emptyBrain();
}
export function saveBrain(data: BrandBrainData) {const next = {...data, updatedAt: new Date().toISOString()};localStorage.setItem(workspaceKey('brain-v1'), JSON.stringify(next));window.dispatchEvent(new CustomEvent('brand-brain-change', {detail: next}));}
export function verifiedBrandContext(brain = getBrain()): string {
  const parts: string[] = [];
  if (brain.company.verified) {const c = brain.company;parts.push([c.name && `Компания: ${c.name}`, c.description && `О компании: ${c.description}`, c.website && `Сайт: ${c.website}`, c.audience && `Аудитория: ${c.audience}`].filter(Boolean).join('\n'));}
  for (const item of brain.knowledge.filter(value => value.verification === 'verified')) {const source = brain.sources.find(value => value.id === item.sourceId);parts.push(`${knowledgeLabels[item.category]} — ${item.title}: ${item.content}${source ? `\nИсточник: ${source.name}${source.url ? ` (${source.url})` : ''}` : '\nИсточник: подтверждено командой'}`);}
  const r = brain.rules;
  parts.push([brain.company.tone && `Тон: ${brain.company.tone}`, r.voiceRules && `Редакционные правила: ${r.voiceRules}`, r.forbiddenWords.length && `Не использовать: ${r.forbiddenWords.join(', ')}`, r.avoidClaims.length && `Недопустимые обещания: ${r.avoidClaims.join('; ')}`, r.requiredPhrases.length && `Обязательные формулировки: ${r.requiredPhrases.join('; ')}`, r.requireSourceForNumbers && 'Числа и цены использовать только из подтверждённых фактов.', r.blockUnverifiedFacts && 'Не использовать непроверенные сведения и предположения как факты.'].filter(Boolean).join('\n'));
  return parts.filter(Boolean).join('\n\n');
}
export function verifiedFactsForContent(brain = getBrain()): string[] {
  return [brain.company.verified ? brain.company.description.trim() : '', ...brain.knowledge.filter(item => item.verification === 'verified' && ['fact', 'product', 'service', 'price'].includes(item.category)).map(item => item.content.trim())].filter(Boolean);
}
export interface ProtectionIssue {code: string; severity: 'error' | 'warning'; message: string; match?: string;}
const normalize = (text: string) => text.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim();
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsTerm = (text: string, term: string) => term.trim() && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term.trim())}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
export function protectBrand(body: string, title = '', brain = getBrain()): {allowed: boolean; issues: ProtectionIssue[]} {
  const text = `${title}\n${body}`;
  const issues: ProtectionIssue[] = [];
  for (const word of brain.rules.forbiddenWords) if (containsTerm(text, word)) issues.push({code: 'forbidden-word', severity: 'error', message: `Запрещённая формулировка: «${word}».`, match: word});
  for (const claim of brain.rules.avoidClaims) if (containsTerm(text, claim)) issues.push({code: 'restricted-claim', severity: 'error', message: `Недопустимое обещание: «${claim}».`, match: claim});
  for (const phrase of brain.rules.requiredPhrases) if (!normalize(text).includes(normalize(phrase))) issues.push({code: 'required-phrase', severity: 'warning', message: `Добавьте обязательную формулировку: «${phrase}».`, match: phrase});
  if (brain.rules.blockCompetitorMentions) for (const item of brain.knowledge.filter(value => value.category === 'competitor')) if (containsTerm(text, item.title)) issues.push({code: 'competitor', severity: 'error', message: `Правила бренда запрещают упоминать «${item.title}».`, match: item.title});
  if (brain.rules.blockUnverifiedFacts) for (const item of brain.knowledge.filter(value => value.verification !== 'verified')) if (normalize(item.content).length > 20 && normalize(text).includes(normalize(item.content))) issues.push({code: 'unverified-fact', severity: 'error', message: `Сведение «${item.title}» ещё не подтверждено.`, match: item.content});
  if (brain.rules.requireSourceForNumbers) {
    const verified = normalize(brain.knowledge.filter(value => value.verification === 'verified').map(value => value.content).join(' ') + ' ' + (brain.company.verified ? brain.company.description : ''));
    const claims = Array.from(new Set(text.match(/\d[\d\s.,]*\s*(?:%|₽|руб(?:лей|ля|ль)?|USD|доллар(?:ов|а)?|€|₺)/giu) || []));
    for (const claim of claims) if (!verified.includes(normalize(claim))) issues.push({code: 'unsourced-number', severity: 'warning', message: `Для «${claim.trim()}» нет подтверждённого факта в базе.`, match: claim.trim()});
  }
  const verifiedSentences = brain.knowledge.filter(value=>value.verification==='verified').map(value=>normalize(value.content)).join(' ');
  for(const sentence of text.split(/(?<=[.!?])\s+|\n/).filter(Boolean)) {
    if(/(?:гарантиру(?:ем|ет|ется)|излеч(?:ивает|ение)|лечит|медицински доказано|юридически гарантировано|соответствует (?:ГОСТ|закону)|сертифицирован)/iu.test(sentence)&&!verifiedSentences.includes(normalize(sentence)))issues.push({code:'unverified-claim',severity:'error',message:'Обещание или специальное утверждение требует подтверждения.',match:sentence});
  }
  return {allowed: !issues.some(issue => issue.severity === 'error'), issues};
}
export interface ContentCheck {key: string; label: string; passed: boolean; detail: string; weight: number;}
export function contentRating(body: string, title: string, posts: Pick<Post, 'title' | 'body'>[] = [], media?: Post['media']) {
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const duplicate = body.trim().length > 70 && posts.some(post => normalize(post.body) === normalize(body));
  const checks: ContentCheck[] = [
    {key: 'title', label: 'Понятная тема', passed: title.trim().length >= 5 && title.trim().length <= 160, detail: 'Название от 5 до 160 символов.', weight: 15},
    {key: 'substance', label: 'Достаточно содержания', passed: body.trim().length >= 80, detail: 'Текст содержит не менее 80 символов.', weight: 20},
    {key: 'structure', label: 'Читаемая структура', passed: paragraphs.length > 1 && paragraphs.every(value => value.length < 650), detail: 'Короткие абзацы помогают читать текст.', weight: 15},
    {key: 'action', label: 'Следующий шаг', passed: /(?:сохраните|попробуйте|поделитесь|напишите|перейдите|узнайте|зарегистриру|подписывай|оставьте|посмотрите|скачайте|закажите|\?)/iu.test(body), detail: 'В тексте есть вопрос или призыв к действию.', weight: 15},
    {key: 'original', label: 'Без точных повторов', passed: !duplicate, detail: duplicate ? 'В пространстве уже есть такой текст.' : 'Точное совпадение с другими постами не найдено.', weight: 15},
    {key: 'focus', label: 'Компактная подача', passed: body.length <= 2500 || !!media, detail: 'До 2 500 символов или публикация с медиа.', weight: 10},
    {key: 'brand', label: 'Правила бренда', passed: protectBrand(body, title).issues.length === 0, detail: 'Проверка по правилам и подтверждённым сведениям.', weight: 10},
  ];
  const issues = protectBrand(body, title).issues;
  if (duplicate) issues.push({code: 'duplicate', severity: 'warning', message: 'Этот текст уже есть среди публикаций.'});
  return {score: body.trim() ? checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0) : 0, checks, issues, method: 'Локальная проверка структуры и правил'};
}
export function applyBrandProtection(body: string, title = '', brain = getBrain()) {
  const original = protectBrand(body, title, brain);
  let next = body;
  for (const issue of original.issues.filter(value => (value.severity === 'error' || value.code === 'unsourced-number') && value.match)) {next = next.split(/(?<=[.!?])\s+|\n/).filter(sentence => !containsTerm(sentence, issue.match!)).join('\n');}
  for (const phrase of brain.rules.requiredPhrases) if (!normalize(next).includes(normalize(phrase))) next += `\n\n${phrase}`;
  next = next.replace(/\n{3,}/g, '\n\n').trim();
  return {body: next, removed: Math.max(0, body.length - next.length), unresolved: protectBrand(next, title, brain).issues};
}

export type AssetKind = 'image' | 'video' | 'logo' | 'font' | 'document' | 'other';
export interface LibraryAsset {id: string; name: string; mime: string; size: number; kind: AssetKind; createdAt: string;}
export const assetKindLabels: Record<AssetKind, string> = {image: 'Изображение', video: 'Видео', logo: 'Логотип', font: 'Шрифт', document: 'Документ', other: 'Файл'};
function openAssets(): Promise<IDBDatabase> {return new Promise((resolve, reject) => {if (!('indexedDB' in window)) {reject(new Error('Хранилище файлов недоступно в этом браузере.'));return;}const request = indexedDB.open(workspaceKey('assets'), 1);request.onupgradeneeded = () => {const db = request.result;if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', {keyPath: 'id'});if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', {keyPath: 'id'});};request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error || new Error('Не удалось открыть хранилище файлов.'));request.onblocked = () => reject(new Error('Обновите другие вкладки приложения, чтобы открыть библиотеку.'));});}
function classifyAsset(file: File): AssetKind {if (file.type.startsWith('image/')) return 'image';if (file.type.startsWith('video/')) return 'video';if (/\.(woff2?|ttf|otf)$/i.test(file.name)) return 'font';if (file.type.startsWith('text/') || /\.(pdf|docx?|xlsx?|csv|md|markdown|json|txt|html?)$/i.test(file.name)) return 'document';return 'other';}
export async function listAssets(): Promise<LibraryAsset[]> {const db = await openAssets();return new Promise((resolve, reject) => {const request = db.transaction('assets').objectStore('assets').getAll();request.onsuccess = () => {resolve((request.result as LibraryAsset[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));db.close();};request.onerror = () => {reject(request.error);db.close();};});}
export async function saveAsset(file: File, kind?: AssetKind): Promise<LibraryAsset> {const db = await openAssets();const asset: LibraryAsset = {id: crypto.randomUUID(), name: file.name, mime: file.type, size: file.size, kind: kind || classifyAsset(file), createdAt: new Date().toISOString()};return new Promise((resolve, reject) => {const transaction = db.transaction(['assets', 'files'], 'readwrite');transaction.objectStore('assets').put(asset);transaction.objectStore('files').put({id: asset.id, blob: file});transaction.oncomplete = () => {db.close();window.dispatchEvent(new CustomEvent('asset-library-change', {detail: {workspace: workspaceKey('assets')}}));resolve(asset);};transaction.onerror = () => {db.close();reject(transaction.error || new Error('Не удалось сохранить файл. Проверьте свободное место.'));};transaction.onabort = () => {db.close();reject(transaction.error || new Error('Загрузка отменена.'));};});}
export async function getAssetBlob(id: string): Promise<Blob | undefined> {const db = await openAssets();return new Promise((resolve, reject) => {const request = db.transaction('files').objectStore('files').get(id);request.onsuccess = () => {resolve(request.result?.blob);db.close();};request.onerror = () => {reject(request.error);db.close();};});}
export async function deleteAsset(id: string): Promise<void> {const db = await openAssets();return new Promise((resolve, reject) => {const transaction = db.transaction(['assets', 'files'], 'readwrite');transaction.objectStore('assets').delete(id);transaction.objectStore('files').delete(id);transaction.oncomplete = () => {db.close();window.dispatchEvent(new CustomEvent('asset-library-change', {detail: {workspace: workspaceKey('assets')}}));resolve();};transaction.onerror = () => {db.close();reject(transaction.error);};transaction.onabort = () => {db.close();reject(transaction.error);};});}
export async function extractLocalText(blob: Blob, name: string): Promise<{text: string; status: 'ready' | 'unsupported'; reason?: string; truncated?: boolean}> {
  if (blob.size > 5 * 1024 * 1024) return {text: '', status: 'unsupported', reason: 'Файл сохранён. Для чтения текста нужен файл до 5 МБ.'};
  if (!blob.type.startsWith('text/') && !/\.(txt|md|markdown|json|csv|html?)$/i.test(name)) return {text: '', status: 'unsupported', reason: 'Файл сохранён. Добавьте текст вручную: этот формат пока не читается локально.'};
  let text = await blob.text();
  if (/\.json$/i.test(name) || blob.type === 'application/json') {try {text = JSON.stringify(JSON.parse(text), null, 2);} catch {return {text: '', status: 'unsupported', reason: 'Файл сохранён, но JSON содержит ошибку.'};}}
  if (/\.html?$/i.test(name) || blob.type === 'text/html') {const doc = new DOMParser().parseFromString(text, 'text/html');doc.querySelectorAll('script,style,noscript').forEach(element => element.remove());text = doc.body.textContent || '';}
  const truncated = text.length > 120000;
  text = text.slice(0, 120000).replace(/\u0000/g, '').trim();
  return text ? {text, status: 'ready', truncated} : {text: '', status: 'unsupported', reason: 'Файл сохранён, но читаемый текст не найден.'};
}
export const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} Б` : bytes < 1024 ** 2 ? `${(bytes / 1024).toLocaleString('ru-RU', {maximumFractionDigits: 1})} КБ` : `${(bytes / 1024 ** 2).toLocaleString('ru-RU', {maximumFractionDigits: 1})} МБ`;
