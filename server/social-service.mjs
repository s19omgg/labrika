import {createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

const PLATFORMS = ['telegram', 'vk', 'instagram', 'threads', 'youtube', 'max', 'tiktok'];
const NAMES = {telegram:'Telegram', vk:'VK', instagram:'Instagram', threads:'Threads', youtube:'YouTube', max:'МАКС', tiktok:'TikTok'};
const MAX_BODY = 72 * 1024 * 1024;
const LIMITS = {telegram:4096, vk:16384, instagram:2200, threads:500, youtube:5000, max:4000, tiktok:2200};
const digest = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
class SocialError extends Error {
  constructor(message, status=400, code='INVALID_REQUEST', uncertain=false) { super(message); Object.assign(this, {status, code, uncertain}); }
}
const send = (res, status, value) => {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(value));
};
async function readBody(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>MAX_BODY) throw new SocialError('Файл слишком большой. Максимум — 50 МБ.',413); chunks.push(chunk); }
  try { const value=JSON.parse(Buffer.concat(chunks).toString()); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new SocialError('Некорректный запрос'); }
}
function text(value, max=300) { return typeof value==='string' ? value.trim().slice(0,max) : ''; }
function configFor(platform, value) {
  if(!PLATFORMS.includes(platform)) throw new SocialError('Для этой площадки подключение публикации пока не поддерживается.',422,'UNSUPPORTED_PLATFORM');
  const config={token:text(value?.token,10000), account:text(value?.account,200), tokenType:value?.tokenType==='group'?'group':'user'};
  if(['youtube','tiktok'].includes(platform)) for(const key of ['clientId','clientSecret','refreshToken']) config[key]=text(value?.[key],10000);
  if(!config.token && !(['youtube','tiktok'].includes(platform) && config.clientId && config.refreshToken && (platform!=='tiktok'||config.clientSecret))) throw new SocialError('Введите токен доступа');
  if(platform==='telegram' && !/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(config.token)) throw new SocialError('Проверьте токен бота из BotFather');
  if(platform==='telegram' && !/^(@[A-Za-z0-9_]{5,32}|-?\d{5,20})$/.test(config.account)) throw new SocialError('Укажите @имя канала или его числовой ID');
  if(platform==='max' && !/^-?\d{1,20}$/.test(config.account)) throw new SocialError('Укажите числовой chat_id канала или группы МАКС');
  if(platform==='vk') {
    config.account=config.account.replace(/^https:\/\/(?:www\.)?vk\.(?:com|ru)\//,'').replace(/^(?:club|public|event)/,'').replace(/^-/, '');
    if(!/^[A-Za-z0-9_]{1,100}$/.test(config.account)) throw new SocialError('Укажите ID или короткое имя сообщества VK');
  }
  if(['instagram','threads'].includes(platform) && config.account && !/^\d+$/.test(config.account)) throw new SocialError('Укажите числовой ID аккаунта');
  if(platform==='youtube' && config.account && !/^[A-Za-z0-9_-]{10,100}$/.test(config.account)) throw new SocialError('Проверьте ID канала YouTube');
  return config;
}
function isPublicIP(address) {
  const plain=address.toLowerCase().replace(/^\[|\]$/g,'');
  if(isIP(plain)===4) {
    const [a,b]=plain.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
  }
  // Only global-unicast IPv6, excluding mapped IPv4, documentation and transition ranges.
  return isIP(plain)===6 && /^[23][0-9a-f]{3}:/.test(plain) && !/^(2001:(?:db8|0|10|20):|2002:)/.test(plain);
}
async function publicURL(value, resolver) {
  let url; try { url=new URL(value); } catch { throw new SocialError('Нужна публичная HTTPS-ссылка на медиафайл',422,'PUBLIC_MEDIA_REQUIRED'); }
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:' || url.username || url.password || url.port && url.port!=='443' || host==='localhost' || !host.includes('.') && !isIP(host) || /\.(?:localhost|local|internal|test|invalid)$/.test(host)) throw new SocialError('Нужна публичная HTTPS-ссылка на медиафайл',422,'PUBLIC_MEDIA_REQUIRED');
  let addresses; try { addresses=isIP(host)?[{address:host}]:await resolver(host,{all:true,verbatim:true}); } catch { throw new SocialError('Не удалось проверить адрес медиафайла',422,'PUBLIC_MEDIA_REQUIRED'); }
  if(!addresses.length || addresses.some(item=>!isPublicIP(item.address))) throw new SocialError('Локальные и внутренние адреса медиафайлов не поддерживаются',422,'PUBLIC_MEDIA_REQUIRED');
  return url.href;
}
function localMedia(media) {
  const match=/^data:(image\/(?:png|jpeg|webp)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/]+=*)$/.exec(media.url);
  if(!match || !match[1].startsWith(`${media.kind}/`)) throw new SocialError('Выберите файл JPEG, PNG, WebP, MP4 или WebM из медиатеки',422,'LOCAL_MEDIA_REQUIRED');
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length || bytes.length>50*1024*1024) throw new SocialError('Максимальный размер файла — 50 МБ',413);
  return {bytes, mime:match[1], extension:match[1].split('/')[1]};
}
function safeLink(value, hosts) {
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password&&hosts.some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)) ? url.href : undefined; } catch { return undefined; }
}
function cleanError(error, config={}) {
  let message=error instanceof SocialError ? error.message : 'Не удалось выполнить запрос к социальной сети';
  for(const key of ['token','clientSecret','refreshToken']) if(config[key]) message=message.split(config[key]).join('[скрыто]');
  return message.replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,100}\b/g,'[скрыто]').slice(0,600);
}
function providerFailure(platform, result, httpStatus) {
  const upstreamCode=result?.error?.code ?? result?.error?.error_code ?? result?.error_code ?? result?.code ?? (typeof result?.error==='string'?result.error:undefined) ?? httpStatus;
  const raw=result?.description ?? result?.error?.message ?? result?.error?.error_msg ?? result?.message ?? result?.error_description;
  const explanation=typeof raw==='string' ? raw.replace(/https?:\/\/\S+/g,'[ссылка]').slice(0,250) : 'Проверьте токен, права приложения и доступ к аккаунту';
  return Object.assign(new SocialError(`${NAMES[platform]}: ${explanation} (${String(upstreamCode).replace(/[^\w.-]/g,'').slice(0,80)})`,422,'PROVIDER_REJECTED'),{providerCode:upstreamCode});
}

