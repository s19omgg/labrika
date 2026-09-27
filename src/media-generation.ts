export type VisualKind = 'minimal' | 'statistic' | 'infographic' | 'cover' | 'vertical';
export interface VisualInput { kind: VisualKind; brand: string; title: string; subtitle: string; metric: string; points: string[]; }
export interface GeneratedVisual { svg: string; url: string; width: number; height: number; }
export interface VideoScene { heading: string; text: string; duration: number; }
export interface VideoScript { title: string; caption: string; scenes: VideoScene[]; }
export const visualKinds: {value: VisualKind; label: string}[] = [{value:'minimal',label:'Минимализм'},{value:'statistic',label:'Статистика'},{value:'infographic',label:'Инфографика'},{value:'cover',label:'Обложка'},{value:'vertical',label:'Вертикальный формат'}];
export const goalOptions = [{value:'reach',label:'Охват'},{value:'engagement',label:'Вовлечение'},{value:'clicks',label:'Переходы'},{value:'registrations',label:'Регистрации'},{value:'nurture',label:'Прогрев'},{value:'information',label:'Информирование'}];
export type ContentGoal = typeof goalOptions[number]['value'];
export function goalCTA(goal: string, brand: string) {
  const actions: Record<string, string> = {
    reach: 'Сохраните эту идею и поделитесь с тем, кому она пригодится.',
    engagement: 'А как это работает у вас? Расскажите о своём опыте в комментариях.',
    clicks: `Разберите свой следующий шаг вместе с ${brand}. Перейдите по ссылке в профиле.`,
    registrations: `Создайте аккаунт в ${brand}, чтобы перейти от идеи к практике. Ссылка для регистрации — в профиле.`,
    nurture: `В следующем материале ${brand} разберём этот подход на примере. Оставайтесь с нами.`,
    information: 'Сохраните материал, чтобы вернуться к деталям, когда они понадобятся.',
  };
  return actions[goal] ?? actions.information;
}
const escapeXML = (text: string) => text.replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char] ?? char));
export function wrapText(text: string, length: number, maxLines = 5) {
  const words = text.trim().split(/\s+/).flatMap(word => word.length > length ? word.match(new RegExp(`.{1,${length}}`, 'gu')) ?? [word] : [word]);
  const lines: string[] = [];
  for (const word of words) {
    if (!lines.length || `${lines[lines.length - 1]} ${word}`.length > length) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  if (lines.length > maxLines) return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, Math.max(1, length - 1)).replace(/[.,;:!?\s]+$/, '')}…`];
  return lines;
}
function svgText(text: string, x: number, y: number, size: number, width: number, maxLines: number, color = '#17191d', weight = 500, lineHeight = 1.15) {
  const lines = wrapText(text, Math.max(8, Math.floor(width / (size * .57))), maxLines);
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${size > 45 ? -size*.035 : 0}">${lines.map((line,index)=>`<tspan x="${x}" dy="${index ? size*lineHeight : 0}">${escapeXML(line)}</tspan>`).join('')}</text>`;
}
export function createVisual(input: VisualInput): GeneratedVisual {
  const dimensions: Record<VisualKind, [number, number]> = {minimal:[1080,1080],statistic:[1080,1080],infographic:[1080,1350],cover:[1280,720],vertical:[1080,1920]};
  const [width,height] = dimensions[input.kind];
  const title = input.title.trim() || 'Большие идеи начинаются с вас';
  const brand = input.brand.trim() || 'Ваша компания';
  const brandLockup = `<rect x="64" y="60" width="46" height="46" rx="14" fill="#20de7c"/><path d="M77 73 87 83 97 73M87 83v13" fill="none" stroke="#18191c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${svgText(brand,126,92,27,550,1,'#18191c',600)}`;
  const footer = `${svgText('СОЗДАНО ДЛЯ ДВИЖЕНИЯ ВПЕРЁД',64,height-62,16,width-250,1,'#868990',400)}<path d="M${width-112} ${height-90}h42v42m0-42-42 42" fill="none" stroke="#18191c" stroke-width="4"/>`;
  let artwork = '';
  if (input.kind === 'minimal') {
    artwork = `<rect width="1080" height="1080" fill="#f8f9fb"/><circle cx="903" cy="303" r="315" fill="#20de7c"/><circle cx="903" cy="303" r="210" fill="none" stroke="#18191c" stroke-opacity=".11" stroke-width="2"/><circle cx="903" cy="303" r="115" fill="none" stroke="#18191c" stroke-opacity=".11" stroke-width="2"/>${brandLockup}${svgText(title,64,394,87,920,4)}${svgText(input.subtitle,69,861,26,790,3,'#6e727c',400)}${footer}`;
  } else if (input.kind === 'statistic') {
    artwork = `<rect width="1080" height="1080" fill="#fafafa"/>${brandLockup}${svgText(title,64,220,48,880,3)}<rect x="64" y="410" width="952" height="383" rx="38" fill="#18191c"/>${svgText(input.metric || '—',109,648,164,850,1,'#20de7c',500)}<path d="M860 531h74v74m0-74-74 74" fill="none" stroke="#20de7c" stroke-width="7"/>${svgText(input.subtitle,69,869,27,860,3,'#777b83',400)}${footer}`;
  } else if (input.kind === 'infographic') {
    artwork = `<rect width="1080" height="1350" fill="#f7f8fa"/>${brandLockup}${svgText(title,64,220,62,900,3)}${input.points.slice(0,3).map((point,index)=>`<rect x="64" y="${460+index*224}" width="952" height="198" rx="30" fill="${index===0?'#20de7c':'#fff'}"/><circle cx="128" cy="${520+index*224}" r="26" fill="#18191c"/>${svgText(`0${index+1}`,111,528+index*224,21,70,1,'#fff',500)}${svgText(point,187,518+index*224,35,765,3,'#25282e',500,1.3)}`).join('')}${svgText(input.subtitle,69,1202,23,840,2,'#888c94',400)}${footer}`;
  } else if (input.kind === 'cover') {
    artwork = `<rect width="1280" height="720" fill="#f7f8fa"/><rect x="917" y="0" width="363" height="720" fill="#367cfa"/><circle cx="1130" cy="370" r="255" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/><circle cx="1130" cy="370" r="163" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="2"/><path d="M1046 332h151v151m0-151-151 151" fill="none" stroke="#20de7c" stroke-width="15"/>${brandLockup}${svgText(title,64,280,73,825,4)}${svgText(input.subtitle,68,593,23,780,2,'#777c86',400)}${svgText(brand.toLocaleUpperCase('ru-RU'),64,666,16,650,1,'#989da5',400)}`;
  } else {
    artwork = `<rect width="1080" height="1920" fill="#f8f9fb"/>${brandLockup}<circle cx="997" cy="583" r="382" fill="#20de7c"/><circle cx="997" cy="583" r="275" fill="none" stroke="#18191c" stroke-opacity=".09" stroke-width="2"/>${svgText(title,64,530,103,920,6)}<rect x="64" y="1285" width="952" height="350" rx="36" fill="#18191c"/>${svgText(input.subtitle || 'Одна идея. Следующий шаг. Ваш результат.',103,1370,42,865,4,'#fff',400,1.35)}<circle cx="922" cy="1573" r="28" fill="#20de7c"/>${footer}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${escapeXML(title)}</title>${artwork}</svg>`;
  return {svg,url:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,width,height};
}
export function createVideoScript(topic: string, goal: string, brand: string, revision = 0): VideoScript {
  const title = topic.trim() || 'От идеи к результату';
  const cta = goalCTA(goal,brand);
  const middle: Record<string,string> = {reach:'Посмотрите на привычную задачу с другой стороны. Иногда один вопрос меняет весь подход.',engagement:'У каждого есть свой подход. Покажите, как вы решаете эту задачу, и сравните опыт.',clicks:'Начните с одного практического шага. Подробный разбор поможет применить его в своей работе.',registrations:'Соберите идеи в одном месте и выберите следующий шаг. Начать можно с собственного аккаунта.',nurture:'Доверие складывается из деталей: понятный процесс, внимание к людям и открытый разговор.',information:'Сначала — главное. Затем — детали, которые помогают понять, как применить это на практике.'};
  return {title,caption:`${title}\n\n${middle[goal] ?? middle.information}\n\n${cta}`,scenes:[{heading:title,text:revision % 2 ? 'Посмотрим на привычное по-новому.' : 'Начнём с одного важного вопроса.',duration:3},{heading:goal==='registrations'?'От идеи — к действию':goal==='engagement'?'Ваш опыт важен':'Один понятный шаг',text:middle[goal] ?? middle.information,duration:4},{heading:goal==='registrations'?'Начните с аккаунта':goal==='clicks'?'Больше — по ссылке':goal==='engagement'?'Что думаете вы?':goal==='nurture'?'Продолжение впереди':'Сохраните идею',text:cta,duration:3}]};
}
function canvasLines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  const words = text.trim().split(/\s+/); const lines: string[] = []; let current = '';
  for (const word of words) { const next = `${current} ${word}`.trim(); if (current && ctx.measureText(next).width > width) {lines.push(current);current=word;} else current=next; }
  if (current) lines.push(current);
  lines.slice(0,maxLines).forEach((line,index)=>{let value=line;while(ctx.measureText(value).width>width&&value.length>1)value=value.slice(0,-1);if((index===maxLines-1&&lines.length>maxLines)||value!==line)value=`${value.slice(0,-1)}…`;ctx.fillText(value,x,y+index*lineHeight);});
}
function drawVideoFrame(ctx: CanvasRenderingContext2D, script: VideoScript, brand: string, elapsed: number, total: number) {
  const {width,height}=ctx.canvas; let offset=0;let index=script.scenes.length-1;
  for(let i=0;i<script.scenes.length;i++){if(elapsed<offset+script.scenes[i].duration||i===script.scenes.length-1){index=i;break;}offset+=script.scenes[i].duration;}
  const scene=script.scenes[index];const local=Math.max(0,elapsed-offset);const progress=Math.min(1,local/.55);const ease=1-Math.pow(1-progress,3);const isDark=index%2===1;
  ctx.globalAlpha=1;ctx.fillStyle=isDark?'#18191c':'#f7f8fa';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(440,283);ctx.rotate(elapsed*.07);ctx.fillStyle=isDark?'#367cfa':'#20de7c';ctx.beginPath();ctx.arc(0,0,187+Math.sin(elapsed)*8,0,Math.PI*2);ctx.fill();ctx.strokeStyle=isDark?'#ffffff22':'#18191c16';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,125,0,Math.PI*2);ctx.stroke();ctx.restore();
  ctx.fillStyle='#20de7c';ctx.beginPath();ctx.roundRect(34,37,32,32,9);ctx.fill();ctx.strokeStyle='#18191c';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(43,47);ctx.lineTo(50,54);ctx.lineTo(57,47);ctx.moveTo(50,54);ctx.lineTo(50,62);ctx.stroke();
  ctx.fillStyle=isDark?'#fff':'#18191c';ctx.font='600 17px Arial';canvasLines(ctx,brand,78,59,370,22,1);
  ctx.save();ctx.globalAlpha=ease;ctx.translate(0,(1-ease)*26);ctx.font='500 49px Arial';ctx.fillStyle=isDark?'#fff':'#18191c';canvasLines(ctx,scene.heading,34,227,472,57,5);ctx.font='400 24px Arial';ctx.fillStyle=isDark?'#cbd0da':'#666d79';canvasLines(ctx,scene.text,36,579,466,35,7);ctx.restore();
  ctx.fillStyle=isDark?'#949ba6':'#9298a3';ctx.font='400 12px Arial';ctx.fillText(`${String(index+1).padStart(2,'0')} / ${String(script.scenes.length).padStart(2,'0')}`,36,880);
  script.scenes.forEach((_,i)=>{ctx.fillStyle=i===index?'#20de7c':isDark?'#ffffff28':'#18191c20';ctx.beginPath();ctx.arc(width-40-(script.scenes.length-1-i)*16,876,4,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle=isDark?'#ffffff16':'#18191c0c';ctx.fillRect(0,height-5,width,5);ctx.fillStyle='#367cfa';ctx.fillRect(0,height-5,width*Math.min(1,elapsed/total),5);
}
export async function renderVideo(script: VideoScript, brand: string, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') throw new Error('Запись видео недоступна в этом браузере. Откройте проект в актуальном Chrome или Edge.');
  const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Браузер не поддерживает экспорт WebM. Скачайте сценарий или откройте проект в Chrome.');
  const safeScript={...script,scenes:script.scenes.slice(0,5).map(scene=>({...scene,duration:Math.min(8,Math.max(2,Number(scene.duration)||3))}))};
  if (!safeScript.scenes.length) throw new Error('Добавьте хотя бы одну сцену.');
  const canvas=document.createElement('canvas');canvas.width=540;canvas.height=960;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Не удалось открыть холст для рендера.');
  const total=safeScript.scenes.reduce((sum,scene)=>sum+scene.duration,0);
  drawVideoFrame(ctx,safeScript,brand,0,total);
  const stream=canvas.captureStream(24);
  let recorder: MediaRecorder;
  try {recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:450000});}catch{stream.getTracks().forEach(track=>track.stop());throw new Error('Браузер не смог запустить запись видео.');}
  return new Promise((resolve,reject)=>{
    let frame=0;let timeout:ReturnType<typeof setTimeout>;let settled=false;const chunks:Blob[]=[];
    const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timeout);stream.getTracks().forEach(track=>track.stop());signal?.removeEventListener('abort',abort);};
    const fail=(message:string)=>{if(settled)return;settled=true;if(recorder.state!=='inactive')recorder.stop();cleanup();reject(new Error(message));};
    const abort=()=>fail('Экспорт отменён. Сценарий сохранён в редакторе.');
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>fail('Не удалось записать видео. Попробуйте другой браузер.');
    recorder.onstop=()=>{if(settled)return;settled=true;cleanup();const blob=new Blob(chunks,{type:'video/webm'});if(!blob.size){reject(new Error('Видео не записалось. Попробуйте ещё раз.'));return;}onProgress(100);resolve(blob);};
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    recorder.start(200);const started=performance.now();
    const draw=(now:number)=>{if(settled)return;const elapsed=Math.min(total,(now-started)/1000);drawVideoFrame(ctx,safeScript,brand,elapsed,total);onProgress(Math.min(99,Math.round(elapsed/total*100)));if(elapsed>=total){recorder.stop();return;}frame=requestAnimationFrame(draw);};
    frame=requestAnimationFrame(draw);
    timeout=setTimeout(()=>{if(!settled&&recorder.state!=='inactive'){drawVideoFrame(ctx,safeScript,brand,total-.01,total);recorder.stop();}},total*1000+2000);
  });
}
export function downloadFile(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function blobToDataURL(blob: Blob): Promise<string> {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось сохранить файл видео.'));reader.readAsDataURL(blob);});}
