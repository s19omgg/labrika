import {defineConfig} from '@playwright/test';

const port=process.env.LABRICA_TEST_PORT||'3000';
const baseURL=`http://localhost:${port}`;

export default defineConfig({
  testDir:'./tests',
  reporter:'list',
  use:{baseURL,channel:'chrome',headless:true,viewport:{width:1440,height:1000},timezoneId:'Europe/Istanbul',screenshot:'only-on-failure'},
  webServer:{command:`npm run dev -- --port ${port} --strictPort`,url:baseURL,reuseExistingServer:true,env:{...process.env,ADMIN_LOGIN:'test-admin',ADMIN_PASSWORD:'test-admin-password',ADMIN_SESSION_SECRET:'playwright-admin-session-secret'}},
});
