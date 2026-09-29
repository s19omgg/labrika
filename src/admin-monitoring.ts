import {useEffect,useState} from 'react';

export interface AdminOverview {
 generatedAt:string;
 metrics:{accounts:number;online:number;activeSubscriptions:number;confirmedRevenue:number};
 server:{status:'online';startedAt:string;uptimeSeconds:number;environment:string;nodeVersion:string;requests:{total:number;last5m:number;serverErrors:number;errorRate5m:number;averageResponseMs:number};processMemory:{rssMb:number;heapUsedMb:number;heapTotalMb:number};host:{freeMemoryMb:number;totalMemoryMb:number;loadAverage1m:number;disk:{freeMb:number|null;totalMb:number|null}}};
 email:{smtp:{configured:boolean;host:string|null;port:number|null;secure:boolean;from:string|null;source:'environment'|'encrypted_file'|'none';lastCheckAt:string|null;status:'not_checked'|'connected'|'error'};verificationEmails:{sent:number;failed:number;lastSuccessAt:string|null;lastFailureAt:string|null;lastError:string|null}};
 ai:{openai:{configured:boolean;status:string;checkedAt:string|null;textModel:string;imageModel:string};higgsfield:{configured:boolean;status:string;checkedAt:string|null;videoModel:string};capabilities:{text:boolean;image:boolean;video:boolean};encoder:boolean};
 social:{workspaceCount:number;connectionCount:number;connectedCount:number;errorCount:number;byPlatform:Record<string,number>;connections:Array<{workspaceId:string;accountId:string|null;platform:string;accountName:string;accountHandle?:string;connectedAt:string;checkedAt:string;status:string;error?:string;account:{id:string;name:string;email:string}|null}>;publications:{total:number;published:number;failed:number}};
 payments:{provider:'none'|'tochka';configured:boolean;receipts?:boolean;confirmedPayments:number;confirmedRevenue:number;lastWebhookAt:string|null;lastError?:string|null;lastRequestAt?:string|null;lastSuccessAt?:string|null};
}

export function useAdminOverview(){
 const [data,setData]=useState<AdminOverview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setInterval>;
  const load=async()=>{
   try{
    const response=await fetch('/api/admin/overview',{credentials:'same-origin',headers:{Accept:'application/json'}}),value=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(value.error||'Не удалось получить состояние сервера');
    if(active){setData(value);setError('');}
   }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Не удалось получить состояние сервера');}
   finally{if(active)setLoading(false);}
  };
  void load();timer=setInterval(load,15000);
  return()=>{active=false;clearInterval(timer);};
 },[]);
 return{data,error,loading};
}
