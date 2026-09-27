import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSocialHandler} from './social-service.mjs';
const token='123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5o8AAAAASUVORK5CYII=';
const video='data:video/mp4;base64,AAAAHGZ0eXBtcDQy';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function mockProvider(){const calls=[];const state={canPost:true,sendError:false,sendTimeout:false};return{state,calls,fetch:async(url,options={})=>{const u=new URL(url);const method=u.pathname.split('/').at(-1);calls.push({url,method,options});if(u.hostname==='api.telegram.org'){
 if(method==='getMe')return response({ok:true,result:{id:42,is_bot:true,username:'test_bot'}});
 if(method==='getChat')return response({ok:true,result:{id:-100987654321,title:'Brand channel',username:'brand_channel',type:'channel'}});
 if(method==='getChatMember')return response({ok:true,result:{status:'administrator',can_post_messages:state.canPost}});
 if(['sendMessage','sendPhoto','sendVideo'].includes(method)){if(state.sendTimeout)throw new Error(`Network details containing ${token}`);if(state.sendError)return response({ok:false,description:`Unauthorized ${token}`,error_code:403},403);return response({ok:true,result:{message_id:23}});}
 }throw new Error(`Unexpected provider call ${u.hostname}/${method}`);}};}
async function setup(t,provider=mockProvider(),directory){const dir=directory||mkdtempSync(join(tmpdir(),'social-test-'));if(!directory)t.after(()=>rmSync(dir,{recursive:true,force:true}));const handler=createSocialHandler({directory:dir,fetchImpl:provider.fetch,resolver:async()=>[{address:'93.184.216.34',family:4}],pollIntervalMs:0,statusMinIntervalMs:0});const server=createServer((req,res)=>handler(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});const origin=`http://127.0.0.1:${server.address().port}`;const api=async(path,method='GET',body,owner,headers={})=>{const r=await fetch(`${origin}/api/social${path}`,{method,headers:{'Content-Type':'application/json',...(owner?{'X-Social-Workspace':owner.workspaceId,'X-Social-Key':owner.workspaceKey}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,value:await r.json()};};const owner=(await api('/workspaces','POST',{edition:'ygroup'})).value;const connect=(platform='telegram',config={token,account:'@brand_channel'})=>api('/connections','POST',{platform,config},owner);const send=(patch={})=>api('/publish','POST',{postId:'post_1',platform:'telegram',requestId:'request_1',title:'Material',body:'Publication body',...patch},owner);return{api,owner,connect,send,provider,directory:dir};}

test('connection validates Telegram permissions, stores encrypted secrets and survives restart',async t=>{const s=await setup(t);const result=await s.connect();assert.equal(result.status,200);assert.equal(result.value.connection.accountName,'Brand channel');assert.equal(result.value.connection.status,'connected');assert.deepEqual(s.provider.calls.map(c=>c.method),['getMe','getChat','getChatMember']);assert.ok(!JSON.stringify(result).includes(token));const saved=readFileSync(join(s.directory,'social-connections.json'),'utf8');assert.ok(!saved.includes(token));assert.ok(!saved.includes('Brand channel'));assert.equal(statSync(join(s.directory,'social-key')).mode&0o777,0o600);assert.equal(statSync(join(s.directory,'social-connections.json')).mode&0o777,0o600);
 const restarted=await setup(t,s.provider,s.directory);const read=await restarted.api('/connections','GET',undefined,s.owner);assert.equal(read.value.connections.length,1);assert.equal(read.value.connections[0].accountId,'-100987654321');});

test('workspaces isolate connections and reject guessed credentials, origin and unsupported platform',async t=>{const s=await setup(t);await s.connect();const other=(await s.api('/workspaces','POST',{edition:'labrika'})).value;assert.deepEqual((await s.api('/connections','GET',undefined,other)).value.connections,[]);for(const key of ['',s.owner.workspaceKey+'0','é'.repeat(64),other.workspaceKey])assert.equal((await s.api('/connections','GET',undefined,{...s.owner,workspaceKey:key})).status,401);assert.equal((await s.api('/connections','GET',undefined,s.owner,{Origin:'https://evil.example'})).status,403);assert.equal((await s.api('/workspaces','POST',{edition:'labrika',workspaceId:s.owner.workspaceId})).status,400);assert.equal((await s.connect('dzen',{token:'not-used'})).status,422);});

test('missing Telegram posting permissions do not create or overwrite a working connection',async t=>{const s=await setup(t);s.provider.state.canPost=false;assert.equal((await s.connect()).status,422);assert.deepEqual((await s.api('/connections','GET',undefined,s.owner)).value.connections,[]);s.provider.state.canPost=true;await s.connect();s.provider.state.canPost=false;assert.equal((await s.connect('telegram',{token:'234567891:ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',account:'@brand_channel'})).status,422);assert.equal((await s.api('/connections','GET',undefined,s.owner)).value.connections[0].status,'connected');assert.equal((await s.api('/connections/telegram/check','POST',{},s.owner)).status,422);assert.equal((await s.api('/connections','GET',undefined,s.owner)).value.connections[0].status,'error');});

test('real publish call is idempotent by post and platform, with a recoverable receipt',async t=>{const s=await setup(t);await s.connect();const first=await s.send();assert.equal(first.status,200);assert.equal(first.value.publication.id,'23');assert.equal(first.value.publication.url,'https://t.me/brand_channel/23');assert.equal(first.value.publication.status,'published');assert.equal((await s.send({requestId:'another_request',body:'Edited text'})).value.reused,true);assert.equal(s.provider.calls.filter(c=>c.method==='sendMessage').length,1);const history=await s.api('/publications?postId=post_1','GET',undefined,s.owner);assert.equal(history.value.publications.length,1);assert.equal(history.value.publications[0].status,'published');assert.equal((await s.send({postId:'post_2'})).status,409);});

test('Telegram sends actual binary photo and mp4 forms and enforces caption limit',async t=>{const s=await setup(t);await s.connect();assert.equal((await s.send({media:{kind:'image',url:png}})).status,200);let sent=s.provider.calls.find(c=>c.method==='sendPhoto');assert.ok(sent.options.body instanceof FormData);assert.equal(sent.options.body.get('chat_id'),'-100987654321');assert.equal(sent.options.body.get('photo').type,'image/png');assert.equal((await sent.options.body.get('photo').arrayBuffer()).byteLength,68);assert.equal((await s.send({postId:'video_post',requestId:'video_req',media:{kind:'video',url:video}})).status,200);assert.equal(s.provider.calls.filter(c=>c.method==='sendVideo').length,1);assert.equal((await s.send({postId:'caption_post',requestId:'caption_req',body:'x'.repeat(1025),media:{kind:'image',url:png}})).status,422);assert.equal((await s.send({postId:'webm_post',requestId:'webm_req1',media:{kind:'video',url:'data:video/webm;base64,AAAA'}})).status,422);});

test('provider rejection is recoverable, secrets are redacted and uncertain sends never retry',async t=>{const s=await setup(t);await s.connect();s.provider.state.sendError=true;const rejected=await s.send();assert.equal(rejected.status,422);assert.ok(!JSON.stringify(rejected).includes(token));s.provider.state.sendError=false;assert.equal((await s.send()).status,200);s.provider.state.sendTimeout=true;const uncertain=await s.send({postId:'post_2',requestId:'request_2'});assert.equal(uncertain.value.code,'PUBLISH_UNKNOWN');assert.ok(!JSON.stringify(uncertain).includes(token));const before=s.provider.calls.length;assert.equal((await s.send({postId:'post_2',requestId:'request_2'})).status,409);assert.equal(s.provider.calls.length,before);const restarted=await setup(t,s.provider,s.directory);const result=await restarted.api('/publish','POST',{postId:'post_2',requestId:'request_2',platform:'telegram',body:'Retry'},s.owner);assert.equal(result.status,409);});

test('disconnect removes only selected connection and stops new sends',async t=>{const s=await setup(t);await s.connect();assert.equal((await s.api('/connections/telegram','DELETE',undefined,s.owner)).status,200);assert.deepEqual((await s.api('/connections','GET',undefined,s.owner)).value.connections,[]);assert.equal((await s.send()).value.code,'NOT_CONNECTED');});

test('Threads publishes a text container and refuses private media URLs before creating a container',async t=>{const calls=[];const provider={fetch:async(url,options={})=>{const u=new URL(url);calls.push({url,options});if(u.pathname.endsWith('/me'))return response({id:'12345',username:'brand'});if(u.pathname.endsWith('/threads_publishing_limit'))return response({data:[{quota_usage:0}]});if(u.pathname.endsWith('/threads')&&options.method==='POST')return response({id:'44444'});if(u.pathname.endsWith('/44444'))return response({status:'FINISHED'});if(u.pathname.endsWith('/threads_publish'))return response({id:'55555'});if(u.pathname.endsWith('/55555'))return response({permalink:'https://www.threads.net/@brand/post/abc'});throw Error('Unexpected request');}};const s=await setup(t,provider);assert.equal((await s.connect('threads',{token:'threads-secret'})).status,200);const published=await s.send({platform:'threads'});assert.equal(published.status,200);assert.equal(published.value.publication.id,'55555');assert.equal(calls.find(c=>c.url.endsWith('/12345/threads')).options.body.get('media_type'),'TEXT');const count=calls.length;for(const url of ['http://example.com/file.jpg','https://127.0.0.1/file.jpg','https://192.168.1.1/file.jpg','https://[::1]/file.jpg'])assert.equal((await s.send({platform:'threads',postId:'private_media',requestId:'private_request',media:{kind:'image',url}})).status,422);assert.equal(calls.length,count);});

test('VK verifies wall scope and sends a community wall post with stable guid',async t=>{const calls=[];const provider={fetch:async(url,options={})=>{calls.push({url,options});if(url.endsWith('/groups.getById'))return response({response:{groups:[{id:77,name:'Brand VK',screen_name:'brand',is_admin:1,admin_level:3}]}});if(url.endsWith('/account.getAppPermissions'))return response({response:8192|4});if(url.endsWith('/wall.post'))return response({response:{post_id:123}});throw Error('Unexpected request');}};const s=await setup(t,provider);assert.equal((await s.connect('vk',{token:'vk-secret',account:'77'})).status,200);const sent=await s.send({platform:'vk'});assert.equal(sent.status,200);assert.equal(sent.value.publication.url,'https://vk.com/wall-77_123');const wall=calls.at(-1).options.body;assert.equal(wall.get('owner_id'),'-77');assert.equal(wall.get('from_group'),'1');assert.ok(wall.get('guid'));});

test('Instagram validates the professional account and publishes a publicly hosted image',async t=>{const calls=[];const provider={fetch:async(url,options={})=>{const u=new URL(url);calls.push({url,options});if(u.pathname.endsWith('/me'))return response({user_id:'12345',id:'99999',username:'brand',account_type:'BUSINESS'});if(u.pathname.endsWith('/content_publishing_limit'))return response({data:[{quota_usage:0}]});if(u.pathname.endsWith('/media'))return response({id:'44444'});if(u.pathname.endsWith('/44444'))return response({status_code:'FINISHED'});if(u.pathname.endsWith('/media_publish'))return response({id:'55555'});if(u.pathname.endsWith('/55555'))return response({permalink:'https://www.instagram.com/p/abc'});throw Error('Unexpected request');}};const s=await setup(t,provider);assert.equal((await s.connect('instagram',{token:'ig-secret',account:'12345'})).status,200);assert.equal((await s.send({platform:'instagram'})).value.code,'MEDIA_REQUIRED');assert.equal((await s.send({platform:'instagram',media:{kind:'image',url:png}})).value.code,'PUBLIC_MEDIA_REQUIRED');const result=await s.send({platform:'instagram',media:{kind:'image',url:'https://media.example.com/photo.jpg'}});assert.equal(result.status,200);assert.equal(result.value.publication.url,'https://www.instagram.com/p/abc');assert.equal(calls.find(c=>c.url.endsWith('/media')).options.body.get('image_url'),'https://media.example.com/photo.jpg');});

test('YouTube refresh credentials stay private and actual multipart upload preserves requested visibility',async t=>{const calls=[];const provider={fetch:async(url,options={})=>{calls.push({url,options});if(url==='https://oauth2.googleapis.com/token')return response({access_token:'refreshed-secret',expires_in:3600});if(url.includes('/channels?'))return response({items:[{id:'UC1234567890',snippet:{title:'Brand channel'}}]});if(url.includes('/upload/youtube/v3/videos'))return response({id:'abc123video',status:{privacyStatus:'unlisted'}});throw Error('Unexpected request');}};const s=await setup(t,provider);const connection=await s.connect('youtube',{clientId:'client-id',clientSecret:'client-secret',refreshToken:'refresh-secret'});assert.equal(connection.status,200);assert.ok(!JSON.stringify(connection).includes('secret'));assert.equal((await s.send({platform:'youtube',media:{kind:'video',url:video},visibility:'unlisted'})).status,200);const uploaded=calls.find(c=>c.url.includes('/upload/'));assert.equal(uploaded.options.headers.Authorization,'Bearer refreshed-secret');assert.ok(uploaded.options.body.toString().includes('"privacyStatus":"unlisted"'));assert.equal(calls.filter(c=>c.url==='https://oauth2.googleapis.com/token').length,1);});

function maxProvider() {
  const calls=[],state={permissions:['write'],isAdmin:true,status:'active',ready:true,failSend:false};
  return {calls,state,fetch:async(url,options={})=>{
    const u=new URL(url);calls.push({url,options});
    if(u.hostname==='platform-api2.max.ru') {
      assert.equal(options.headers.Authorization,'max-private-token');assert.equal(u.searchParams.has('access_token'),false);
      if(u.pathname==='/me') return response({user_id:45,is_bot:true,first_name:'Brand bot'});
      if(u.pathname==='/chats/-12345') return response({chat_id:-12345,type:'channel',title:'MAX Brand',status:state.status});
      if(u.pathname==='/chats/-12345/members/me') return response({user_id:45,is_bot:true,is_admin:state.isAdmin,permissions:state.permissions});
      if(u.pathname==='/uploads') return response(u.searchParams.get('type')==='image'?{url:'https://iu.oneme.ru/uploadImage?apiToken=upload-secret'}:{url:'https://omub.okcdn.ru/upload.do?sig=upload-secret',token:'video-attachment-token'});
      if(u.pathname==='/messages') {
        assert.equal(u.searchParams.get('chat_id'),'-12345');
        if(state.failSend) throw Error('timeout max-private-token');
        if(!state.ready){state.ready=true;return response({code:'attachment.not.ready',message:'Attachment not processed'},400);}
        return response({message:{body:{mid:'mid.987'},url:'https://max.ru/channel/post/987'}});
      }
    }
    if(u.hostname==='iu.oneme.ru') return response({photos:{'photo-123':{token:'photo-attachment-token'}}});
    if(u.hostname==='omub.okcdn.ru') return new Response('<retval>1</retval>',{status:200});
    throw Error(`Unexpected MAX request ${u.hostname}${u.pathname}`);
  }};
}

test('MAX verifies bot, active chat and write rights without publishing; encrypted connection survives restart',async t=>{
  const provider=maxProvider(),s=await setup(t,provider);
  assert.equal((await s.connect('max',{token:'max-private-token',account:'@channel'})).status,400);
  provider.state.permissions=['read_all_messages'];
  assert.equal((await s.connect('max',{token:'max-private-token',account:'-12345'})).value.code,'MISSING_PERMISSION');
  provider.state.permissions=['write'];provider.state.isAdmin=false;
  assert.equal((await s.connect('max',{token:'max-private-token',account:'-12345'})).status,422);
  provider.state.isAdmin=true;provider.state.status='left';
  assert.equal((await s.connect('max',{token:'max-private-token',account:'-12345'})).status,422);
  provider.state.status='active';const connected=await s.connect('max',{token:'max-private-token',account:'-12345'});
  assert.equal(connected.status,200);assert.equal(connected.value.connection.accountName,'MAX Brand');
  assert.ok(provider.calls.every(c=>c.options.method==='GET'));
  assert.ok(!readFileSync(join(s.directory,'social-connections.json'),'utf8').includes('max-private-token'));
  const restarted=await setup(t,provider,s.directory);
  assert.equal((await restarted.api('/connections','GET',undefined,s.owner)).value.connections[0].platform,'max');
});

test('MAX publishes actual photo/video attachments, retries only attachment.not.ready and blocks ambiguous duplicates',async t=>{
  const provider=maxProvider(),s=await setup(t,provider);await s.connect('max',{token:'max-private-token',account:'-12345'});
  provider.state.ready=false;
  const image=await s.send({platform:'max',media:{kind:'image',url:png}});
  assert.equal(image.status,200);assert.equal(image.value.publication.url,'https://max.ru/channel/post/987');
  const binary=provider.calls.find(c=>c.url.startsWith('https://iu.oneme.ru/'));
  assert.equal(binary.options.body.get('data').size,68);
  assert.equal(JSON.parse(provider.calls.filter(c=>new URL(c.url).pathname==='/messages').at(-1).options.body).attachments[0].payload.token,'photo-attachment-token');
  assert.equal((await s.send({platform:'max',postId:'video-max',requestId:'video-max-req',media:{kind:'video',url:video}})).status,200);
  assert.equal(JSON.parse(provider.calls.at(-1).options.body).attachments[0].payload.token,'video-attachment-token');
  assert.equal((await s.send({platform:'max',postId:'webp-max',requestId:'webp-max-req',media:{kind:'image',url:'data:image/webp;base64,AAAA'}})).value.code,'UNSUPPORTED_MEDIA');
  assert.equal((await s.send({platform:'max',postId:'long-max',requestId:'long-max-req',body:'a'.repeat(4001)})).value.code,'TEXT_LIMIT');
  provider.state.failSend=true;assert.equal((await s.send({platform:'max',postId:'unknown-max',requestId:'unknown-max-req'})).value.code,'PUBLISH_UNKNOWN');
  const before=provider.calls.length;assert.equal((await s.send({platform:'max',postId:'unknown-max',requestId:'unknown-max-req'})).status,409);assert.equal(provider.calls.length,before);
});

const ttData=data=>response({data,error:{code:'ok',message:''}});
function tiktokProvider() {
  const calls=[],state={privacy:['SELF_ONLY','PUBLIC_TO_EVERYONE'],disabled:true,creatorUnavailable:false,upstreamStatus:'PROCESSING_UPLOAD',publicId:undefined,failReason:'file_format_check_failed',uploadTimeout:false,badUploadHost:false,initTimeout:false,openId:'tt-open-id'};
  return {state,calls,fetch:async(url,options={})=>{
    const u=new URL(url);calls.push({url,options});
    if(u.pathname==='/v2/oauth/token/') return response({access_token:'tt-rotated-secret',refresh_token:'tt-rotated-refresh',open_id:state.openId,expires_in:86400});
    if(u.pathname==='/v2/user/info/') return ttData({user:{open_id:state.openId,display_name:'Brand'}});
    if(u.pathname==='/v2/post/publish/creator_info/query/') return state.creatorUnavailable?response({error:{code:'spam_risk_too_many_posts',message:'Try later'}}):ttData({creator_username:'brand',creator_nickname:'Brand TikTok',privacy_level_options:state.privacy,comment_disabled:false,duet_disabled:state.disabled,stitch_disabled:state.disabled,max_video_post_duration_sec:60});
    if(u.pathname==='/v2/post/publish/video/init/') {if(state.initTimeout)throw Error('timeout');return ttData({publish_id:'v_pub_file~123',upload_url:state.badUploadHost?'https://evil.example/video':'https://open-upload.tiktokapis.com/video?upload_token=private-upload-token'});}
    if(u.hostname==='open-upload.tiktokapis.com'){if(state.uploadTimeout)throw Error('timeout');return new Response(null,{status:201});}
    if(u.pathname==='/v2/post/publish/status/fetch/') return ttData({status:state.upstreamStatus,publicaly_available_post_id:state.publicId?[state.publicId]:[],fail_reason:state.failReason});
    throw Error(`Unexpected TikTok request ${u.pathname}`);
  }};
}
const ttPost={platform:'tiktok',media:{kind:'video',url:video},tiktok:{privacyLevel:'SELF_ONLY',allowComment:false,allowDuet:false,allowStitch:false,commercialContent:false,brandOrganic:false,brandedContent:false,isAigc:false,consent:true,durationSec:15}};

test('TikTok validates identity and publishing scope, retrieves live creator settings and keeps rotated credentials private',async t=>{
  const provider=tiktokProvider(),s=await setup(t,provider);
  const connected=await s.connect('tiktok',{clientId:'tt-client',clientSecret:'tt-secret',refreshToken:'tt-refresh'});
  assert.equal(connected.status,200);assert.equal(connected.value.connection.accountId,'tt-open-id');assert.equal(connected.value.connection.capabilities.image,false);
  assert.ok(!JSON.stringify(connected).includes('secret'));
  assert.equal(provider.calls.filter(c=>c.url.endsWith('/oauth/token/')).length,1);
  const creator=await s.api('/connections/tiktok/creator-info','POST',{},s.owner);
  assert.deepEqual(creator.value.creator.privacyLevels,['SELF_ONLY','PUBLIC_TO_EVERYONE']);assert.equal(creator.value.creator.duetDisabled,true);
  provider.state.creatorUnavailable=true;
  assert.equal((await s.api('/connections/tiktok/creator-info','POST',{},s.owner)).value.code,'PROVIDER_REJECTED');
  assert.equal(provider.calls.filter(c=>c.url.includes('/video/init/')).length,0);
  const restarted=await setup(t,provider,s.directory);provider.state.creatorUnavailable=false;
  assert.equal((await restarted.api('/connections/tiktok/creator-info','POST',{},s.owner)).status,200);
  assert.equal(provider.calls.at(-1).options.headers.Authorization,'Bearer tt-rotated-secret');
});

test('TikTok requires explicit consent, manual valid privacy, duration and consistent interaction/disclosure options',async t=>{
  const provider=tiktokProvider(),s=await setup(t,provider);await s.connect('tiktok',{token:'tt-secret'});
  for(const [patch,code] of [[{consent:false},'CONSENT_REQUIRED'],[{privacyLevel:''},'PRIVACY_REQUIRED'],[{privacyLevel:'MUTUAL_FOLLOW_FRIENDS'},'PRIVACY_REQUIRED'],[{durationSec:61},'VIDEO_DURATION'],[{allowDuet:true},'INTERACTION_DISABLED'],[{commercialContent:true},'DISCLOSURE_REQUIRED'],[{commercialContent:true,brandedContent:true},'DISCLOSURE_PRIVACY']]) {
    assert.equal((await s.send({...ttPost,tiktok:{...ttPost.tiktok,...patch}})).value.code,code);
  }
  assert.equal((await s.send({...ttPost,media:{kind:'image',url:png}})).value.code,'UNSUPPORTED_MEDIA');
  assert.equal(provider.calls.filter(c=>c.url.includes('/video/init/')).length,0);
});

test('TikTok uploads binary with consent metadata, reports processing truthfully and confirms publication through polling',async t=>{
  const provider=tiktokProvider(),s=await setup(t,provider);await s.connect('tiktok',{token:'tt-secret'});
  const sent=await s.send({...ttPost,body:'Final edited caption',tiktok:{...ttPost.tiktok,privacyLevel:'PUBLIC_TO_EVERYONE',allowComment:true,commercialContent:true,brandOrganic:true,isAigc:true}});
  assert.equal(sent.status,202);assert.equal(sent.value.publication.status,'processing');assert.equal(sent.value.publication.id,undefined);assert.equal(sent.value.publication.publishedAt,undefined);
  const init=JSON.parse(provider.calls.find(c=>c.url.includes('/video/init/')).options.body);
  assert.equal(init.post_info.title,'Final edited caption');assert.equal(init.post_info.brand_organic_toggle,true);assert.equal(init.post_info.is_aigc,true);assert.equal(init.post_info.disable_comment,false);assert.equal(init.source_info.total_chunk_count,1);
  const uploaded=provider.calls.find(c=>new URL(c.url).hostname==='open-upload.tiktokapis.com');
  assert.equal(uploaded.options.method,'PUT');assert.equal(uploaded.options.headers['Content-Range'],'bytes 0-11/12');assert.equal(uploaded.options.headers.Authorization,undefined);assert.ok(Buffer.isBuffer(uploaded.options.body));
  const check=()=>s.api('/publications/tiktok/post_1/check','POST',{},s.owner);
  assert.equal((await check()).value.publication.status,'processing');
  assert.equal((await s.send({...ttPost,body:'Changed later'})).value.reused,true);
  provider.state.upstreamStatus='PUBLISH_COMPLETE';provider.state.publicId='71234567890';
  const complete=await check();assert.equal(complete.value.publication.status,'published');assert.equal(complete.value.publication.url,'https://www.tiktok.com/@brand/video/71234567890');assert.equal(complete.value.publication.snapshot.body,'Final edited caption');
  assert.equal(provider.calls.filter(c=>c.url.includes('/video/init/')).length,1);
});

test('TikTok interrupted upload survives restart as processing and can confirm a private post without a fabricated URL',async t=>{
  const provider=tiktokProvider(),s=await setup(t,provider);await s.connect('tiktok',{token:'tt-secret'});provider.state.uploadTimeout=true;
  const sent=await s.send(ttPost);assert.equal(sent.status,202);assert.equal(sent.value.publication.status,'processing');assert.ok(sent.value.publication.error);
  const restarted=await setup(t,provider,s.directory);
  assert.equal((await restarted.api('/publications?postId=post_1','GET',undefined,s.owner)).value.publications[0].status,'processing');
  provider.state.upstreamStatus='PUBLISH_COMPLETE';
  const check=await restarted.api('/publications/tiktok/post_1/check','POST',{},s.owner);
  assert.equal(check.value.publication.status,'published');assert.equal(check.value.publication.url,undefined);assert.equal(check.value.publication.id,'tiktok:v_pub_file~123');
  assert.equal(provider.calls.filter(c=>c.url.includes('/video/init/')).length,1);
});

test('TikTok refuses untrusted upload hosts, preserves failed provider status and prevents unknown init retries',async t=>{
  const provider=tiktokProvider(),s=await setup(t,provider);await s.connect('tiktok',{token:'tt-secret'});provider.state.badUploadHost=true;
  assert.equal((await s.send(ttPost)).value.publication.status,'processing');assert.ok(provider.calls.every(c=>new URL(c.url).hostname!=='evil.example'));
  provider.state.upstreamStatus='FAILED';
  const failed=await s.api('/publications/tiktok/post_1/check','POST',{},s.owner);assert.equal(failed.value.publication.status,'failed');assert.equal(failed.value.publication.publishedAt,undefined);
  provider.state.initTimeout=true;
  assert.equal((await s.send({...ttPost,postId:'unknown-init',requestId:'unknown-init-request'})).value.code,'PUBLISH_UNKNOWN');
  const count=provider.calls.length;assert.equal((await s.send({...ttPost,postId:'unknown-init',requestId:'unknown-init-request'})).status,409);assert.equal(provider.calls.length,count);
});
