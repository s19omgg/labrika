export function editionRoutes(req,res,next){
 const pathname=(req.url||'/').split('?')[0];
 if(pathname==='/admin'||pathname.startsWith('/admin/')){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Используйте /labrika/admin/.');return;}
 const routes={'/':'/index.html','/labrika':'/labrika/index.html','/labrika/':'/labrika/index.html','/labrika/admin':'/labrika/admin/index.html','/labrika/admin/':'/labrika/admin/index.html'};
 if(routes[pathname])req.url=routes[pathname]+(req.url.includes('?')?'?'+req.url.split('?').slice(1).join('?'):'');
 next();
}
