import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const emptyDatabase=()=>({version:1,checkouts:[],lastWebhookAt:null});

export function createPaymentStore({directory='.data'}={}){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const file=join(directory,'payments.json');
  const read=()=>{
    if(!existsSync(file))return emptyDatabase();
    try{
      const value=JSON.parse(readFileSync(file,'utf8'));
      return value?.version===1&&Array.isArray(value.checkouts)?{...emptyDatabase(),...value}:emptyDatabase();
    }catch{return emptyDatabase();}
  };
  const save=database=>{
    const temporary=`${file}.tmp`;
    writeFileSync(temporary,JSON.stringify(database,null,2),{mode:0o600});
    renameSync(temporary,file);
  };
  return{
    create(checkout){const database=read();database.checkouts.unshift(checkout);database.checkouts=database.checkouts.slice(0,2000);save(database);return checkout;},
    get(id){return read().checkouts.find(item=>item.id===id)||null;},
    update(id,patch){const database=read(),checkout=database.checkouts.find(item=>item.id===id);if(!checkout)return null;Object.assign(checkout,patch);save(database);return checkout;},
    findByOperation(operationId){return read().checkouts.find(item=>item.operationId===operationId)||null;},
    webhookReceived(at){const database=read();database.lastWebhookAt=at;save(database);},
    snapshot(){const database=read();return{checkouts:database.checkouts,lastWebhookAt:database.lastWebhookAt};},
  };
}
