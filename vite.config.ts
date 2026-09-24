import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createCreativeHandler } from './server/creative-service.mjs';
import { createApprovalHandler } from './server/approvals.mjs';
import { labrikaRoutes } from './server/routing.mjs';

function attachLocalBackend(server: { middlewares: { use: (handler: any) => void } }) {
  server.middlewares.use(createCreativeHandler());
  server.middlewares.use(createApprovalHandler({ issuerKey: process.env.APPROVAL_ISSUER_KEY }));
  server.middlewares.use(labrikaRoutes);
}

export default defineConfig({
  base: '/labrika/',
  server: {
    fs: {
      deny: ['.env', '.env.*', '**/.data/**', '**/*.key', '**/.git/**', '*.{crt,pem}']
    }
  },
  plugins: [
    react(),
    {
      name: 'labrika-local-routes',
      configureServer(server) {
        attachLocalBackend(server);
      },
      configurePreviewServer(server) {
        attachLocalBackend(server);
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
        admin: 'admin/index.html'
      }
    }
  }
});
