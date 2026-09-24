import {randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';

const MAX_BODY=22*1024*1024;
const imageData=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const videoData=/^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/;
class RequestError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw new RequestError('Референсы занимают слишком много места',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new RequestError('Некорректный запрос');}}
function media(value,kind){if(typeof value!=='string'||value.length>100*1024*1024||!(kind==='image'?imageData:videoData).test(value))throw new Error('Сервис не вернул готовый медиафайл');return value;}
function validate(input){
 if(!input||!['image','video'].includes(input.kind))throw new RequestError('Выберите тип креатива');
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>6000)throw new RequestError('Добавьте описание до 6000 символов');
 if(!Array.isArray(input.references)||input.references.length>10||input.references.some(r=>typeof r?.data!=='string'||r.data.length>7*1024*1024||!imageData.test(r.data)))throw new RequestError('Добавьте до 10 изображений PNG, JPEG или WebP');
 if(input.kind==='video'&&(![15,30,45,60].includes(input.duration)||!['9:16','1:1','16:9'].includes(input.aspect)||!['automatic','review'].includes(input.mode)))throw new RequestError('Проверьте параметры видео');
 return {kind:input.kind,prompt:input.prompt.trim(),references:input.references.map(r=>({name:String(r.name||'Референс').slice(0,150),data:r.data})),duration:input.duration,aspect:input.aspect,mode:input.mode,topic:String(input.topic||'').slice(0,500),postText:String(input.postText||'').slice(0,20000),brandContext:String(input.brandContext||'').slice(0,20000)};
}
function storyboard(value,duration){
 if(!Array.isArray(value?.scenes)||!value.scenes.length||value.scenes.length>24)throw new Error('Сервис вернул некорректный сценарий');
 const scenes=value.scenes.map((s,i)=>{if(typeof s.description!=='string'||!s.description.trim()||s.description.length>3000||!Number.isFinite(s.duration)||s.duration<=0||s.duration>15)throw new Error('Проверьте описание и длительность сцен');return {id:String(i+1),description:s.description.trim(),duration:s.duration,heading:String(s.heading||`Сцена ${i+1}`).slice(0,160)};});
 if(Math.abs(scenes.reduce((sum,s)=>sum+s.duration,0)-duration)>.05)throw new Error('Длительность сценария не совпадает с выбранной');
 return {title:String(value.title||'Видео').slice(0,200),caption:String(value.caption||'').slice(0,5000),scenes};
}
/** Adapter boundary: provider owns real generation, continuity, audio and final encoding. */
export function createGatewayAdapter({url=process.env.CREATIVE_GATEWAY_URL,key=process.env.CREATIVE_GATEWAY_KEY}={}){
 if(!url)return null;
 const base=new URL(url);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new Error('CREATIVE_GATEWAY_URL requires HTTPS');
 const call=async(path,payload,signal)=>{const response=await fetch(`${base.href.replace(/\/$/,'')}/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(600000)]),redirect:'error'});if(!response.ok)throw new Error('Сервис генерации временно недоступен. Попробуйте ещё раз.');return response.json();};
 return Object.fromEntries(['storyboard','image','keyframe','animate','compose'].map(name=>[name,(input,signal)=>call(name,input,signal)]));
}
export function createCreativeHandler({adapter=createGatewayAdapter(),ttlMs=3600000,maxJobs=40}={}){
 const jobs=new Map();
 const publicJob=j=>({id:j.id,kind:j.input.kind,status:j.status,stage:j.stage,title:j.title,caption:j.caption,error:j.error,scenes:j.scenes.map(({id,heading,description,duration,image})=>({id,heading,description,duration,image})),result:j.result,aspect:j.input.aspect,duration:j.input.duration});
 const prune=()=>{for(const [id,j] of jobs)if(Date.now()-j.updatedAt>ttlMs){j.abort.abort();jobs.delete(id);}};
 const advance=(job,stage)=>{if(job.abort.signal.aborted)throw new Error('Генерация отменена');job.stage=stage;job.updatedAt=Date.now();};
 async function render(job,onlyScene){
  job.status='running';job.error='';job.result=undefined;
  const target=onlyScene?job.scenes.filter(s=>s.id===onlyScene):job.scenes;
  advance(job,'visuals');
  for(const scene of target){const index=job.scenes.indexOf(scene);const result=await adapter.keyframe({brief:job.input,scene,previous:job.scenes[index-1]?.image,first:job.scenes[0]?.image},job.abort.signal);scene.image=media(result.image,'image');}
  advance(job,'animation');
  for(const scene of target){const index=job.scenes.indexOf(scene);const result=await adapter.animate({brief:job.input,scene,previous:job.scenes[index-1]?.clip},job.abort.signal);scene.clip=media(result.video,'video');}
  advance(job,'montage');
  const result=await adapter.compose({brief:job.input,title:job.title,caption:job.caption,scenes:job.scenes},job.abort.signal);
  if(Math.abs(Number(result.duration)-job.input.duration)>.25||!Number.isFinite(result.duration))throw new Error('Сервис вернул ролик другой длительности');
  job.result=media(result.video,'video');advance(job,'ready');job.status='complete';
 }
 const run=(job,work)=>{void Promise.resolve().then(work).catch(error=>{if(job.abort.signal.aborted)return;job.status='error';job.error=error instanceof Error?error.message:'Не удалось создать креатив';job.updatedAt=Date.now();});};
 return async function creative(req,res,next){
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/creative/'))return next();
  try{
   prune();
   if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new RequestError('Запрос с другого сайта отклонён',403);
   if(path==='/api/creative/capabilities'&&req.method==='GET')return reply(res,200,{configured:!!adapter,kinds:['image','video'],referenceLimit:10,durations:[15,30,45,60]});
   if(path==='/api/creative/jobs'&&req.method==='POST'){
    const input=validate(await body(req));if(!adapter)throw new RequestError('Сервис генерации ещё не подключён. Идея и референсы сохранены в этом окне.',503);
    if(jobs.size>=maxJobs)throw new RequestError('Слишком много задач. Повторите позже.',429);
    const job={id:randomUUID(),token:randomBytes(32).toString('hex'),input,status:'running',stage:input.kind==='image'?'visuals':'script',scenes:[],abort:new AbortController(),updatedAt:Date.now()};jobs.set(job.id,job);
    run(job,async()=>{if(input.kind==='image'){const result=await adapter.image(input,job.abort.signal);job.result=media(result.image,'image');advance(job,'ready');job.status='complete';}else{const script=storyboard(await adapter.storyboard(input,job.abort.signal),input.duration);Object.assign(job,script);if(input.mode==='review'){job.status='review';}else await render(job);}});
    return reply(res,202,{...publicJob(job),token:job.token});
   }
   const match=path.match(/^\/api\/creative\/jobs\/([a-f0-9-]+)(?:\/(continue|scene))?$/);if(!match)throw new RequestError('Не найдено',404);
   const job=jobs.get(match[1]);const token=String(req.headers['x-creative-token']||'');if(!job||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(job.token)))throw new RequestError('Задача не найдена',404);
   if(req.method==='GET'&&!match[2])return reply(res,200,publicJob(job));
   if(req.method==='DELETE'&&!match[2]){job.abort.abort();jobs.delete(job.id);return reply(res,200,{cancelled:true});}
   if(req.method==='POST'&&match[2]==='continue'){
    if(job.status!=='review')throw new RequestError('Сценарий уже передан в генерацию',409);
    const input=await body(req);let script;try{script=storyboard({...input,title:job.title,caption:job.caption},job.input.duration);}catch(error){throw new RequestError(error.message);}job.scenes=script.scenes;job.status='running';run(job,()=>render(job));return reply(res,202,publicJob(job));
   }
   if(req.method==='POST'&&match[2]==='scene'){
    if(job.input.kind==='image'||!['complete','error'].includes(job.status)||!job.scenes.every(s=>s.clip))throw new RequestError('Дождитесь готового видео',409);
    const input=await body(req);const scene=job.scenes.find(s=>s.id===input.id);if(!scene||typeof input.description!=='string'||!input.description.trim()||input.description.length>3000)throw new RequestError('Добавьте описание сцены');
    scene.description=input.description.trim();job.status='running';run(job,()=>render(job,scene.id));return reply(res,202,publicJob(job));
   }
   throw new RequestError('Метод не поддерживается',405);
  }catch(error){reply(res,error.status||500,{error:error.status?error.message:'Не удалось выполнить запрос'});}
 };
}
