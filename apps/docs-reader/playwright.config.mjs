import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests",testMatch:"e2e.spec.mjs",timeout:40000,retries:1,workers:2,
  reporter:[["list"],["html",{open:"never",outputFolder:"playwright-report"}]],
  use:{baseURL:process.env.READER_URL||"http://127.0.0.1:3000",trace:"retain-on-failure",screenshot:"only-on-failure",acceptDownloads:true,...(process.env.PLAYWRIGHT_CHROME_PATH?{launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH}}:{})},
  projects:[
    {name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"mobile",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}
  ]
});
