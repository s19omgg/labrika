import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

type Option = {value:string;label:string;disabled?:boolean};
type ControlProps = {value:string;onChange:(value:string)=>void;'aria-label'?:string;id?:string;disabled?:boolean;className?:string};
export function Popover({anchor,children,onClose,className='',width}: {anchor:RefObject<HTMLButtonElement|null>;children:ReactNode;onClose:()=>void;className?:string;width?:number}) {
  const ref=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose); closeRef.current=onClose;
  const [position,setPosition]=useState({top:0,left:0,width:width??240,visibility:'hidden' as 'hidden'|'visible'});
  useLayoutEffect(()=>{
    const place=()=>{const a=anchor.current?.getBoundingClientRect(),p=ref.current;if(!a||!p)return;const w=Math.min(width??Math.max(a.width,180),window.innerWidth-24);const h=Math.min(p.scrollHeight,window.innerHeight-24);const below=window.innerHeight-a.bottom-12;setPosition({left:Math.max(12,Math.min(a.left,window.innerWidth-w-12)),top:below>=h||below>=a.top-12?Math.min(a.bottom+7,window.innerHeight-h-12):Math.max(12,a.top-h-7),width:w,visibility:'visible'});};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[anchor,width]);
  useEffect(()=>{
    const first=ref.current?.querySelector<HTMLElement>('[aria-selected="true"]:not([disabled]), [aria-current="date"], button:not([disabled])');first?.focus({preventScroll:true});first?.scrollIntoView({block:'nearest'});
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node)&&!anchor.current?.contains(event.target as Node))closeRef.current();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeRef.current();anchor.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
  },[anchor]);
  return createPortal(<div ref={ref} className={`design-v2 floating-surface ${className}`} data-floating-menu style={position} onKeyDown={e=>{if(e.key==='Tab'){const buttons=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')??[]);const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>{children}</div>,document.body);
}
export function Select({value,onChange,options,'aria-label':label,id,disabled,className=''}:ControlProps&{options:Option[]}) {
  const [open,setOpen]=useState(false);const anchor=useRef<HTMLButtonElement>(null);const listId=useId();
  const choose=(next:string)=>{onChange(next);setOpen(false);anchor.current?.focus();};
  return <><button type="button" ref={anchor} id={id} className={`custom-select ${className}`} role="combobox" aria-label={label} aria-controls={open?listId:undefined} aria-expanded={open} aria-haspopup="listbox" disabled={disabled} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();setOpen(true);}}}><span>{options.find(option=>option.value===value)?.label??value}</span><ChevronDown size={14}/></button>{open&&<Popover anchor={anchor} onClose={()=>setOpen(false)} className="select-popover"><div id={listId} role="listbox" aria-label={label} onKeyDown={e=>{const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])'));const index=items.indexOf(document.activeElement as HTMLButtonElement);let next=index;if(e.key==='ArrowDown')next=(index+1)%items.length;else if(e.key==='ArrowUp')next=(index-1+items.length)%items.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=items.length-1;else return;e.preventDefault();items[next]?.focus();}}>{options.map(option=><button type="button" role="option" key={option.value} aria-selected={value===option.value} disabled={option.disabled} onClick={()=>choose(option.value)}><span>{option.label}</span>{value===option.value&&<Check size={15}/>}</button>)}</div></Popover>}</>;
}
const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function DatePicker({value,onChange,min,'aria-label':label='Дата',id,disabled,className=''}:ControlProps&{min?:string}) {
  const [open,setOpen]=useState(false);const anchor=useRef<HTMLButtonElement>(null);
  const parsed=new Date(`${value||dateValue(new Date())}T12:00:00`);
  const [month,setMonth]=useState(new Date(parsed.getFullYear(),parsed.getMonth(),1));
  const start=new Date(month.getFullYear(),month.getMonth(),1);start.setDate(start.getDate()-(start.getDay()+6)%7);
  const days=Array.from({length:42},(_,index)=>{const d=new Date(start);d.setDate(start.getDate()+index);return d;});
  const today=dateValue(new Date());
  return <><button type="button" ref={anchor} id={id} className={`custom-select custom-date ${className}`} disabled={disabled} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{if(!open)setMonth(new Date(parsed.getFullYear(),parsed.getMonth(),1));setOpen(v=>!v);}}><CalendarDays size={16}/><span>{value?parsed.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Выбрать дату'}</span><ChevronDown size={14}/></button>{open&&<Popover anchor={anchor} onClose={()=>setOpen(false)} className="date-popover" width={300}><div role="dialog" aria-label={`Календарь: ${label}`}><div className="date-popover-heading"><button type="button" className="icon-button" aria-label="Предыдущий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</strong><button type="button" className="icon-button" aria-label="Следующий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div><div className="date-weekdays">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=><span key={day}>{day}</span>)}</div><div className="date-grid" role="grid" onKeyDown={e=>{const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(e.key in delta))return;e.preventDefault();const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=buttons[index+delta[e.key]];if(next&&!next.disabled)next.focus();}}>{days.map(day=>{const date=dateValue(day);return <button type="button" role="gridcell" aria-label={day.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})} aria-selected={date===value} aria-current={date===today?'date':undefined} disabled={!!min&&date<min} className={`${day.getMonth()!==month.getMonth()?'is-outside':''} ${date===value?'is-selected':''}`} key={date} onClick={()=>{onChange(date);setOpen(false);anchor.current?.focus();}}>{day.getDate()}</button>;})}</div><button type="button" className="date-today" disabled={!!min&&today<min} onClick={()=>{onChange(today);setOpen(false);anchor.current?.focus();}}>Сегодня</button></div></Popover>}</>;
}
export function TimePicker({value,onChange,'aria-label':label='Время',className='',...rest}:ControlProps&{min?:string}) {
  const values=Array.from({length:96},(_,index)=>`${String(Math.floor(index/4)).padStart(2,'0')}:${String(index%4*15).padStart(2,'0')}`);if(value&&!values.includes(value))values.push(value);values.sort();
  return <div className={`custom-time ${className}`}><Clock3 size={16}/><Select {...rest} value={value} onChange={onChange} aria-label={label} options={values.map(time=>({value:time,label:time,disabled:!!rest.min&&time<rest.min}))}/></div>;
}
