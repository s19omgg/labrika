import 'dotenv/config';
import {ProxyAgent, fetch} from 'undici';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import {resolve} from 'node:path';

const token=String(process.env.TELEGRAM_BOT_TOKEN||'').trim();
const proxyURL=String(process.env.TELEGRAM_PROXY_URL||'').trim();
const webhookSecret=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').trim();

if(!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');
if(!proxyURL) throw new Error('TELEGRAM_PROXY_URL is missing');
if(!webhookSecret) throw new Error('TELEGRAM_WEBHOOK_SECRET is missing');

const dispatcher=new ProxyAgent(proxyURL);

const dataDirectory=resolve('.data');
const offsetFile=resolve(dataDirectory,'telegram-poller-offset');

mkdirSync(dataDirectory,{recursive:true});

let offset=0;

if(existsSync(offsetFile)){
  const saved=Number(readFileSync(offsetFile,'utf8').trim());
  if(Number.isSafeInteger(saved)&&saved>=0) offset=saved;
}

let stopped=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function saveOffset(value){
  offset=value;
  writeFileSync(offsetFile,String(value),{mode:0o600});
}

async function telegramGetUpdates(){
  const body=new URLSearchParams({
    timeout:'50',
    allowed_updates:JSON.stringify(['message'])
  });

  if(offset>0) body.set('offset',String(offset));

  const response=await fetch(
    `https://api.telegram.org/bot${token}/getUpdates`,
    {
      method:'POST',
      body,
      dispatcher,
      signal:AbortSignal.timeout(65000)
    }
  );

  const result=await response.json();

  if(!response.ok||result.ok!==true){
    throw new Error(
      `Telegram getUpdates failed: ${result.description||response.status}`
    );
  }

  return Array.isArray(result.result)?result.result:[];
}

async function forwardUpdate(update){
  const response=await fetch(
    'http://127.0.0.1:3001/api/social/telegram/webhook',
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Telegram-Bot-Api-Secret-Token':webhookSecret
      },
      body:JSON.stringify(update),
      signal:AbortSignal.timeout(30000)
    }
  );

  if(!response.ok){
    const body=await response.text().catch(()=>'');
    throw new Error(
      `LABRICA rejected Telegram update (${response.status}): ${body.slice(0,300)}`
    );
  }
}

async function run(){
  console.log('Telegram poller started');

  while(!stopped){
    try{
      const updates=await telegramGetUpdates();

      for(const update of updates){
        if(!Number.isSafeInteger(update?.update_id)) continue;

        await forwardUpdate(update);
        saveOffset(update.update_id+1);
      }
    }catch(error){
      if(stopped) break;

      console.error(
        'Telegram poller error:',
        error instanceof Error?error.message:String(error)
      );

      await sleep(3000);
    }
  }
}

async function shutdown(){
  if(stopped) return;
  stopped=true;

  console.log('Stopping Telegram poller...');

  try{
    await dispatcher.close();
  }catch{}

  process.exit(0);
}

process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

await run();
