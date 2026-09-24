import {createServer} from 'node:http';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createApprovalHandler} from './approvals.mjs';
import {createCreativeHandler} from './creative-service.mjs';
const creative=createCreativeHandler();
import {labrikaRoutes} from './routing.mjs';
const root=resolve('dist');
if(!existsSync(root)){console.error('Run npm run build first.');process.exit(1);}
const approval=createApprovalHandler({issuerKey:process.env.APPROVAL_ISSUER_KEY});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'};
const server=createServer((req,res)=>creative(req,res,()=>approval(req,res,()=>labrikaRoutes(req,res,()=>{
 try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)||!statSync(path).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(readFileSync(path));}catch{res.writeHead(404);res.end();}
}))));
server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log(`Local server: http://localhost:${server.address().port}`));
