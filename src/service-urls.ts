export type LabricaService='landing'|'app'|'auth'|'admin'|'legal';

const productionHosts:Record<LabricaService,string>={
  landing:'labrica.pro',
  app:'app.labrica.pro',
  auth:'auth.labrica.pro',
  admin:'admin.labrica.pro',
  legal:'legal.labrica.pro',
};

export function serviceUrl(service:LabricaService,path='/'){
  const normalized=path.startsWith('/')?path:`/${path}`;
  if(typeof location==='undefined')return `https://${productionHosts[service]}${normalized}`;
  const host=location.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')){
    const prefix=service==='landing'?'':`${service}.`;
    return `${location.protocol}//${prefix}localhost${location.port?`:${location.port}`:''}${normalized}`;
  }
  if(host==='127.0.0.1'||host==='::1'){
    const localPath=service==='landing'?normalized:`/${service}${normalized==='/'?'':normalized}`;
    return `${location.origin}${localPath}`;
  }
  return `https://${productionHosts[service]}${normalized}`;
}

export const legalUrl=(path='/')=>serviceUrl('legal',path);

export function hydrateServiceLinks(root:ParentNode=document){
  root.querySelectorAll<HTMLAnchorElement>('[data-labrica-service]').forEach(link=>{
    const service=link.dataset.labricaService as LabricaService|undefined;
    if(service)link.href=serviceUrl(service,link.dataset.labricaPath||'/');
  });
}
