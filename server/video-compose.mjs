import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffmpegStatic from 'ffmpeg-static';
const exec=promisify(execFile);
const binary=()=>process.env.FFMPEG_PATH||ffmpegStatic;
export const encoderAvailable=()=>!!binary()&&existsSync(binary());
const ffmpeg=(args,signal)=>exec(binary(),['-hide_banner','-nostdin','-y',...args],{signal,timeout:300000,maxBuffer:4*1024*1024});
async function inspect(path,signal){try{await ffmpeg(['-i',path],signal);throw new Error('Unreadable video');}catch(error){if(signal?.aborted)throw error;const log=error.stderr||'';const match=log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);if(!match||!log.includes('Video:'))throw new Error('Не удалось прочитать видеосцену');return {duration:Number(match[1])*3600+Number(match[2])*60+Number(match[3]),audio:log.includes('Audio:')};}}
/** Encodes actual provider clips into one MP4. No stock/video substitute is generated. */
export async function composeVideo({brief,scenes},signal){
 if(!encoderAvailable())throw new Error('Сборка видео пока недоступна');
 const folder=await mkdtemp(join(tmpdir(),'labrica-video-'));
 try{
  const dimensions=brief.aspect==='9:16'?[720,1280]:brief.aspect==='16:9'?[1280,720]:[720,720];
  const normalized=[];
  for(let i=0;i<scenes.length;i++){
   signal?.throwIfAborted();const scene=scenes[i],data=scene.clip?.match(/^data:video\/(?:mp4|webm);base64,([A-Za-z0-9+/]+=*)$/);if(!data)throw new Error('Для монтажа нужны готовые сцены');
   const source=join(folder,`${i}.input`),target=join(folder,`${i}.mp4`);await writeFile(source,Buffer.from(data[1],'base64'),{mode:0o600});const info=await inspect(source,signal);
   if(info.duration<scene.duration-.3)throw new Error('Сервис вернул слишком короткую сцену');
   const fade=Math.min(.15,scene.duration/10);
   await ffmpeg(['-i',source,...(!info.audio?['-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000']:[]),'-map','0:v:0','-map',info.audio?'0:a:0':'1:a:0','-vf',`scale=${dimensions[0]}:${dimensions[1]}:force_original_aspect_ratio=increase,crop=${dimensions[0]}:${dimensions[1]},setsar=1,fps=30,fade=t=in:st=0:d=${fade},fade=t=out:st=${scene.duration-fade}:d=${fade}`,'-af',`apad,afade=t=in:st=0:d=${fade},afade=t=out:st=${scene.duration-fade}:d=${fade}`,'-t',String(scene.duration),'-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',target],signal);
   normalized.push(target);
  }
  const manifest=join(folder,'clips.txt');await writeFile(manifest,normalized.map(path=>`file '${path}'`).join('\n'),{mode:0o600});const output=join(folder,'complete.mp4');
  await ffmpeg(['-f','concat','-safe','0','-i',manifest,'-c','copy','-movflags','+faststart',output],signal);
  const info=await inspect(output,signal);if(Math.abs(info.duration-brief.duration)>.25)throw new Error('Не удалось согласовать длительность ролика');
  const bytes=await readFile(output);if(bytes.length>70*1024*1024)throw new Error('Готовое видео превышает допустимый размер');
  return {video:`data:video/mp4;base64,${bytes.toString('base64')}`,duration:info.duration};
 }catch(error){if(signal?.aborted)throw error;if(error.message?.startsWith('Command failed'))throw new Error('Не удалось собрать видеосцены. Проверьте исходные материалы.');throw error;}
 finally{await rm(folder,{recursive:true,force:true});}
}
