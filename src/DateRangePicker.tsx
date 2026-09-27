import {useRef,useState} from 'react';
import {CalendarDays,ChevronDown,ChevronLeft,ChevronRight} from 'lucide-react';
import {Popover} from './controls';
import './date-range.css';
export interface DateRange {start:string;end:string}
const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parse=(value:string)=>new Date(`${value}T12:00:00`);
export function rangeLabel({start,end}:DateRange){
 const first=parse(start),last=parse(end);
 if(start===end)return first.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(' г.','');
 const sameMonth=start.slice(0,7)===end.slice(0,7),sameYear=start.slice(0,4)===end.slice(0,4);
 const a=sameMonth?`${first.getDate()}`:first.toLocaleDateString('ru-RU',{day:'numeric',month:'short',...(!sameYear?{year:'numeric'}:{})}).replace(' г.','');
 return `${a}–${last.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(' г.','')}`;
}
export default function DateRangePicker({value,onChange,max}:{value:DateRange;onChange:(value:DateRange)=>void;max?:string}){
 const anchor=useRef<HTMLButtonElement>(null);const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[selectingEnd,setSelectingEnd]=useState(false),[hover,setHover]=useState<string|null>(null);
 const [month,setMonth]=useState(()=>new Date(parse(value.start).getFullYear(),parse(value.start).getMonth(),1));
 const start=new Date(month);start.setDate(1-(start.getDay()+6)%7);
 const days=Array.from({length:42},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return date;});
 const today=iso(new Date()),rangeEnd=selectingEnd&&hover?hover:draft.end;
 const low=draft.start<rangeEnd?draft.start:rangeEnd,high=draft.start>rangeEnd?draft.start:rangeEnd;
 const select=(date:string)=>{if(selectingEnd){setDraft({start:date<draft.start?date:draft.start,end:date>draft.start?date:draft.start});setSelectingEnd(false);setHover(null);}else{setDraft({start:date,end:date});setSelectingEnd(true);}};
 const close=()=>{setOpen(false);anchor.current?.focus({preventScroll:true});};
 return <><button type="button" ref={anchor} className="dash-date-control range-trigger" aria-label="Период дашборда" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{if(!open){setDraft(value);setSelectingEnd(false);setHover(null);setMonth(new Date(parse(value.start).getFullYear(),parse(value.start).getMonth(),1));}setOpen(v=>!v);}}><CalendarDays size={16}/><span>{rangeLabel(value)}</span><ChevronDown size={14}/></button>{open&&<Popover anchor={anchor} onClose={close} className="date-popover range-popover" width={328}><div role="dialog" aria-label="Период дашборда"><div className="date-popover-heading"><button type="button" className="icon-button" aria-label="Предыдущий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</strong><button type="button" className="icon-button" aria-label="Следующий месяц" disabled={!!max&&iso(new Date(month.getFullYear(),month.getMonth()+1,1))>max} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div><div className="range-selection" aria-live="polite"><span>{selectingEnd?'Начало периода':'Период'}</span><strong>{rangeLabel(draft)}</strong></div><div className="date-weekdays">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=><span key={day}>{day}</span>)}</div><div className="date-grid range-grid" role="grid" aria-label="Дни месяца" onMouseLeave={()=>setHover(null)} onKeyDown={event=>{const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in delta))return;event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement),next=buttons[index+delta[event.key]];if(next&&!next.disabled)next.focus();}}>{days.map(day=>{const date=iso(day),selected=date>=low&&date<=high;return <button type="button" role="gridcell" aria-label={day.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})} aria-selected={selected} aria-current={date===today?'date':undefined} data-date={date} disabled={!!max&&date>max} key={date} className={`${day.getMonth()!==month.getMonth()?'is-outside':''} ${selected?'in-range':''} ${date===low?'range-start':''} ${date===high?'range-end':''}`} onMouseEnter={()=>{if(selectingEnd)setHover(date);}} onFocus={()=>{if(selectingEnd)setHover(date);}} onClick={()=>select(date)}>{day.getDate()}</button>;})}</div><div className="range-actions"><button type="button" className="text-button" onClick={close}>Отмена</button><button type="button" className="btn btn-primary" onClick={()=>{onChange(draft);close();}}>Применить</button></div></div></Popover>}</>;
}
