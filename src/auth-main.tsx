import React from 'react';
import ReactDOM from 'react-dom/client';
import CookieBanner from './CookieBanner';
import LabrikaEntry from './LabrikaEntry';
import type {BillingAccount} from './billing-data';
import {serviceUrl} from './service-urls';
import './product-styles';

function AuthRoot(){
 const complete=(_account:BillingAccount)=>{location.assign(serviceUrl('app','/'));};
 return <><LabrikaEntry onAuthenticated={complete}/><CookieBanner/></>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthRoot/></React.StrictMode>);
