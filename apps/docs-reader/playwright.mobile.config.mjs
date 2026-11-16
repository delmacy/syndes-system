import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
 testDir:"./tests",
 testMatch:"mobile-ux.spec.mjs",
 timeout:60000,
 expect:{timeout:10000},
 retries:1,
 workers:2,
 reporter:[["list"],["html",{open:"never",outputFolder:"playwright-mobile-report"}]],
 use:{
   baseURL:process.env.MOBILE_PREVIEW_BASE||"http://127.0.0.1:8766/syndes-system/",
   trace:"retain-on-failure",
   screenshot:"only-on-failure",
   actionTimeout:12000
 },
 projects:[
   {name:"mobile-iphone-emulated",use:{...devices["iPhone 13"],browserName:"chromium"}},
   {name:"mobile-android-emulated",use:{...devices["Pixel 7"],browserName:"chromium"}}
 ]
});
