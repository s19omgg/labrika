export function initLandingMotion(){
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const rows=[...document.querySelectorAll<HTMLElement>('.feature-row')];
 const current=rows.map(()=>0);
 let frame=0,previous=0;
 const tick=(now:number)=>{
  frame=0;
  if(media.matches){rows.forEach(row=>row.style.removeProperty('transform'));return;}
  const delta=previous?Math.min((now-previous)/1000,.05):1/60;previous=now;
  const blend=1-Math.exp(-10*delta);let unsettled=false;
  rows.forEach((row,i)=>{
   const rect=row.getBoundingClientRect();
   const clamp=(x:number)=>Math.max(0,Math.min(1,x));
   const enter=clamp((innerHeight*.94-rect.top)/(innerHeight*.44));
   const exit=clamp((innerHeight*.24-rect.bottom)/(innerHeight*.6));
   const travel=innerWidth<720?38:Math.min(230,innerWidth*.16);
   const target=(i===0?1:-1)*((1-enter)-exit)*travel;
   current[i]+=(target-current[i])*blend;
   row.style.transform=`translate3d(${current[i].toFixed(2)}px,0,0)`;
   unsettled ||= Math.abs(target-current[i])>.15;
  });
  if(unsettled)frame=requestAnimationFrame(tick);
 };
 const request=()=>{if(!frame){previous=0;frame=requestAnimationFrame(tick);}};
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);media.addEventListener('change',request);request();

 const observed=new WeakSet<Element>();
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  entry.target.classList.toggle('in-view',entry.isIntersecting);
  if(entry.isIntersecting)entry.target.classList.add('has-entered');
 }),{threshold:.16});
 const register=()=>document.querySelectorAll('.hero-character,.feature-card,#cta-peek-root,.pricing-card,.ai-section').forEach(element=>{if(!observed.has(element)){observed.add(element);observer.observe(element);}});
 register();
 const mounts=new MutationObserver(register);mounts.observe(document.querySelector('main')!,{childList:true,subtree:true});
 addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();mounts.disconnect();removeEventListener('scroll',request);removeEventListener('resize',request);media.removeEventListener('change',request);},{once:true});
}
