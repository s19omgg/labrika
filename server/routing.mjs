const serviceHosts={app:'app.labrica.pro',auth:'auth.labrica.pro',admin:'admin.labrica.pro',legal:'legal.labrica.pro'};
const entryFiles={app:'/app/index.html',auth:'/auth/index.html',admin:'/admin/index.html',legal:'/legal/index.html'};

function hostname(req){return String(req.headers.host||'').split(':')[0].toLowerCase();}
function serviceFromHost(host){
 for(const service of Object.keys(serviceHosts))if(host===serviceHosts[service]||host===`${service}.localhost`)return service;
 return null;
}
function isPageRequest(pathname){return !pathname.startsWith('/@')&&!pathname.startsWith('/api/')&&!pathname.startsWith('/assets/')&&!pathname.startsWith('/fonts/')&&!pathname.startsWith('/brand/')&&!pathname.startsWith('/landing-assets/')&&!pathname.startsWith('/legal-documents/')&&!/\.[a-z0-9]{2,8}$/i.test(pathname);}
function withQuery(req,path){const query=(req.url||'').includes('?')?'?'+(req.url||'').split('?').slice(1).join('?'):'';req.url=path+query;}
function redirect(res,location){res.writeHead(308,{Location:location,'Cache-Control':'no-store'});res.end();}

export function editionRoutes(req,res,next){
 const pathname=(req.url||'/').split('?')[0],host=hostname(req);
 if(pathname==='/labrika/admin'||pathname.startsWith('/labrika/admin/')){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Адрес удалён. Панель управления доступна на admin.labrica.pro.');return;}

 const service=serviceFromHost(host);
 if(service&&isPageRequest(pathname)){withQuery(req,entryFiles[service]);return next();}

 const localHost=host==='localhost'||host==='127.0.0.1'||host==='::1'||host==='';
 if(localHost){
  if(pathname==='/labrika'||pathname==='/labrika/')return redirect(res,'/app');
  if(isPageRequest(pathname)&&(pathname==='/app'||pathname.startsWith('/app/')))withQuery(req,entryFiles.app);
  else if(isPageRequest(pathname)&&(pathname==='/auth'||pathname.startsWith('/auth/')))withQuery(req,entryFiles.auth);
  else if(isPageRequest(pathname)&&(pathname==='/admin'||pathname.startsWith('/admin/')))withQuery(req,entryFiles.admin);
  else if(isPageRequest(pathname)&&(pathname==='/legal'||pathname.startsWith('/legal/')))withQuery(req,entryFiles.legal);
  else if(pathname==='/')withQuery(req,'/index.html');
  return next();
 }

 if(host==='labrica.pro'||host==='www.labrica.pro'){
  if(pathname==='/')withQuery(req,'/index.html');
  else if(pathname==='/app'||pathname.startsWith('/app/'))return redirect(res,'https://app.labrica.pro/');
  else if(pathname==='/auth'||pathname.startsWith('/auth/'))return redirect(res,'https://auth.labrica.pro/login');
  else if(pathname==='/admin'||pathname.startsWith('/admin/'))return redirect(res,'https://admin.labrica.pro/');
  else if(pathname==='/legal'||pathname.startsWith('/legal/'))return redirect(res,`https://legal.labrica.pro${pathname.slice('/legal'.length)||'/'}`);
 }
 next();
}
