import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  reporter:'list',
  use:{baseURL:'http://localhost:3000',channel:'chrome',headless:true,viewport:{width:1440,height:1000},timezoneId:'Europe/Istanbul',screenshot:'only-on-failure'},
  webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true},
});
