import { existsSync } from "node:fs"
import { createServer as createHttpServer } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import app from "./app.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const isDevelopment = process.argv.includes("--dev")
const port = Number(process.env.PORT || 5173)
const httpServer = createHttpServer(app)

if (isDevelopment) {
  const { createServer: createViteServer } = await import("vite")
  const vite = await createViteServer({ root, appType: "spa", server: { middlewareMode: true, hmr: { server: httpServer } } })
  app.use(vite.middlewares)
} else {
  const dist = join(root, "dist")
  if (!existsSync(dist)) throw new Error("Folder dist belum tersedia. Jalankan npm run build terlebih dahulu.")
  const express = await import("express")
  app.use(express.default.static(dist))
  app.use((request, response, next) => request.method === "GET" ? response.sendFile(join(dist, "index.html")) : next())
}

const host = process.env.HOST || "127.0.0.1"
httpServer.listen(port, host, () => {
  console.log(`Techrey Digital aktif:`)
  console.log(`- Lokal:     http://127.0.0.1:${port}`)
  if (host !== "127.0.0.1") console.log(`- Network:   http://${host}:${port}`)
})
