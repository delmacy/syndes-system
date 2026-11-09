import {defineConfig} from "vite";
export default defineConfig({
  server:{host:"127.0.0.1",port:4179,strictPort:true,
    proxy:{"/v1/tenants":{target:"http://127.0.0.1:4180",changeOrigin:false}}},
  build:{outDir:"dist",emptyOutDir:true},
});
