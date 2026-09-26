export function editionRoutes(req,res,next){
 const pathname=(req.url||'/').split('?')[0];
 const routes={'/':'/index.html','/labrika':'/labrika/index.html','/labrika/':'/labrika/index.html','/labrika/admin':'/labrika/admin/index.html','/labrika/admin/':'/labrika/admin/index.html'};
 if(routes[pathname])req.url=routes[pathname]+(req.url.includes('?')?'?'+req.url.split('?').slice(1).join('?'):'');
 next();
}
