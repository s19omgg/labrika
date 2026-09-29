import {freemem,loadavg,totalmem} from 'node:os';
import {performance} from 'node:perf_hooks';
import {statfsSync} from 'node:fs';

const megabytes=value=>Math.round(value/1024/1024);

export function createRuntimeMonitor({now=()=>Date.now()}={}){
 const startedAt=now(),recent=[];
 let requests=0,serverErrors=0,totalDuration=0;
 const prune=()=>{const threshold=now()-5*60*1000;while(recent.length&&recent[0].at<threshold)recent.shift();};
 const middleware=(req,res,next)=>{
  const started=performance.now();
  res.once('finish',()=>{
   const duration=Math.max(0,performance.now()-started),entry={at:now(),status:res.statusCode,duration};
   requests++;totalDuration+=duration;if(res.statusCode>=500)serverErrors++;recent.push(entry);prune();
  });
  next();
 };
 const snapshot=()=>{
  prune();
  const memory=process.memoryUsage(),errors5m=recent.filter(item=>item.status>=500).length;
  let disk={freeMb:null,totalMb:null};
  try{const value=statfsSync(process.cwd()),blockSize=Number(value.bsize);disk={freeMb:megabytes(Number(value.bavail)*blockSize),totalMb:megabytes(Number(value.blocks)*blockSize)};}catch{/* Disk metrics may be unavailable in a restricted container. */}
  return{
   status:'online',
   startedAt:new Date(startedAt).toISOString(),
   uptimeSeconds:Math.max(0,Math.floor((now()-startedAt)/1000)),
   environment:process.env.NODE_ENV||'development',
   nodeVersion:process.version,
   requests:{total:requests,last5m:recent.length,serverErrors,errorRate5m:recent.length?errors5m/recent.length:0,averageResponseMs:requests?Math.round(totalDuration/requests):0},
   processMemory:{rssMb:megabytes(memory.rss),heapUsedMb:megabytes(memory.heapUsed),heapTotalMb:megabytes(memory.heapTotal)},
   host:{freeMemoryMb:megabytes(freemem()),totalMemoryMb:megabytes(totalmem()),loadAverage1m:Number(loadavg()[0].toFixed(2)),disk},
  };
 };
 const health=(req,res,next)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname!=='/api/health')return next();
  if(req.method!=='GET'){res.writeHead(405,{'Cache-Control':'no-store'});res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify({status:'ok',startedAt:new Date(startedAt).toISOString(),uptimeSeconds:Math.max(0,Math.floor((now()-startedAt)/1000))}));
 };
 return{middleware,health,snapshot};
}

export function createAdminOverview({accountStore,auth,providers,social,monitor,billing,now=()=>Date.now()}){
 return()=>{
  const database=accountStore.snapshot(),accounts=database.accounts,onlineThreshold=now()-65000;
  const activeSubscriptions=accounts.filter(account=>account.subscription&&new Date(account.subscription.expiresAt).getTime()>now()).length;
  const socialState=social.adminStatus();
  const accountsById=new Map(accounts.map(account=>[account.id,account]));
  const paymentState=billing?.adminStatus?.()||{provider:'none',configured:false,confirmedPayments:0,confirmedRevenue:0,lastWebhookAt:null};
  return{
   generatedAt:new Date(now()).toISOString(),
   metrics:{
    accounts:accounts.length,
    online:accounts.filter(account=>account.status==='active'&&account.lastSeenAt&&new Date(account.lastSeenAt).getTime()>onlineThreshold).length,
    activeSubscriptions,
    confirmedRevenue:paymentState.confirmedRevenue,
   },
   server:monitor.snapshot(),
   email:auth.adminStatus(),
   ai:providers.status('labrika'),
   social:{
    ...socialState,
    connections:socialState.connections.map(connection=>{
     const account=connection.accountId?accountsById.get(connection.accountId):null;
     return{...connection,account:account?{id:account.id,name:[account.surname,account.name].filter(Boolean).join(' ')||account.name,email:account.email}:null};
    }),
   },
   payments:paymentState,
  };
 };
}
