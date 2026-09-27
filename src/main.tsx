import {getTeamAccess} from './team-data';
import React from 'react';
import { ThemeController } from './AppearanceSettings';
import ReactDOM from 'react-dom/client';
import App from './App';
import LabrikaAdmin from './LabrikaAdmin';
import LabrikaEntry from './LabrikaEntry';
import LegalDocuments, {legalTitles, type LegalDocument} from './LegalDocuments';
import { WorkspaceProvider } from './store';
import { isLabrika, productName } from './runtime';
import { ensureLocalAdministrator, logoutAccount, useBillingAccount } from './billing-data';
import './styles.css';
import './theme-v2.css';
import './surfaces-v2.css';
import './workspace-v3.css';
import './controller-v4.css';
import './product-shell.css';
import './workspace-v6.css';
import './sidebar-motion.css';
import './visual-v7.css';
import './entry-v6.css';
function PublicWorkspace(){
  const account=useBillingAccount();
  if(!account)return <LabrikaEntry/>;
  if(account.status==='blocked'||account.ownerId&&!getTeamAccess().member)return <main className="design-v2 blocked-account"><span>LABRICA</span><h1>Доступ приостановлен</h1><p>Обратитесь к администратору вашего пространства.</p><button className="btn btn-primary" onClick={logoutAccount}>Выйти</button></main>;
  return <WorkspaceProvider key={account.id}><App/></WorkspaceProvider>;
}
import './theme.css';
import './company-brand.css';
function PublicDocuments(){
  const [document,setDocument]=React.useState<LegalDocument|null>(()=>{const value=new URLSearchParams(location.search).get('legal');return value&&Object.hasOwn(legalTitles,value)?value as LegalDocument:null;});
  if(!document)return null;
  return <LegalDocuments document={document} onClose={()=>{setDocument(null);const url=new URL(location.href);url.searchParams.delete('legal');history.replaceState(null,'',url.pathname+url.search+url.hash);}}/>;
}
ensureLocalAdministrator();
document.title=isLabrika&&/\/admin\/?$/.test(location.pathname)?'LABRICA · Управление':`${productName} · Content Studio`;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeController/>{isLabrika?(/\/admin\/?$/.test(location.pathname)?<LabrikaAdmin/>:<><PublicWorkspace/><PublicDocuments/></>):<WorkspaceProvider><App/></WorkspaceProvider>}</React.StrictMode>);
