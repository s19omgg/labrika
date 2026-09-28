import {getTeamAccess} from './team-data';
import React,{useEffect} from 'react';
import {ThemeController} from './AppearanceSettings';
import ReactDOM from 'react-dom/client';
import App from './App';
import CookieBanner from './CookieBanner';
import LabricaBrand from './LabricaBrand';
import {WorkspaceProvider} from './store';
import {bootstrapBillingSession,logoutAccount,useBillingAccount} from './billing-data';
import {serviceUrl} from './service-urls';
import './product-styles';


function PublicWorkspace(){
  const account=useBillingAccount();
  useEffect(()=>{if(!account)location.replace(serviceUrl('auth','/login'));},[account]);
  if(!account)return <main className="design-v2 account-redirect"><LabricaBrand/><p>Переходим к странице входа…</p><a href={serviceUrl('auth','/login')}>Открыть страницу входа</a></main>;
  if(account.status==='blocked'||account.ownerId&&!getTeamAccess().member)return <main className="design-v2 blocked-account"><span>LABRICA</span><h1>Доступ приостановлен</h1><p>Обратитесь к администратору вашего пространства.</p><button className="btn btn-primary" onClick={logoutAccount}>Выйти</button></main>;
  return <WorkspaceProvider key={account.id}><App/></WorkspaceProvider>;
}

document.title='LABRICA · Контент-платформа';
async function start(){
  await bootstrapBillingSession();
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeController/><PublicWorkspace/><CookieBanner/></React.StrictMode>);
}
void start();
