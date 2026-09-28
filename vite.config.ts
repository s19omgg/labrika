import 'dotenv/config';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {createAuthHandler} from './server/auth-service.mjs';
import {createAdminAuthHandler} from './server/admin-auth.mjs';
import {createAccountStore} from './server/account-store.mjs';
import {createAdminOverview,createRuntimeMonitor} from './server/admin-monitoring.mjs';
import {landingSeo} from './server/landing-seo.mjs';
import {createSocialHandler} from './server/social-service.mjs';
import {createProviderService} from './server/provider-service.mjs';
import {createCreativeHandler} from './server/creative-service.mjs';
import {createApprovalHandler} from './server/approvals.mjs';
import {editionRoutes,infrastructureGate} from './server/routing.mjs';

const accountStore=createAccountStore();
const auth=createAuthHandler({accountStore});
const social=createSocialHandler({resolveAccount:req=>auth.accountForRequest(req)});
const providers=createProviderService();
const monitor=createRuntimeMonitor();
const overview=createAdminOverview({accountStore,auth,providers,social,monitor});
const adminAuth=createAdminAuthHandler({accountStore,overview});
const creative=createCreativeHandler({
  resolveAdapter:req=>providers.creativeAdapter(String(req.headers['x-product-edition']||'labrika')),
  resolveCapabilities:req=>providers.capabilities(String(req.headers['x-product-edition']||'labrika')),
});
const approval=createApprovalHandler({issuerKey:process.env.APPROVAL_ISSUER_KEY});
const api={
  name:'labrika-local-api',
  configureServer(server){server.middlewares.use(monitor.middleware);server.middlewares.use(infrastructureGate);server.middlewares.use(monitor.health);server.middlewares.use(adminAuth);server.middlewares.use(auth);server.middlewares.use(providers.handler);server.middlewares.use(social);server.middlewares.use(creative);server.middlewares.use(approval);server.middlewares.use(editionRoutes);},
  configurePreviewServer(server){server.middlewares.use(monitor.middleware);server.middlewares.use(infrastructureGate);server.middlewares.use(monitor.health);server.middlewares.use(adminAuth);server.middlewares.use(auth);server.middlewares.use(providers.handler);server.middlewares.use(social);server.middlewares.use(creative);server.middlewares.use(approval);server.middlewares.use(editionRoutes);},
};

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'PUBLIC_');
  return {
    server:{fs:{deny:['.env','.env.*','**/.data/**','**/*.key','**/.git/**','*.{crt,pem}']}},
    plugins:[react(),landingSeo(env.PUBLIC_SITE_URL),api],
    build:{rollupOptions:{input:{landing:'index.html',app:'app/index.html',auth:'auth/index.html',admin:'admin/index.html',legal:'legal/index.html'}}},
  };
});
