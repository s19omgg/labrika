// Convert the supplied motion reference into a transparent, one-shot image animation.
// No generated pixels or character redesign: only connected black backdrop removal.
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ffmpeg from 'ffmpeg-static';

const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/prepare-landing-mascot.mjs /absolute/path/to/reference.MOV');
const directory=fileURLToPath(new URL('../public/landing-assets/',import.meta.url));
const width=480,height=644,fps=24,frameBytes=width*height*4;
const decoder=spawn(ffmpeg,['-v','error','-i',source,'-an','-vf',`scale=${width}:${height},fps=${fps}`,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{stdio:['ignore','pipe','inherit']});
const decoded=once(decoder,'close');
const temporary=mkdtempSync(join(tmpdir(),'labrica-mascot-frames-'));
const frames=[];
const header=Buffer.from(`P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`);
let pending=Buffer.alloc(0),frameIndex=0;
for await(const chunk of decoder.stdout){
 pending=Buffer.concat([pending,chunk]);
 while(pending.length>=frameBytes){
  const frame=Buffer.from(pending.subarray(0,frameBytes));pending=pending.subarray(frameBytes);
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let start=0,end=0;
  const add=index=>{if(index<0||index>=seen.length||seen[index])return;seen[index]=1;const offset=index*4;if(Math.max(frame[offset],frame[offset+1],frame[offset+2])>40)return;queue[end++]=index;};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  while(start<end){const index=queue[start++];frame[index*4+3]=0;if(index%width)add(index-1);if(index%width<width-1)add(index+1);add(index-width);add(index+width);}
  // Start completely outside the card, including the reference's first-frame edge sliver.
  if(frameIndex===0)for(let p=3;p<frame.length;p+=4)frame[p]=0;
  if(frameIndex===fps*6)execFileSync(ffmpeg,['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-i','pipe:0','-frames:v','1','-c:v','libwebp','-quality','90',`${directory}mascot-poster.webp`],{input:frame});
  const path=join(temporary,`${String(frameIndex).padStart(3,'0')}.pam`);
  writeFileSync(path,Buffer.concat([header,frame]));frames.push(path);
  frameIndex++;
 }
}
const [decoderCode]=await decoded;
if(decoderCode)throw new Error(`Decoding failed (${decoderCode})`);
// Independent keyframes prevent transparent moving edges retaining the previous frame.
execFileSync('img2webp',['-kmax','1','-loop','1','-lossy','-q','82','-d',String(Math.round(1000/fps)),...frames,'-o',`${directory}mascot-entrance.webp`],{stdio:'inherit'});
console.log(`Prepared ${frameIndex} transparent frames at ${fps} fps.`);
