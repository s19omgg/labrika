import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import LegalDocuments, {legalTitles,type LegalDocument} from '../src/LegalDocuments';
import './landing-dialog.css';
import './refinements.css';
import './platform-mockups.css';
import {HeroMascot,FeatureArt,Walkthrough,AIChat,Pricing,Peek} from './Sections';
import {initLandingMotion} from './motion';

const currentDocument=():LegalDocument|null=>{
 const name=location.hash.slice(1);
 return Object.hasOwn(legalTitles,name)?name as LegalDocument:null;
};

function LandingDocuments(){
 const [document,setDocument]=useState(currentDocument);
 useEffect(()=>{
  const sync=()=>setDocument(currentDocument());
  window.addEventListener('hashchange',sync);
  window.addEventListener('popstate',sync);
  return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};
 },[]);
 if(!document)return null;
 return <LegalDocuments document={document} onClose={()=>{history.replaceState(null,'',location.pathname+location.search);setDocument(null);}}/>;
}

createRoot(document.getElementById('landing-documents')!).render(<LandingDocuments/>);
createRoot(document.getElementById('hero-character')!).render(<HeroMascot/>);
document.querySelectorAll<HTMLElement>('[data-feature-art]').forEach(host=>{
 const type=host.dataset.featureArt as 'brain'|'studio'|'calendar'|'analytics';
 createRoot(host).render(<FeatureArt type={type}/>);
});
createRoot(document.getElementById('walkthrough-root')!).render(<Walkthrough/>);
createRoot(document.getElementById('ai-chat-root')!).render(<AIChat/>);
createRoot(document.getElementById('pricing-root')!).render(<Pricing/>);
createRoot(document.getElementById('cta-peek-root')!).render(<Peek/>);
requestAnimationFrame(()=>initLandingMotion());
