import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// 动态转发 /ocr-store-{编号} 到对应的 bcebos 对象存储域名
// 原因：飞桨识别结果的 jsonUrl 域名编号不固定（store-1/2/3/4...），且签名授权与编号绑定，
// 无法用静态 proxy target 覆盖，故用中间件按编号动态转发。
const ocrStoreDynamicProxy = {
  name: "ocr-store-dynamic-proxy",
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const m = (req.url || "").match(/^\/ocr-store-(\d+)(\/.*)$/)
      if (!m) return next()
      const num = m[1]
      const rest = m[2]
      const target = `https://paddleocr-store-${num}.bj.bcebos.com${rest}`
      try {
        const upstream: any = await fetch(target)
        const buf = Buffer.from(await upstream.arrayBuffer())
        res.statusCode = upstream.status
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json")
        // 确保浏览器能读取（H5 请求最终是 dev server 返回，同源；这里显式允许）
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.end(buf)
      } catch (e: any) {
        res.statusCode = 502
        res.setHeader("Content-Type", "text/plain")
        res.end("ocr-store proxy error: " + (e?.message || "unknown"))
      }
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), ocrStoreDynamicProxy as any],
  server: {
    host: "0.0.0.0",
    port: 8080,
    // 开发环境代理：解决 H5 浏览器跨域/防盗链/Origin 校验访问飞桨 OCR 接口的问题
    // 关键：浏览器跨域请求会带 Origin: http://localhost:5173，飞桨会因 Origin 不合法返回 403，
    // 因此这里把 Origin 改写为目标域名，让飞桨认为是合法来源。
    proxy: {
      // 飞桨任务接口
      "/ocr-proxy": {
        target: "https://paddleocr.aistudio-app.com",
        changeOrigin: true,
        secure: false,
        headers: { Origin: "https://paddleocr.aistudio-app.com" },
        rewrite: (path) => path.replace(/^\/ocr-proxy/, ""),
      },
      // 注意：jsonUrl 下载走 /ocr-store-{编号} 动态中间件（见上），不再在此静态配置
    },
  },
});