/** Local capability-authenticated connections. No credentials are ever returned to the browser. */
export function createSocialHandler({directory=resolve('.data'), fetchImpl=fetch, resolver=lookup, pollIntervalMs=1500, maxPolls=60, statusMinIntervalMs=3000}={}) {
  let state, encryptionKey;
  const running=new Set();
  const connectionLocks=new Set();
  const refreshes=new WeakMap();
  const statusChecks=new Map();
  const signupRates=new Map();
  function persist() {
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(state),'utf8'),cipher.final()]);
    const file=join(directory,'social-connections.json'), temp=join(directory,`.social-${randomUUID()}.tmp`);
    writeFileSync(temp,JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}),{mode:0o600});
    renameSync(temp,file); chmodSync(file,0o600);
  }
  function init() {
    if(state) return;
    mkdirSync(directory,{recursive:true,mode:0o700});
    const keyFile=join(directory,'social-key');
    if(!existsSync(keyFile)) { try { writeFileSync(keyFile,randomBytes(32),{flag:'wx',mode:0o600}); } catch(error) { if(error.code!=='EEXIST') throw error; } }
    chmodSync(keyFile,0o600); encryptionKey=readFileSync(keyFile);
    if(encryptionKey.length!==32) throw new Error('Invalid social encryption key');
    const file=join(directory,'social-connections.json');
    if(!existsSync(file)) state={version:1,workspaces:{}};
    else {
      const record=JSON.parse(readFileSync(file,'utf8'));
      const decipher=createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(record.iv,'base64'));
      decipher.setAuthTag(Buffer.from(record.tag,'base64'));
      const decoded=JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data,'base64')),decipher.final()]).toString());
      if(decoded.version!==1 || !decoded.workspaces) throw new Error('Invalid social storage');
      state=decoded;
      // An interrupted final send may have succeeded remotely. Never retry it automatically.
      let changed=false;
      for(const workspace of Object.values(state.workspaces)) for(const record of Object.values(workspace.publications)) if(record.status==='pending') {record.status=record.platform==='tiktok'&&record.publishId?'processing':'unknown';record.error='Отправка была прервана. Проверьте публикацию в социальной сети.';changed=true;}
      if(changed) persist();
    }
  }
  function workspaceFor(req) {
    const id=String(req.headers['x-social-workspace']||''), key=String(req.headers['x-social-key']||'');
    const workspace=state.workspaces[id];
    if(!workspace || !/^[a-f0-9]{64}$/.test(key) || !timingSafeEqual(Buffer.from(digest(key)),Buffer.from(workspace.keyHash))) throw new SocialError('Доступ к подключениям не найден. Откройте настройки заново.',401,'WORKSPACE_ACCESS_DENIED');
    return workspace;
  }
  const publicConnection=c=>({platform:c.platform,accountId:c.accountId,accountName:c.accountName,accountHandle:c.accountHandle,connectedAt:c.connectedAt,checkedAt:c.checkedAt,status:c.status,error:c.error,capabilities:c.capabilities});
  const publicPublication=r=>({postId:r.postId,platform:r.platform,requestId:r.requestId,status:r.status,error:r.error,...r.result,...(r.publishId?{publishId:r.publishId}:{}),...(r.snapshot?{snapshot:r.snapshot}:{}),createdAt:r.createdAt});
  async function request(platform, url, options={}, finalSend=false) {
    let response, result;
    try { response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(finalSend?120000:30000)}); }
    catch { throw new SocialError(finalSend?'Ответ площадки не получен. Проверьте, появилась ли публикация, прежде чем отправлять её снова.':`Не удалось связаться с ${NAMES[platform]}. Попробуйте позже.`,502,finalSend?'PUBLISH_UNKNOWN':'NETWORK_ERROR',finalSend); }
    try { result=await response.json(); } catch { throw new SocialError('Площадка вернула некорректный ответ. Проверьте результат в социальной сети.',502,finalSend?'PUBLISH_UNKNOWN':'PROVIDER_RESPONSE',finalSend); }
    if(!response.ok || (result.error && !(platform==='tiktok'&&result.error.code==='ok')) || result.ok===false || result.success===false || platform==='max'&&result.code) {
      const error=providerFailure(platform,result,response.status);
      // A gateway/server error on the final mutation is ambiguous, even with an error body.
      if(finalSend&&response.status>=500) {error.uncertain=true;error.code='PUBLISH_UNKNOWN';error.status=502;}
      throw error;
    }
    return result;
  }
  const bearer=config=>({Authorization:`Bearer ${config.token}`});
  const form=(value)=>new URLSearchParams(Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)])));
  const telegram=(config,method,params,finalSend=false)=>request('telegram',`https://api.telegram.org/bot${config.token}/${method}`,{method:'POST',body:params instanceof FormData?params:form(params)},finalSend).then(r=>r.result);
  const vk=(config,method,params={},finalSend=false)=>request('vk',`https://api.vk.com/method/${method}`,{method:'POST',body:form({...params,access_token:config.token,v:'5.199'})},finalSend).then(r=>r.response);
  const graphBase=platform=>platform==='instagram'?`https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION||'v23.0'}`:'https://graph.threads.net/v1.0';
  const graph=(platform,config,path,params={},method='GET',finalSend=false)=>request(platform,`${graphBase(platform)}/${path}${method==='GET'?`?${form(params)}`:''}`,{method,headers:bearer(config),...(method==='GET'?{}:{body:form(params)})},finalSend);
  const max=(config,path,method='GET',body,finalSend=false)=>request('max',`https://platform-api2.max.ru${path}`,{method,headers:{Authorization:config.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})},finalSend);
  async function tiktok(config,path,body={},method='POST',finalSend=false) {
    if(config.refreshToken&&config.clientId&&config.clientSecret&&(!config.expiresAt||Date.now()>config.expiresAt-60000)) {
      let refresh=refreshes.get(config);
      if(!refresh) {
        refresh=(async()=>{
          const value=await request('tiktok','https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',body:form({client_key:config.clientId,client_secret:config.clientSecret,refresh_token:config.refreshToken,grant_type:'refresh_token'})});
          if(!value.access_token||config.account&&value.open_id!==config.account) throw new SocialError('TikTok не подтвердил обновление доступа к этому аккаунту',422,'PROVIDER_RESPONSE');
          config.token=value.access_token;config.refreshToken=value.refresh_token||config.refreshToken;config.expiresAt=Date.now()+Number(value.expires_in||86400)*1000;
          // TikTok may rotate the refresh token; save it before the next provider operation.
          persist();
        })();
        refreshes.set(config,refresh);
      }
      try {await refresh;} finally {refreshes.delete(config);}
    }
    const result=await request('tiktok',`https://open.tiktokapis.com/v2/${path}`,{method,headers:{...bearer(config),'Content-Type':'application/json; charset=UTF-8'},...(method==='GET'?{}:{body:JSON.stringify(body)})},finalSend);
    if(!result.data||typeof result.data!=='object') throw new SocialError('TikTok вернул неполные данные',502,'PROVIDER_RESPONSE',finalSend);
    return result.data;
  }
  async function tiktokCreator(config) {
    const value=await tiktok(config,'post/publish/creator_info/query/');
    const privacyLevels=Array.isArray(value.privacy_level_options)?value.privacy_level_options.filter(v=>['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'].includes(v)):[];
    if(!value.creator_username||!value.creator_nickname||!privacyLevels.length||!Number.isFinite(value.max_video_post_duration_sec)||value.max_video_post_duration_sec<=0) throw new SocialError('TikTok сейчас не разрешает публикацию. Попробуйте позже.',422,'CREATOR_UNAVAILABLE');
    return {nickname:text(value.creator_nickname,200),username:text(value.creator_username,200),privacyLevels,commentDisabled:value.comment_disabled!==false,duetDisabled:value.duet_disabled!==false,stitchDisabled:value.stitch_disabled!==false,maxVideoDurationSec:value.max_video_post_duration_sec};
  }
  async function uploadBinary(platform,url,options) {
    let response;
    try {response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});}
    catch {throw new SocialError(`Не удалось завершить загрузку в ${NAMES[platform]}.`,502,'MEDIA_UPLOAD_FAILED');}
    if(!response.ok) throw new SocialError(`${NAMES[platform]} отклонил загрузку файла (${response.status}).`,422,'MEDIA_UPLOAD_FAILED');
    return response;
  }
  async function youtube(config,url,options={},finalSend=false) {
    // Refresh before an operation whenever offline credentials are available; do not retry uploads.
    if(config.refreshToken && config.clientId && (!config.expiresAt || Date.now()>config.expiresAt-60000)) {
      const refreshed=await request('youtube','https://oauth2.googleapis.com/token',{method:'POST',body:form({client_id:config.clientId,client_secret:config.clientSecret||undefined,refresh_token:config.refreshToken,grant_type:'refresh_token'})});
      if(!refreshed.access_token) throw new SocialError('Google не вернул токен доступа',422,'PROVIDER_RESPONSE');
      config.token=refreshed.access_token; config.expiresAt=Date.now()+Number(refreshed.expires_in||3600)*1000;
    }
    return request('youtube',url,{...options,headers:{...bearer(config),...options.headers}},finalSend);
  }
  async function validateConnection(platform,config) {
    const capabilities={text:true,image:true,video:true,requiresPublicMedia:false};
    let accountId,accountName,accountHandle;
    if(platform==='telegram') {
      const bot=await telegram(config,'getMe',{});
      const chat=await telegram(config,'getChat',{chat_id:config.account});
      if(!bot?.id || !bot.is_bot || !chat?.id || !['channel','supergroup','group'].includes(chat.type)) throw new SocialError('Выберите канал или группу и добавьте туда бота',422);
      const member=await telegram(config,'getChatMember',{chat_id:chat.id,user_id:bot.id});
      if(!member || !['administrator','creator'].includes(member.status) || chat.type==='channel'&&member.status!=='creator'&&!member.can_post_messages) throw new SocialError('Добавьте бота администратором с правом публикации сообщений',422,'MISSING_PERMISSION');
      accountId=String(chat.id);accountName=chat.title||chat.username||'Telegram';accountHandle=chat.username?`@${chat.username}`:undefined;
      config.account=accountId;
    } else if(platform==='max') {
      const bot=await max(config,'/me');
      const chat=await max(config,`/chats/${config.account}`);
      const member=await max(config,`/chats/${config.account}/members/me`);
      if(!bot.is_bot||!bot.user_id||!['chat','channel'].includes(chat.type)||chat.status!=='active'||String(chat.chat_id)!==config.account||String(member.user_id)!==String(bot.user_id)) throw new SocialError('Добавьте бота в активный канал или группу МАКС и проверьте chat_id',422,'MISSING_PERMISSION');
      if(!member.is_owner&&(!member.is_admin||!Array.isArray(member.permissions)||!member.permissions.some(p=>p==='write'||p==='post_edit_delete_message'))) throw new SocialError('Боту МАКС нужны права администратора с разрешением публикации сообщений',422,'MISSING_PERMISSION');
      accountId=String(chat.chat_id);accountName=chat.title||'МАКС';config.account=accountId;
    } else if(platform==='tiktok') {
      const result=await tiktok(config,'user/info/?fields=open_id,display_name',{},'GET');
      const account=result.user;
      if(!account?.open_id||config.account&&account.open_id!==config.account) throw new SocialError('Не удалось подтвердить владельца токена TikTok',422,'ACCOUNT_MISMATCH');
      const creator=await tiktokCreator(config);
      accountId=String(account.open_id);accountName=creator.nickname;accountHandle=`@${creator.username}`;config.account=accountId;
      capabilities.text=false;capabilities.image=false;
    } else if(platform==='vk') {
      const result=await vk(config,'groups.getById',{group_ids:config.account,fields:'can_post'});
      const group=(Array.isArray(result)?result:result?.groups)?.[0];
      if(!group?.id) throw new SocialError('Сообщество VK не найдено',422);
      if(config.tokenType==='user') {
        const permissions=await vk(config,'account.getAppPermissions');
        if(!(Number(permissions)&8192)) throw new SocialError('Токену VK требуется право wall',422,'MISSING_PERMISSION');
        if(!group.is_admin || group.admin_level && group.admin_level<2) throw new SocialError('Нужен токен администратора или редактора этого сообщества',422,'MISSING_PERMISSION');
        capabilities.image=!!(Number(permissions)&4);
      } else {
        const permissions=await vk(config,'groups.getTokenPermissions');
        if(!permissions || !Array.isArray(permissions.permissions)) throw new SocialError('Проверьте ключ сообщества VK',422);
        // The group token does not support the wall-photo upload methods.
        capabilities.image=false;
      }
      capabilities.video=false;
      accountId=String(group.id);accountName=group.name||'VK';accountHandle=group.screen_name;
      config.account=accountId;
    } else if(platform==='instagram'||platform==='threads') {
      const fields=platform==='instagram'?'id,user_id,username,account_type':'id,username';
      const account=await graph(platform,config,'me',{fields});
      accountId=String(account.user_id||account.id||'');
      if(!/^\d+$/.test(accountId) || config.account&&config.account!==accountId) throw new SocialError('ID аккаунта не совпадает с владельцем токена',422);
      if(platform==='instagram'&&account.account_type&&!['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(account.account_type)) throw new SocialError('Нужен профессиональный аккаунт Instagram',422);
      // These read-only edges validate publishing access without posting a test message.
      await graph(platform,config,`${accountId}/${platform==='instagram'?'content_publishing_limit':'threads_publishing_limit'}`,{fields:'quota_usage,config'});
      accountName=account.username||NAMES[platform];accountHandle=account.username?`@${account.username}`:undefined;
      config.account=accountId;capabilities.requiresPublicMedia=true;capabilities.text=platform==='threads';
    } else if(platform==='youtube') {
      const response=await youtube(config,'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true');
      const channel=response.items?.find(c=>!config.account||c.id===config.account);
      if(!channel?.id) throw new SocialError('Для токена не найден указанный канал YouTube',422);
      accountId=channel.id;accountName=channel.snippet?.title||'YouTube';accountHandle=channel.snippet?.customUrl;
      config.account=accountId;capabilities.text=false;capabilities.image=false;
    }
    return {platform,accountId,accountName:text(accountName,200),accountHandle:text(accountHandle,200)||undefined,capabilities,status:'connected',checkedAt:now(),config};
  }
  async function preparePost(input,connection) {
    const {platform}=connection;
    if(!/^[\w-]{1,150}$/.test(input.postId||'') || !/^[\w-]{8,150}$/.test(input.requestId||'')) throw new SocialError('Некорректный идентификатор публикации');
    const body=typeof input.body==='string'?input.body.trim():'';
    if(body.length>LIMITS[platform]) throw new SocialError(`${NAMES[platform]}: текст не должен превышать ${LIMITS[platform]} символов`,422,'TEXT_LIMIT');
    let media;
    if(input.media) {
      if(!['image','video'].includes(input.media.kind)||typeof input.media.url!=='string') throw new SocialError('Некорректный медиафайл');
      if(!connection.capabilities[input.media.kind]) throw new SocialError(`Это подключение ${NAMES[platform]} не поддерживает выбранный формат`,422,'UNSUPPORTED_MEDIA');
      media={kind:input.media.kind,url:input.media.url};
      if(platform==='instagram'||platform==='threads') media.url=await publicURL(media.url,resolver);
      else if(platform==='telegram'&&!media.url.startsWith('data:')) media.url=await publicURL(media.url,resolver);
      else Object.assign(media,localMedia(media));
      if(platform==='telegram'&&media.kind==='image'&&media.bytes?.length>10*1024*1024) throw new SocialError('Telegram: изображение должно быть меньше 10 МБ',413);
      if(platform==='telegram'&&media.kind==='video'&&media.mime&&media.mime!=='video/mp4') throw new SocialError('Для видео в Telegram выберите файл MP4',422,'UNSUPPORTED_MEDIA');
      if(platform==='max'&&media.kind==='image'&&!['image/jpeg','image/png'].includes(media.mime)) throw new SocialError('Для изображения в МАКС выберите JPEG или PNG',422,'UNSUPPORTED_MEDIA');
      if(platform==='telegram'&&body.length>1024) throw new SocialError('Подпись к фото или видео Telegram — до 1024 символов',422,'TEXT_LIMIT');
    }
    if(!body&&!media) throw new SocialError('Добавьте текст или медиафайл');
    if(!media&&!connection.capabilities.text) throw new SocialError(`${NAMES[platform]} требует ${['youtube','tiktok'].includes(platform)?'видео':'изображение или видео'}`,422,'MEDIA_REQUIRED');
    const title=text(input.title,100)||body.slice(0,100)||'Публикация';
    if(platform==='youtube'&&/[<>]/.test(title)) throw new SocialError('Название видео не должно содержать символы < и >',422);
    const visibility=platform==='youtube'?(input.visibility||'private'):undefined;
    if(visibility&&!['private','unlisted','public'].includes(visibility)) throw new SocialError('Выберите видимость видео');
    let tiktokOptions;
    if(platform==='tiktok') {
      const options=input.tiktok||{};
      if(options.consent!==true) throw new SocialError('Подтвердите отправку и условия использования музыки TikTok',422,'CONSENT_REQUIRED');
      const creator=await tiktokCreator(connection.config);
      if(!creator.privacyLevels.includes(options.privacyLevel)) throw new SocialError('Выберите доступную видимость видео в TikTok',422,'PRIVACY_REQUIRED');
      const duration=Number(options.durationSec);
      if(!Number.isFinite(duration)||duration<=0||duration>creator.maxVideoDurationSec) throw new SocialError(`TikTok: длительность видео должна быть не больше ${creator.maxVideoDurationSec} секунд`,422,'VIDEO_DURATION');
      if(options.allowComment&&creator.commentDisabled||options.allowDuet&&creator.duetDisabled||options.allowStitch&&creator.stitchDisabled) throw new SocialError('Настройки взаимодействий TikTok изменились. Откройте окно публикации заново.',422,'INTERACTION_DISABLED');
      if(options.commercialContent&&!(options.brandOrganic||options.brandedContent)) throw new SocialError('Выберите свой бренд или платное партнёрство',422,'DISCLOSURE_REQUIRED');
      if(options.brandedContent&&options.privacyLevel==='SELF_ONLY') throw new SocialError('Платное партнёрство нельзя публиковать с видимостью «Только я»',422,'DISCLOSURE_PRIVACY');
      if(!options.commercialContent&&(options.brandOrganic||options.brandedContent)) throw new SocialError('Включите указание рекламного характера публикации',422,'DISCLOSURE_REQUIRED');
      tiktokOptions={privacy_level:options.privacyLevel,disable_comment:options.allowComment!==true,disable_duet:options.allowDuet!==true,disable_stitch:options.allowStitch!==true,brand_organic_toggle:options.brandOrganic===true,brand_content_toggle:options.brandedContent===true,is_aigc:options.isAigc===true};
    }
    return {postId:input.postId,requestId:input.requestId,platform,body,title,media,visibility,tiktokOptions};
  }
  async function publish(connection,post,record) {
    const {platform,config}=connection; let id,url,visibility;
    const finalCall=async callback=>{record.finalSendStarted=true;persist();return callback();};
    if(platform==='max') {
      let attachments;
      if(post.media) {
        const media=post.media;
        const upload=await max(config,`/uploads?type=${media.kind}`,'POST');
        const uploadURL=safeLink(upload.url,['max.ru','oneme.ru','okcdn.ru']);
        if(!uploadURL) throw new SocialError('МАКС не вернул допустимый адрес загрузки',502,'PROVIDER_RESPONSE');
        const data=new FormData();data.set('data',new Blob([media.bytes],{type:media.mime}),`media.${media.extension}`);
        const response=await uploadBinary('max',uploadURL,{method:'POST',body:data,...(media.kind==='image'?{headers:{Authorization:config.token}}:{})});
        let token=upload.token;
        if(media.kind==='image') {
          let result;try {result=await response.json();} catch {throw new SocialError('МАКС не подтвердил загрузку изображения',502,'PROVIDER_RESPONSE');}
          token=Object.values(result.photos||{}).find(photo=>typeof photo?.token==='string')?.token;
        } else {
          const body=await response.text();
          if(!/<retval>\s*1\s*<\/retval>/.test(body)) throw new SocialError('МАКС не подтвердил загрузку видео',502,'PROVIDER_RESPONSE');
        }
        if(typeof token!=='string'||!token) throw new SocialError('МАКС не вернул токен загруженного файла',502,'PROVIDER_RESPONSE');
        attachments=[{type:media.kind,payload:{token}}];
      }
      let result;
      for(let attempt=0;attempt<5;attempt++) {
        try {result=await finalCall(()=>max(config,`/messages?chat_id=${encodeURIComponent(connection.accountId)}`,'POST',{text:post.body||undefined,...(attachments?{attachments}:{})},true));break;}
        catch(error) {
          // This explicit rejection guarantees no message was created. Never retry ambiguous sends.
          if(error.providerCode!=='attachment.not.ready'||error.uncertain||attempt===4) throw error;
          await wait(pollIntervalMs*(2**attempt));
        }
      }
      const message=result?.message||result;
      if(typeof message?.body?.mid!=='string'||!message.body.mid) throw new SocialError('МАКС не подтвердил публикацию. Проверьте канал.',502,'PUBLISH_UNKNOWN',true);
      id=message.body.mid;url=safeLink(message.url,['max.ru','max.im']);
    } else if(platform==='tiktok') {
      const media=post.media;
      // The local upload is <= 50 MB, so it fits one documented <= 64 MB chunk.
      const initialized=await finalCall(()=>tiktok(config,'post/publish/video/init/',{post_info:{title:post.body,...post.tiktokOptions},source_info:{source:'FILE_UPLOAD',video_size:media.bytes.length,chunk_size:media.bytes.length,total_chunk_count:1}},'POST',true));
      if(typeof initialized.publish_id!=='string'||!initialized.publish_id) throw new SocialError('TikTok не подтвердил начало загрузки. Проверьте аккаунт.',502,'PUBLISH_UNKNOWN',true);
      // Save the provider's identifier before sending bytes. Even an interrupted upload is recoverable by status.
      record.publishId=initialized.publish_id;record.accountId=connection.accountId;record.status='processing';record.result={platform,publishId:initialized.publish_id,visibility:post.tiktokOptions.privacy_level};persist();
      const uploadURL=safeLink(initialized.upload_url,['tiktokapis.com']);
      if(!uploadURL) {record.error='TikTok вернул недопустимый адрес загрузки. Проверьте состояние отправки.';persist();return record.result;}
      try {
        const uploaded=await uploadBinary('tiktok',uploadURL,{method:'PUT',headers:{'Content-Type':media.mime,'Content-Length':String(media.bytes.length),'Content-Range':`bytes 0-${media.bytes.length-1}/${media.bytes.length}`},body:media.bytes});
        if(uploaded.status!==201) throw new SocialError('TikTok ещё не подтвердил загрузку полного файла',502,'MEDIA_UPLOAD_FAILED');
      } catch(error) {record.error=cleanError(error,config);persist();return record.result;}
      // Upload acknowledgement is not publication. Confirmation comes only from /status/fetch/.
      return record.result;
    } else if(platform==='telegram') {
      let result;
      if(post.media) {
        const method=post.media.kind==='image'?'sendPhoto':'sendVideo',field=post.media.kind==='image'?'photo':'video';
        const data=new FormData();data.set('chat_id',connection.accountId);data.set('caption',post.body);
        data.set(field,post.media.bytes?new Blob([post.media.bytes],{type:post.media.mime}):post.media.url,...(post.media.bytes?[`media.${post.media.extension}`]:[]));
        if(post.media.kind==='video')data.set('supports_streaming','true');
        result=await finalCall(()=>telegram(config,method,data,true));
      } else result=await finalCall(()=>telegram(config,'sendMessage',{chat_id:connection.accountId,text:post.body},true));
      if(!Number.isSafeInteger(result?.message_id)) throw new SocialError('Telegram не подтвердил публикацию. Проверьте канал.',502,'PUBLISH_UNKNOWN',true);
      id=String(result.message_id);
      if(connection.accountHandle) url=`https://t.me/${connection.accountHandle.slice(1)}/${id}`;
      else if(connection.accountId.startsWith('-100')) url=`https://t.me/c/${connection.accountId.slice(4)}/${id}`;
    } else if(platform==='vk') {
      let attachments;
      if(post.media) {
        const upload=await vk(config,'photos.getWallUploadServer',{group_id:connection.accountId});
        const uploadURL=safeLink(upload?.upload_url,['vk.com','vk.ru','userapi.com','vkuserphoto.ru']);
        if(!uploadURL) throw new SocialError('VK не вернул допустимый адрес загрузки',502,'PROVIDER_RESPONSE');
        const data=new FormData();data.set('photo',new Blob([post.media.bytes],{type:post.media.mime}),`image.${post.media.extension}`);
        const file=await request('vk',uploadURL,{method:'POST',body:data});
        if(!file.photo||!file.server||!file.hash) throw new SocialError('VK не подтвердил загрузку изображения',502,'PROVIDER_RESPONSE');
        const saved=await vk(config,'photos.saveWallPhoto',{group_id:connection.accountId,photo:file.photo,server:file.server,hash:file.hash});
        if(!saved?.[0]?.id||!saved[0].owner_id) throw new SocialError('VK не подтвердил сохранение изображения',502,'PROVIDER_RESPONSE');
        attachments=`photo${saved[0].owner_id}_${saved[0].id}${saved[0].access_key?`_${saved[0].access_key}`:''}`;
      }
      const result=await finalCall(()=>vk(config,'wall.post',{owner_id:`-${connection.accountId}`,from_group:1,message:post.body,attachments,guid:digest(`${record.workspaceId}:${post.postId}:${connection.accountId}`)},true));
      if(!Number.isSafeInteger(result?.post_id)) throw new SocialError('VK не подтвердил публикацию. Проверьте стену сообщества.',502,'PUBLISH_UNKNOWN',true);
      id=String(result.post_id);url=`https://vk.com/wall-${connection.accountId}_${id}`;
    } else if(platform==='instagram'||platform==='threads') {
      const params=platform==='instagram'?{caption:post.body}:{text:post.body,media_type:'TEXT'};
      if(post.media) {params[post.media.kind==='image'?'image_url':'video_url']=post.media.url; if(platform==='threads'||post.media.kind==='video') params.media_type=post.media.kind==='image'?'IMAGE':platform==='instagram'?'REELS':'VIDEO';}
      const container=await graph(platform,config,`${connection.accountId}/${platform==='instagram'?'media':'threads'}`,params,'POST');
      if(!/^\d+$/.test(String(container.id))) throw new SocialError('Площадка не создала контейнер публикации',502,'PROVIDER_RESPONSE');
      record.containerId=String(container.id);persist();
      let ready=false;
      for(let attempt=0;attempt<maxPolls;attempt++) {
        const status=await graph(platform,config,container.id,{fields:platform==='instagram'?'status_code':'status'});
        const code=status.status_code||status.status;
        if(code==='FINISHED') {ready=true;break;}
        if(['ERROR','EXPIRED'].includes(code)) throw new SocialError(`${NAMES[platform]} не удалось обработать медиафайл. Проверьте формат и доступность ссылки.`,422,'MEDIA_PROCESSING_FAILED');
        if(code==='PUBLISHED') throw new SocialError('Контейнер уже опубликован. Проверьте аккаунт.',409,'PUBLISH_UNKNOWN',true);
        if(attempt<maxPolls-1) await wait(pollIntervalMs);
      }
      if(!ready) throw new SocialError('Площадка ещё обрабатывает медиафайл. Публикация не отправлена; попробуйте позже.',422,'MEDIA_PROCESSING_TIMEOUT');
      const result=await finalCall(()=>graph(platform,config,`${connection.accountId}/${platform==='instagram'?'media_publish':'threads_publish'}`,{creation_id:container.id},'POST',true));
      if(!/^\d+$/.test(String(result.id))) throw new SocialError('Площадка не подтвердила публикацию. Проверьте аккаунт.',502,'PUBLISH_UNKNOWN',true);
      id=String(result.id);
      // Persist acknowledgement before the optional permalink lookup, which must never trigger a retry.
      record.result={id,platform,publishedAt:now()};record.status='published';persist();
      try { const details=await graph(platform,config,id,{fields:'permalink'});url=safeLink(details.permalink,platform==='instagram'?['instagram.com']:['threads.net','threads.com']); } catch { /* Publication is already acknowledged. */ }
    } else if(platform==='youtube') {
      const media=post.media;
      const boundary=`labrika_${randomBytes(12).toString('hex')}`;
      const metadata={snippet:{title:post.title,description:post.body},status:{privacyStatus:post.visibility}};
      const payload=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${media.mime}\r\n\r\n`),media.bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const result=await finalCall(()=>youtube(config,'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:payload},true));
      if(!/^[A-Za-z0-9_-]{6,30}$/.test(result.id||'')) throw new SocialError('YouTube не подтвердил загрузку. Проверьте канал.',502,'PUBLISH_UNKNOWN',true);
      id=result.id;url=`https://www.youtube.com/watch?v=${id}`;visibility=result.status?.privacyStatus||post.visibility;
    }
    return {id,url,platform,publishedAt:record.result?.publishedAt||now(),...(visibility?{visibility}: {})};
  }
  async function checkTikTokPublication(connection,record) {
    if(record.accountId!==connection.accountId) throw new SocialError('Подключите тот аккаунт TikTok, в который отправлено видео',409,'ACCOUNT_MISMATCH');
    const result=await tiktok(connection.config,'post/publish/status/fetch/',{publish_id:record.publishId});
    if(result.status==='PUBLISH_COMPLETE') {
      const candidates=result.publicaly_available_post_id||result.publicly_available_post_id||[];
      const publicId=Array.isArray(candidates)?candidates.map(String).find(v=>/^\d+$/.test(v)):undefined;
      record.status='published';delete record.error;
      record.result={...record.result,id:publicId||`tiktok:${record.publishId}`,publishedAt:record.result?.publishedAt||now(),...(publicId?{url:`https://www.tiktok.com/@${encodeURIComponent((connection.accountHandle||'').replace(/^@/,''))}/video/${publicId}`}:{})};
    } else if(result.status==='FAILED') {
      record.status='failed';record.error=`TikTok не опубликовал видео: ${text(String(result.fail_reason||'ошибка обработки'),200).replace(/[^\w .-]/g,'')}`;
    } else if(['PROCESSING_UPLOAD','PROCESSING_DOWNLOAD','SEND_TO_USER_INBOX'].includes(result.status)) {
      record.status='processing';delete record.error;
    } else throw new SocialError('TikTok вернул неизвестный статус. Проверьте позже.',502,'PROVIDER_RESPONSE');
    record.checkedAt=now();persist();return record;
  }
  return async function social(req,res,next) {
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/api/social/')) return next();
    let activeConfig;
    try {
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) throw new SocialError('Запрос с другого сайта отклонён',403,'CROSS_ORIGIN');
      init();
      if(url.pathname==='/api/social/workspaces' && req.method==='POST') {
        const input=await readBody(req);
        if(input.edition!=='labrika' || input.workspaceId || input.workspaceKey) throw new SocialError('Пространство создаётся автоматически');
        const ip=req.socket?.remoteAddress||'local', previous=signupRates.get(ip);
        const rate=previous&&Date.now()-previous.started<60000?previous:{started:Date.now(),count:0};
        if(++rate.count>30 || Object.keys(state.workspaces).length>=500) throw new SocialError('Слишком много запросов. Повторите позже.',429);
        signupRates.set(ip,rate);
        const workspaceId=randomUUID(), workspaceKey=randomBytes(32).toString('hex');
        state.workspaces[workspaceId]={id:workspaceId,edition:input.edition,keyHash:digest(workspaceKey),createdAt:now(),connections:{},publications:{}};persist();
        return send(res,201,{workspaceId,workspaceKey});
      }
      const workspace=workspaceFor(req);
      if(url.pathname==='/api/social/connections' && req.method==='GET') return send(res,200,{connections:Object.values(workspace.connections).map(publicConnection)});
      if(url.pathname==='/api/social/publications' && req.method==='GET') return send(res,200,{publications:Object.values(workspace.publications).filter(r=>!url.searchParams.has('postId')||r.postId===url.searchParams.get('postId')).map(publicPublication)});
      if(url.pathname==='/api/social/connections/tiktok/creator-info'&&req.method==='POST') {
        const connection=workspace.connections.tiktok;
        if(!connection) throw new SocialError('Сначала подключите TikTok в настройках',422,'NOT_CONNECTED');
        activeConfig=connection.config;
        return send(res,200,{creator:await tiktokCreator(connection.config)});
      }
      const statusRoute=url.pathname.match(/^\/api\/social\/publications\/tiktok\/([\w-]{1,150})\/check$/);
      if(statusRoute&&req.method==='POST') {
        const record=workspace.publications[`${statusRoute[1]}:tiktok`],connection=workspace.connections.tiktok;
        if(!record?.publishId) throw new SocialError('Отправка TikTok не найдена',404,'NOT_FOUND');
        if(record.status==='failed'||record.status==='published'&&record.result?.url) return send(res,200,{publication:publicPublication(record)});
        if(!connection) throw new SocialError('Подключите TikTok, чтобы проверить отправку',422,'NOT_CONNECTED');
        activeConfig=connection.config;
        const key=`${workspace.id}:${record.postId}`;
        let pending=statusChecks.get(key);
        if(!pending) {
          // Cache checks for at least 3s: the provider allows 30 requests/minute per token.
          if(record.checkedAt&&Date.now()-Date.parse(record.checkedAt)<statusMinIntervalMs) return send(res,200,{publication:publicPublication(record)});
          pending=checkTikTokPublication(connection,record);statusChecks.set(key,pending);
        }
        try {await pending;return send(res,200,{publication:publicPublication(record)});} finally {statusChecks.delete(key);}
      }
      if(url.pathname==='/api/social/connections' && req.method==='POST') {
        const input=await readBody(req), platform=input.platform;activeConfig=configFor(platform,input.config);
        const lock=`${workspace.id}:${platform}`;
        if(connectionLocks.has(lock)) throw new SocialError('Подключение уже обновляется',409);
        connectionLocks.add(lock);
        try { const connection=await validateConnection(platform,activeConfig);connection.connectedAt=workspace.connections[platform]?.connectedAt||now();workspace.connections[platform]=connection;persist();return send(res,200,{connection:publicConnection(connection)}); }
        finally { connectionLocks.delete(lock); }
      }
      const connectionRoute=url.pathname.match(/^\/api\/social\/connections\/(telegram|vk|instagram|threads|youtube|max|tiktok)(?:\/(check))?$/);
      if(connectionRoute) {
        const platform=connectionRoute[1],connection=workspace.connections[platform];
        if(!connection) throw new SocialError('Подключение не найдено',404);
        activeConfig=connection.config;
        const lock=`${workspace.id}:${platform}`;
        if(connectionLocks.has(lock)) throw new SocialError('Подключение уже обновляется',409);
        if(req.method==='DELETE'&&!connectionRoute[2]) {delete workspace.connections[platform];persist();return send(res,200,{removed:true});}
        if(req.method==='POST'&&connectionRoute[2]==='check') {
          connectionLocks.add(lock);
          try { const checked=await validateConnection(platform,connection.config);workspace.connections[platform]={...connection,...checked,error:undefined};persist();return send(res,200,{connection:publicConnection(workspace.connections[platform])}); }
          catch(error) {connection.status='error';connection.error=cleanError(error,activeConfig);connection.checkedAt=now();persist();throw error;}
          finally {connectionLocks.delete(lock);}
        }
      }
      if(url.pathname==='/api/social/publish' && req.method==='POST') {
        const input=await readBody(req), connection=workspace.connections[input.platform];
        if(!connection) throw new SocialError('Сначала подключите площадку в настройках',422,'NOT_CONNECTED');
        activeConfig=connection.config;
        if(!/^[\w-]{1,150}$/.test(input.postId||'')) throw new SocialError('Некорректный идентификатор публикации');
        const recordKey=`${input.postId}:${input.platform}`, existing=workspace.publications[recordKey];
        if(existing?.status==='published') return send(res,200,{publication:publicPublication(existing),reused:true});
        if(existing?.status==='processing') return send(res,202,{publication:publicPublication(existing),reused:true});
        if(existing&&['pending','unknown'].includes(existing.status)) throw new SocialError(existing.status==='pending'?'Публикация уже отправляется':'Результат предыдущей отправки неизвестен. Проверьте аккаунт в социальной сети. Повторная отправка остановлена, чтобы не создать дубликат.',409,existing.status==='pending'?'PUBLISH_PENDING':'PUBLISH_UNKNOWN');
        if(Object.values(workspace.publications).some(r=>r.requestId===input.requestId && (r.postId!==input.postId||r.platform!==input.platform))) throw new SocialError('Этот идентификатор запроса уже использован',409,'IDEMPOTENCY_CONFLICT');
        const lock=`${workspace.id}:${recordKey}`;
        if(running.has(lock)) throw new SocialError('Публикация уже отправляется',409,'PUBLISH_PENDING');
        running.add(lock);
        try {
          const post=await preparePost(input,connection);
          const record={workspaceId:workspace.id,postId:post.postId,platform:post.platform,requestId:post.requestId,status:'pending',createdAt:now(),finalSendStarted:false};
          if(post.platform==='tiktok') record.snapshot={title:post.title,body:post.body,media:{kind:post.media.kind,url:post.media.url}};
          workspace.publications[recordKey]=record;persist();
          try {record.result=await publish(connection,post,record);if(record.status!=='processing') record.status='published';connection.status='connected';delete connection.error;persist();return send(res,record.status==='processing'?202:200,{publication:publicPublication(record)});}
          catch(error) {
            if(record.status==='published'&&record.result) return send(res,200,{publication:publicPublication(record)});
            if(record.platform==='tiktok'&&record.publishId) {record.status='processing';record.error=cleanError(error,activeConfig);persist();return send(res,202,{publication:publicPublication(record)});}
            record.status=error.uncertain || !(error instanceof SocialError)&&record.finalSendStarted?'unknown':'failed';record.error=cleanError(error,activeConfig);persist();throw error;
          }
        } finally {running.delete(lock);}
      }
      throw new SocialError('Метод не поддерживается',404,'NOT_FOUND');
    } catch(error) {send(res,error instanceof SocialError?error.status:500,{error:cleanError(error,activeConfig),code:error instanceof SocialError?error.code:'INTERNAL_ERROR'});}
  };
}
