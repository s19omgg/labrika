import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
export { Select, DatePicker, TimePicker } from './controls';
import { X, Instagram, Youtube, Send, ArrowUpRight } from 'lucide-react';
import { platformMeta, statusMeta } from './model';
import PlatformGlyph from './PlatformGlyph';
import type { Platform, PostStatus } from './model';

export function PlatformIcon({platform, size = 24}: {platform: Platform; size?: number}) {
  return <span className={`platform-icon platform-${platform}`} style={{width: size, height: size, fontSize: size * .37, display:'inline-flex', alignItems:'center', justifyContent:'center', lineHeight:1}} title={platformMeta[platform].name} aria-label={platformMeta[platform].name}>{platform === 'telegram' ? <Send size={size * .53} fill="currentColor" strokeWidth={1.4}/> : platform === 'instagram' ? <Instagram size={size * .58} strokeWidth={1.6}/> : platform === 'youtube' ? <Youtube size={size * .62} strokeWidth={1.8}/> : platform === 'vk' ? <svg aria-hidden="true" viewBox="0 0 24 24" width={size * .59} height={size * .59} fill="currentColor"><path d="M13.16 18.53C4.96 18.53.28 12.91.08 3.55h4.1c.14 6.87 3.17 9.78 5.57 10.38V3.55h3.86v5.93c2.37-.26 4.85-2.96 5.69-5.93h3.86a11.43 11.43 0 0 1-5.24 7.47c2.26 1.12 4.99 3.58 5.93 7.51h-4.25c-.87-2.63-3.04-4.67-5.99-4.99v4.99h-.45Z"/></svg> : <PlatformGlyph platform={platform} size={size * .58}/>}</span>;
}
export function StatusBadge({status}: {status: PostStatus}) { return <span className={`badge badge-${statusMeta[status].color}`}><i />{statusMeta[status].name}</span>; }
export function Avatar({name, size = 30, src}: {name: string; size?: number; src?:string}) { return <span className={`avatar avatar-${name.length % 4}`} title={name} style={{width: size, height: size, fontSize: size * .34, overflow:'hidden',flexShrink:0}}>{src?<img src={src} alt={name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>:name.slice(0, 1)}</span>; }
export function PostCover({cover, className = ''}: {cover: string; className?: string}) { return <span className={`post-cover cover-${cover} ${className}`} aria-hidden="true"><span className="cover-orbit"/><ArrowUpRight className="cover-arrow" strokeWidth={1.2}/></span>; }
export function Modal({children, onClose, title, wide = false}: {children: ReactNode; onClose: () => void; title: string; wide?: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!ref.current?.contains(document.activeElement)) (ref.current?.querySelector<HTMLElement>('input:not([readonly]), textarea:not([readonly])') ?? ref.current)?.focus();
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector('[data-floating-menu]')) return;
      const dialogs=document.querySelectorAll('[role=dialog]');if(dialogs[dialogs.length-1]!==ref.current)return;
      if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current();
      if (e.key === 'Tab') {
        const list = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]');
        if (!list?.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault();last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first.focus();}
      }
    };
    document.addEventListener('keydown', handler);
    return () => {document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', handler); previous?.focus();};
  }, []);
  return createPortal(<div className="design-v2 overlay-root"><div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) onClose();}}><div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={19}/></button></div>{children}</div></div></div>, document.body);
}
