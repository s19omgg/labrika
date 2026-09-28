import 'dotenv/config';
import {createAccountStore} from './account-store.mjs';
import {createAuthHandler} from './auth-service.mjs';
import {createAdminAuthHandler} from './admin-auth.mjs';
const accountStore=createAccountStore();
const auth=createAuthHandler({accountStore});
const adminAuth=createAdminAuthHandler({accountStore});
import {createServer} from 'node:http';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createSocialHandler} from './social-service.mjs';
const social=createSocialHandler();
import {createApprovalHandler} from './approvals.mjs';
import {createProviderService} from './provider-service.mjs';
const providers=createProviderService();
import {createCreativeHandler} from './creative-service.mjs';
const creative=createCreativeHandler({resolveAdapter:req=>providers.creativeAdapter(String(req.headers['x-product-edition']||'labrika')),resolveCapabilities:req=>providers.capabilities(String(req.headers['x-product-edition']||'labrika'))});
import {editionRoutes} from './routing.mjs';
const root=resolve('dist');
if(!existsSync(root)){console.error('Run npm run build first.');process.exit(1);}
const approval=createApprovalHandler({issuerKey:process.env.APPROVAL_ISSUER_KEY});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.glb':'model/gltf-binary','.json':'application/json; charset=utf-8','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const server=createServer((req,res)=>adminAuth(req,res,()=>auth(req,res,()=>providers.handler(req,res,()=>social(req,res,()=>creative(req,res,()=>approval(req,res,()=>editionRoutes(req,res,()=>{
 try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)||!statSync(path).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(readFileSync(path));}catch{res.writeHead(404);res.end();}
}))))))));
server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log(`Local server: http://localhost:${server.address().port}`));
