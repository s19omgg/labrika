import {useEffect,useMemo,useState} from 'react';
import CookieBanner from '../src/CookieBanner';
import {serviceUrl} from '../src/service-urls';
import {legalDocument,legalDocuments} from './documents';

function currentSlug(){
 const parts=location.pathname.split('/').filter(Boolean);
 return parts[0]==='legal'?(parts[1]||''):parts[0]||'';
}

function cleanDocument(source:string){
 const parsed=new DOMParser().parseFromString(source,'text/html');
 const body=parsed.body;
 Array.from(body.children).slice(0,3).forEach(node=>node.remove());
 body.querySelectorAll('*').forEach(node=>{
  const tag=node.tagName.toLowerCase();
  if(!['p','span','br','table','tbody','thead','tr','td','th','ul','ol','li'].includes(tag)){
   node.replaceWith(...Array.from(node.childNodes));return;
  }
  Array.from(node.attributes).forEach(attribute=>{if(!['colspan','rowspan'].includes(attribute.name))node.removeAttribute(attribute.name);});
 });
 body.querySelectorAll('p').forEach(paragraph=>{
  const text=paragraph.textContent?.trim()||'';
  if(/^\d+(?:\.\d+)*\.\s/.test(text))paragraph.classList.add('legal-heading');
  if(/^[—–-]\s/.test(text)||/^•\s/.test(text))paragraph.classList.add('legal-list-item');
 });
 const firstTable=body.querySelector('table');
 if(firstTable?.querySelectorAll('tr').length===1&&firstTable.querySelectorAll('td').length===1)firstTable.classList.add('legal-callout');
 return body.innerHTML;
}

export default function LegalSite(){
 const slug=currentSlug(),documentMeta=legalDocument(slug);
 const [content,setContent]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!documentMeta)return;
  document.title=`${documentMeta.title} · LABRICA`;
  setContent('');setFailed(false);
  fetch(`/legal-documents/${documentMeta.slug}.html`).then(response=>{if(!response.ok)throw Error();return response.text();}).then(html=>setContent(cleanDocument(html))).catch(()=>setFailed(true));
 },[documentMeta]);
 const number=useMemo(()=>documentMeta?String(legalDocuments.indexOf(documentMeta)+1).padStart(2,'0'):'', [documentMeta]);
 return <><div className="legal-shell"><header className="legal-header"><a className="legal-brand" href={serviceUrl('landing','/')}><img src="/brand/labrica-symbol.svg" alt=""/><img src="/brand/labrica-wordmark.svg" alt="LABRICA"/></a><nav><a href={serviceUrl('legal','/')}>Все документы</a><a href="mailto:privacy@labrica.pro">privacy@labrica.pro</a></nav></header>
  {!documentMeta?<main className="legal-home"><section className="legal-hero"><p>Правовая информация</p><h1>Документы<br/>LABRICA</h1><div><span>Редакция от 28.09.2026</span><span>10 документов</span></div></section><section className="legal-index" aria-label="Список документов">{legalDocuments.map((item,index)=><a key={item.slug} href={serviceUrl('legal',`/${item.slug}`)}><span>{String(index+1).padStart(2,'0')}</span><div><h2>{item.title}</h2><p>{item.short}</p></div><b aria-hidden="true">↗</b></a>)}</section></main>:
  <main className="legal-document-page"><aside><a href={serviceUrl('legal','/')}>← Все документы</a><span>{number} / {String(legalDocuments.length).padStart(2,'0')}</span><nav>{legalDocuments.map(item=><a key={item.slug} className={item.slug===slug?'active':''} href={serviceUrl('legal',`/${item.slug}`)}>{item.title}</a>)}</nav></aside><article><header><p>Официальный документ</p><h1>{documentMeta.title}</h1><div><span>Редакция от 28.09.2026</span><a href={`/legal-documents/${documentMeta.slug}.docx`} download>Скачать DOCX ↓</a></div></header>{failed?<p className="legal-error">Не удалось загрузить документ. Попробуйте обновить страницу или скачайте DOCX.</p>:content?<div className="legal-source" dangerouslySetInnerHTML={{__html:content}}/>:<div className="legal-loading" aria-label="Загрузка документа"><i/><i/><i/></div>}</article></main>}
  <footer className="legal-footer"><span>© 2026 LABRICA</span><span>ИП Байгот Сергей Русланович · ИНН 440120577981 · ОГРНИП 323440000020443</span><a href="mailto:inbox@labrica.pro">inbox@labrica.pro</a></footer></div><CookieBanner/></>;
}
