import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",
 testMatch:"*.spec.mjs",
 fullyParallel:false,
 workers:1,
 retries:0,
 timeout:100_000,
 expect:{timeout:20_000},
 reporter:[["list"],["junit",{outputFile:"e2e-results/report.xml"}]],
 use:{
  baseURL:"http://127.0.0.1:4179",
  headless:true,
  ignoreHTTPSErrors:true,
  screenshot:"only-on-failure",
  trace:"retain-on-failure"
 },
 webServer:{
  command:"npm run dev -- --host 127.0.0.1",
  url:"http://127.0.0.1:4179",
  reuseExistingServer:false,
  timeout:60_000,
 },
});
