import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Onboarding from './Onboarding';
import { readWorkspace } from './runtime';
import LabrikaAdmin from './LabrikaAdmin';
import LabrikaEntry from './LabrikaEntry';
import { WorkspaceProvider } from './store';
import { isLabrika, productName } from './runtime';
import { logoutAccount, useBillingAccount } from './billing-data';
import './styles.css';
import './theme-v2.css';
import './surfaces-v2.css';
import './workspace-v3.css';
import './controller-v4.css';
import './product-shell.css';
import './workspace-v6.css';
import './entry-v6.css';
function WorkspaceGate(){const [ready,setReady]=React.useState(()=>readWorkspace<{completed?:boolean}>('onboarding-v1',{}).completed===true);return ready?<App/>:<Onboarding onComplete={()=>setReady(true)}/>;}
function PublicWorkspace(){
  const account=useBillingAccount();
  if(!account)return <LabrikaEntry/>;
  if(account.status==='blocked')return <main className="design-v2 blocked-account"><span>LABRIKA</span><h1>Доступ приостановлен</h1><p>Обратитесь к администратору вашего пространства.</p><button className="btn btn-primary" onClick={logoutAccount}>Выйти</button></main>;
  return <WorkspaceProvider key={account.id}><WorkspaceGate/></WorkspaceProvider>;
}
document.title=isLabrika&&/\/admin\/?$/.test(location.pathname)?'LABRIKA · Управление':`${productName} · Content Studio`;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{isLabrika?(/\/admin\/?$/.test(location.pathname)?<LabrikaAdmin/>:<PublicWorkspace/>):<WorkspaceProvider><App/></WorkspaceProvider>}</React.StrictMode>);
