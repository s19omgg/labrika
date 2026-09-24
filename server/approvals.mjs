import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (left, right) => { const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b); };
export function createApprovalHandler({directory='.data', issuerKey, now=()=>Date.now()}={}) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const keyPath=join(directory,'approval-issuer.key');
  if(!issuerKey){if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('hex'),{mode:0o600});issuerKey=readFileSync(keyPath,'utf8').trim();}
  const file=join(directory,'approvals.json');
  const read=()=>{if(!existsSync(file))return [];const value=JSON.parse(readFileSync(file,'utf8'));if(!Array.isArray(value))throw new Error('Invalid approval storage');return value;};
  const write=records=>{writeFileSync(file+'.tmp',JSON.stringify(records),{mode:0o600});renameSync(file+'.tmp',file);};
  const view=record=>({id:record.id,edition:record.edition,brand:record.brand,posts:record.posts,status:record.status,expiresAt:record.expiresAt,comments:record.comments,decidedAt:record.decidedAt});
  async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>262144)throw Object.assign(new Error('Payload too large'),{status:413});}try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
  return async function approvals(req,res,next=()=>{res.statusCode=404;res.end();}) {
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/api/approvals'))return next();
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try {
      const origin=req.headers.origin;
      if(origin&&new URL(origin).host!==req.headers.host)return reply(403,{error:'Origin not allowed'});
      const parts=url.pathname.split('/').filter(Boolean).slice(2);
      const owner=()=>same(String(req.headers['x-approval-key']||''),issuerKey);
      if(!parts.length&&req.method==='POST'){
        if(!owner())return reply(401,{error:'Issuer authentication required'});
        const input=await body(req);
        if(input.edition!=='labrika'||typeof input.workspaceId!=='string'||!input.workspaceId.trim()||!Array.isArray(input.posts)||input.posts.length<1||input.posts.length>30)return reply(400,{error:'Edition, workspace and 1–30 posts required'});
        const posts=input.posts.map(post=>{if(typeof post.id!=='string'||typeof post.title!=='string'||typeof post.body!=='string'||!post.body.trim()||post.body.length>20000)throw Object.assign(new Error('Invalid post'),{status:400});return {id:post.id,title:post.title.slice(0,200),body:post.body,platforms:(Array.isArray(post.platforms)?post.platforms:[]).filter(p=>['vk','telegram','instagram','threads','dzen','youtube'].includes(p))};});
        const token=randomBytes(32).toString('base64url');const id=randomBytes(16).toString('hex');
        const duration=Math.min(30*86400000,Math.max(60000,Number(input.expiresInMs)||7*86400000));
        const record={id,tokenHash:hash(token),edition:input.edition,workspaceId:input.workspaceId.slice(0,200),brand:String(input.brand||'').slice(0,160),posts,status:'pending',createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+duration).toISOString(),comments:[],decidedAt:null};
        const records=read();records.push(record);write(records);
        return reply(201,{id,token,path:`/api/approvals/${token}`,expiresAt:record.expiresAt});
      }
      if(parts[0]==='records'&&parts[1]){
        if(!owner())return reply(401,{error:'Issuer authentication required'});
        const records=read(),record=records.find(r=>r.id===parts[1]);if(!record)return reply(404,{error:'Not found'});
        if(req.method==='DELETE'){record.status='revoked';write(records);return reply(200,{id:record.id,status:'revoked'});}
        if(req.method==='GET')return reply(200,{...view(record),workspaceId:record.workspaceId});
        return reply(405,{error:'Method not allowed'});
      }
      if(parts.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(parts[0]))return reply(404,{error:'Not found'});
      const records=read(),record=records.find(r=>same(r.tokenHash,hash(parts[0])));
      if(!record)return reply(404,{error:'Not found'});
      if(record.status==='revoked'||new Date(record.expiresAt).getTime()<=now())return reply(410,{error:'Link expired or revoked'});
      if(req.method==='GET')return reply(200,view(record));
      if(req.method==='POST'){
        const input=await body(req);if(!['approve','reject','comment'].includes(input.action))return reply(400,{error:'Invalid action'});
        if(record.status!=='pending')return reply(409,{error:'A decision has already been recorded',status:record.status});
        const comment=typeof input.comment==='string'?input.comment.trim():'';
        if(comment.length>4000||input.action==='comment'&&!comment)return reply(400,{error:'Comment must contain 1–4000 characters'});
        if(comment)record.comments.push({id:randomBytes(12).toString('hex'),body:comment,at:new Date(now()).toISOString()});
        if(input.action!=='comment'){record.status=input.action==='approve'?'approved':'rejected';record.decidedAt=new Date(now()).toISOString();}
        write(records);return reply(200,view(record));
      }
      return reply(405,{error:'Method not allowed'});
    }catch(error){return reply(error.status||500,{error:error.status?error.message:'Unable to process approval'});}
  };
}
