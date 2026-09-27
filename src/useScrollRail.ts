import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Keeps the navigation attached to the scrolling heading, with the footer anchored. */
export function useScrollRail(rootRef: RefObject<HTMLDivElement | null>, sectionKey: string, expanded: boolean, mobileOpen: boolean, active: boolean) {
  const expansion = useRef<{open:boolean;width:number;from:number;animation:Animation|null;others:Animation[]} | null>(null);
  useLayoutEffect(() => {
    const root=rootRef.current,rail=root?.querySelector<HTMLElement>('.sidebar'),surface=rail?.querySelector<HTMLElement>('.rail-surface'),main=root?.querySelector<HTMLElement>('.main-content');
    if(!root||!rail||!surface||!main||!active)return;
    const open=window.matchMedia('(max-width:760px)').matches?mobileOpen:expanded;
    const width=rail.offsetWidth,previous=expansion.current;
    if(!previous){expansion.current={open,width,from:width,animation:null,others:[]};return;}
    if(previous.open===open){previous.width=width;return;}
    const progress=previous.animation?.effect?.getComputedTiming().progress??1;
    const visualWidth=previous.from+(previous.width-previous.from)*Number(progress);
    previous.animation?.cancel();previous.others.forEach(animation=>animation.cancel());
    const state={open,width,from:visualWidth,animation:null as Animation|null,others:[] as Animation[]};expansion.current=state;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const options:KeyframeAnimationOptions={duration:240,easing:'cubic-bezier(0.32, 0.72, 0, 1)'};
    state.animation=surface.animate([{transform:`scaleX(${visualWidth/width})`},{transform:'scaleX(1)'}],options);
    // Reflow once, then move the content with a compositor transform instead of animating layout.
    const shift=previous.width-width;
    if(!window.matchMedia('(max-width:760px)').matches){
      state.others.push(main.animate([{transform:`translate3d(${shift}px,0,0)`},{transform:'translate3d(0,0,0)'}],options));
      const heading=main.querySelector<HTMLElement>('.page-heading');
      if(heading)state.others.push(heading.animate([{transform:`translate3d(${-shift}px,0,0)`},{transform:'translate3d(0,0,0)'}],options));
    }
    if(open)rail.querySelectorAll<HTMLElement>('.rail-label').forEach(label=>state.others.push(label.animate([{opacity:0,transform:'translateX(-7px)'},{opacity:1,transform:'translateX(0)'}],options)));
  },[rootRef,expanded,mobileOpen,active]);
  useLayoutEffect(() => () => {expansion.current?.animation?.cancel();expansion.current?.others.forEach(animation=>animation.cancel());},[]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;
    const shell = root.querySelector<HTMLElement>('.main-shell');
    const rail = root.querySelector<HTMLElement>('.sidebar');
    const navigation = rail?.querySelector<HTMLElement>('.rail-navigation');
    const footer = rail?.querySelector<HTMLElement>('.rail-bottom');
    const surface = rail?.querySelector<HTMLElement>('.rail-surface');
    const heading = shell?.querySelector<HTMLElement>('.page-heading');
    const title = heading?.querySelector<HTMLElement>('.page-title, h1, h2') || heading;
    if (!shell || !rail || !navigation || !footer || !surface) return;

    const layoutTop = (element: HTMLElement) => {
      let top = 0;
      for (let current: HTMLElement | null = element; current; current = current.offsetParent as HTMLElement | null) top += current.offsetTop;
      return top;
    };
    let frame = 0;
    let headingEnd = 0;
    let restingOffset = 0;
    let radius = '24px';
    let disposed = false;
    let lastOffset = -1;
    const paint = () => {
      frame = 0;
      if(shell.scrollTop<0)shell.scrollTop=0;
      // Scroll-linked movement has no easing or trailing spring: reversing the gesture is exact.
      const progress = headingEnd > 0 ? Math.min(1, Math.max(0, shell.scrollTop) / headingEnd) : 1;
      const offset = mobileOpen ? 0 : restingOffset * (1 - progress);
      if (Math.abs(offset - lastOffset) < 0.01) return;
      lastOffset = offset;
      navigation.style.transform = `translate3d(0, ${offset}px, 0)`;
      surface.style.clipPath = `inset(${offset}px 0 0 round ${radius})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const measure = () => {
      if (disposed) return;
      const railStyle = getComputedStyle(rail);
      const footerStyle = getComputedStyle(footer);
      const headingStyle = heading ? getComputedStyle(heading) : null;
      headingEnd = title ? Math.max(0, layoutTop(title) - layoutTop(shell) + title.offsetHeight) : 0;
      const headingSpace = heading ? Math.max(0, layoutTop(heading) - layoutTop(shell) + heading.offsetHeight + Number.parseFloat(headingStyle?.marginBottom || '0')) : 0;
      // Keep every control visible even in a short landscape viewport.
      const freeSpace = rail.clientHeight - navigation.offsetHeight - footer.offsetHeight
        - Number.parseFloat(railStyle.paddingTop) - Number.parseFloat(railStyle.paddingBottom)
        - Number.parseFloat(footerStyle.marginTop || '0');
      const pinnedGap = Math.max(0, layoutTop(rail) - layoutTop(shell));
      restingOffset = Math.min(Math.max(0, headingSpace - pinnedGap), Math.max(0, freeSpace));
      radius = railStyle.borderTopLeftRadius;
      lastOffset = -1;
      paint();
    };
    measure();
    const wheel=(event:WheelEvent)=>{
      if(event.ctrlKey||event.deltaY>=0||shell.scrollTop>0)return;
      for(let node=event.target as HTMLElement|null;node&&node!==shell;node=node.parentElement){if(node.scrollHeight>node.clientHeight&&node.scrollTop>0&&/(auto|scroll)/.test(getComputedStyle(node).overflowY))return;}
      event.preventDefault();
    };
    shell.addEventListener('wheel',wheel,{passive:false});
    shell.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(measure);
    [shell, rail, navigation, footer, ...(heading ? [heading] : []), ...(title && title !== heading ? [title] : [])].forEach(element => observer.observe(element));
    document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell.removeEventListener('scroll', schedule);
      shell.removeEventListener('wheel',wheel);
      navigation.style.removeProperty('transform');
      surface.style.removeProperty('clip-path');
    };
  }, [rootRef, sectionKey, expanded, mobileOpen, active]);
}
