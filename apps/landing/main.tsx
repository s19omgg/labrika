import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import LegalDocuments, {legalTitles,type LegalDocument} from '../labrika/src/LegalDocuments';
import './landing-dialog.css';

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
