import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean)
const chromePath = chromeCandidates.find(existsSync)
if (!chromePath) throw new Error("Chrome atau Edge tidak ditemukan.")

const port = 9400 + Math.floor(Math.random() * 300)
const requestedAppUrl = process.env.APP_URL || "http://127.0.0.1:5173"
let appUrl = requestedAppUrl
let appServer
try {
  const health = await fetch(appUrl + "/api/health").then((response) => response.ok)
  if (!health) throw new Error("health failed")
} catch {
  const appPort = 9700 + Math.floor(Math.random() * 200)
  appUrl = `http://127.0.0.1:${appPort}`
  appServer = spawn(process.execPath, ["--no-warnings", "server.mjs", "--dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(appPort), HOST: "127.0.0.1" },
    stdio: "ignore",
    windowsHide: true,
  })
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      if (await fetch(appUrl + "/api/health").then((response) => response.ok)) break
    } catch {}
    if (appServer.exitCode !== null || attempt === 399) {
      appServer.kill()
      throw new Error("Server aplikasi tidak siap. Jalankan npm run dev untuk melihat detail error.")
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
const profile = mkdtempSync(join(tmpdir(), "techrey-browser-"))
const chrome = spawn(chromePath, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--remote-debugging-port=" + port,
  "--user-data-dir=" + profile,
  "about:blank",
], { stdio: "ignore", windowsHide: true })

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const stopProcess = async (child) => {
  if (!child || child.exitCode !== null) return
  const exited = new Promise((resolve) => child.once("exit", resolve))
  child.kill()
  await Promise.race([exited, wait(2_000)])
}

async function pageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch("http://127.0.0.1:" + port + "/json/list").then((response) => response.json())
      const page = targets.find((target) => target.type === "page")
      if (page) return page
    } catch {}
    await wait(100)
  }
  throw new Error("Chrome DevTools tidak siap.")
}

const target = await pageTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

let sequence = 0
const pending = new Map()
const browserErrors = []
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})

const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  return result.result.value
}

async function waitFor(expression, label, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await wait(100)
  }
  throw new Error(`Halaman tidak siap: ${label}.`)
}

try {
  await command("Runtime.enable")
  const unknownApi = await fetch(appUrl + "/api/route-that-does-not-exist")
  if (unknownApi.status !== 404 || !unknownApi.headers.get("content-type")?.includes("application/json")) throw new Error("API 404 tidak valid.")
  const invalidJson = await fetch(appUrl + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" })
  if (invalidJson.status !== 400) throw new Error("JSON rusak tidak menghasilkan status 400.")

  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await command("Page.navigate", { url: appUrl + "/" })
  await waitFor("document.querySelector('.site-header') && document.querySelector('.hero')", "beranda desktop")
  await waitFor("document.querySelector('canvas') || document.querySelector('.hero-fallback')?.naturalWidth", "visual hero")
  const desktop = await evaluate("({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, logo: Boolean(document.querySelector('.brand img')), canvas: document.querySelectorAll('canvas').length, fallback: Boolean(document.querySelector('.hero-fallback')?.naturalWidth), adminInPublicNav: [...document.querySelectorAll('.site-header nav a')].some((item) => item.textContent.trim() === 'Admin')})")
  if (desktop.width !== 1440 || desktop.scrollWidth > 1456 || !desktop.logo || (!desktop.canvas && !desktop.fallback) || desktop.adminInPublicNav) {
    throw new Error("Tampilan desktop atau navigasi publik gagal: " + JSON.stringify(desktop))
  }

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command("Page.navigate", { url: appUrl + "/masuk" })
  await waitFor("document.querySelector('.login-card')", "halaman masuk mobile")

  const mobile = await evaluate("({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, mobileRule: matchMedia('(max-width: 430px)').matches, loginTop: getComputedStyle(document.querySelector('.mobile-login')).display !== 'none', googleEnabled: ![...document.querySelectorAll('button')].find((item) => item.textContent.includes('Google'))?.disabled, githubEnabled: ![...document.querySelectorAll('button')].find((item) => item.textContent.includes('GitHub'))?.disabled})")
  if (mobile.width !== 390 || mobile.scrollWidth > 390 || !mobile.mobileRule || !mobile.loginTop || !mobile.googleEnabled || !mobile.githubEnabled) {
    throw new Error("Tampilan mobile atau login OAuth gagal: " + JSON.stringify(mobile))
  }

  const menu = await evaluate("(async () => { const button = document.querySelector('.menu-button'); button.focus(); button.click(); await new Promise((resolve) => setTimeout(resolve, 50)); return {open: button.getAttribute('aria-expanded') === 'true'}; })()")
  if (!menu.open) throw new Error("Menu mobile tidak terbuka.")
  await command("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await wait(80)
  const keyboard = await evaluate("({closed: document.querySelector('.menu-button').getAttribute('aria-expanded') === 'false', focusReturned: document.activeElement === document.querySelector('.menu-button')})")
  if (!keyboard.closed || !keyboard.focusReturned) throw new Error("Escape atau pengembalian fokus menu gagal: " + JSON.stringify(keyboard))

  await command("Page.navigate", { url: appUrl + "/akun/pesanan" })
  await waitFor("document.body.innerText.includes('Masuk untuk melihat pesananmu')", "guard pelanggan")
  const customerGuard = await evaluate("document.body.innerText.includes('Masuk untuk melihat pesananmu')")
  await command("Page.navigate", { url: appUrl + "/admin" })
  await waitFor("document.body.innerText.includes('Login admin diperlukan')", "guard admin")
  const adminGuard = await evaluate("document.body.innerText.includes('Login admin diperlukan')")
  if (!customerGuard || !adminGuard) throw new Error("Guard pelanggan atau admin tidak tampil untuk sesi anonim.")

  await command("Page.navigate", { url: appUrl + "/#%5B" })
  await waitFor("document.querySelector('.hero')", "beranda dengan hash")
  if (!await evaluate("Boolean(document.querySelector('.hero'))")) throw new Error("Hash tidak valid merusak beranda.")

  const formLayouts = []
  for (const width of [320, 390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 })
    await command("Page.navigate", { url: appUrl + "/pesan" })
    await waitFor("document.querySelector('.order-unified-form')", `formulir ${width}px`)
    const layout = await evaluate("({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, heading: document.querySelector('main h1')?.textContent, formBackground: getComputedStyle(document.querySelector('.order-unified-form')).backgroundColor, serviceWidth: document.querySelector('.service-grid-compact').getBoundingClientRect().width})")
    if (layout.scrollWidth > width || !layout.heading || layout.formBackground === "rgba(0, 0, 0, 0)") throw new Error("Formulir tidak rapi: " + JSON.stringify(layout))
    formLayouts.push(layout)
    if (process.env.SMOKE_SCREENSHOTS === "1") {
      const directory = join(process.cwd(), "logs", "browser-smoke")
      mkdirSync(directory, { recursive: true })
      const screenshot = await command("Page.captureScreenshot", { format: "png" })
      writeFileSync(join(directory, `form-${width}.png`), Buffer.from(screenshot.data, "base64"))
    }
  }
  await evaluate("document.querySelector('.order-main-submit').click()")
  await wait(100)
  if (!await evaluate("document.querySelector('[role=alert]')?.textContent.includes('pilih salah satu')")) throw new Error("Validasi layanan tidak tampil.")
  await command("Page.navigate", { url: appUrl + "/masuk?error=oauth&next=/pesan" })
  await waitFor("document.querySelector('.login-card')", "pesan kegagalan OAuth")
  if (!await evaluate("document.querySelector('[role=alert]')?.textContent.includes('Login belum berhasil')")) throw new Error("Kegagalan OAuth tidak ditampilkan.")

  const adminMobile = []
  for (const width of [320, 390, 430]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true })
    await command("Page.navigate", { url: appUrl + "/" })
    await waitFor("document.querySelector('.site-header')", `CSS admin mobile ${width}px`)
    const layout = await evaluate(`(() => {
    document.body.innerHTML = '<div class="admin-shell"><div class="admin-frame"><aside class="admin-sidebar"><div class="admin-brand-row"></div><nav><a>Ringkasan</a><a>Pesanan</a><a>Pembayaran</a></nav></aside><main class="admin-content"><div class="admin-topline"><div class="admin-topline-right"><button class="admin-topline-logout">Keluar</button></div></div><div class="admin-page"><nav class="mobile-admin-jump"><a>Bayar</a><a>Brief</a><a>Revisi</a><a>AI</a><a>Progres</a></nav><div class="admin-detail-grid"><div class="admin-detail-main"><section class="admin-card detail-section"><div class="admin-card-heading"><div><span>01 / BRIEF</span><h2>Kebutuhan pelanggan</h2></div></div><p class="brief-copy">Buatkan website e-commerce modern dengan checkout dan katalog produk yang lengkap.</p><dl class="detail-list"><div><dt>Keperluan</dt><dd>Usaha</dd></div><div><dt>Anggaran awal</dt><dd>Rp 500.000</dd></div><div><dt>Lampiran</dt><dd>Tidak ada</dd></div></dl><div class="inline-actions"><button class="button button-small">Tandai ditinjau</button></div><form class="admin-inline-form"><label>Informasi yang perlu dilengkapi</label><textarea rows="3" placeholder="Contoh: mohon kirim pedoman format dan jumlah halaman final."></textarea><button class="button button-ghost button-small">Kirim permintaan informasi</button></form></section><section class="admin-card assistant-panel"><div class="assistant-heading"><div class="assistant-mark"></div><div><span>ASISTEN TECHREY</span><h2>Bantu baca brief, keputusan tetap di Anda.</h2></div></div></section></div><aside class="admin-detail-side"><section class="admin-card detail-section"><div class="admin-card-heading"><h2>Pembayaran</h2></div></section></aside></div></div></main></div></div>';
    document.querySelector('.mobile-admin-jump').insertAdjacentHTML('afterend', '<section class="admin-stats"><article><span>Pembayaran terverifikasi</span><strong>Rp 800.000</strong><small>Akumulasi total</small></article><article><span>Pesanan aktif</span><strong>01</strong><small>Termasuk antrean dan revisi</small></article><article><span>Perlu verifikasi</span><strong>00</strong><small>Pembayaran pelanggan</small></article><article><span>Revisi aktif</span><strong>00</strong><small>Perlu ditangani</small></article></section><section class="payment-queue-summary"><button><span>Perlu dicek</span><strong>0</strong><small>Buka dan cocokkan transaksi</small></button><button><span>Menunggu pelanggan</span><strong>1</strong><small>Belum perlu tindakan admin</small></button><button><span>Selesai diverifikasi</span><strong>4</strong><small>Pembayaran sudah cocok</small></button></section>');
    document.querySelector('.admin-detail-main').insertAdjacentHTML('beforeend', '<section class="admin-card detail-section revision-action-card"><div class="admin-card-heading"><div><span class="badge-revision-active">REVISI PELANGGAN</span><h2>Penanganan Revisi Pekerjaan</h2></div></div><div class="revision-actions-group"><div class="revision-upload-box"><label>Unggah hasil revisi</label><div class="revision-upload-row"><input type="file"><button class="button button-small">Selesaikan revisi dan kirim hasil</button></div></div></div></section><form class="admin-card detail-section admin-form"><div class="admin-card-heading"><h2>Penawaran dan progres</h2></div><div class="form-row form-row-three"><div><label>Harga</label><input value="500000"></div><div><label>Tenggat</label><input type="date"></div><div><label>Revisi</label><select><option>2 kali</option></select></div></div><input type="file"><button class="button button-small">Simpan progres pekerjaan</button></form><section class="admin-card assistant-panel"><details class="assistant-manual" open><summary>Pakai akun ChatGPT secara manual</summary><div class="assistant-manual-body"><textarea>Prompt panjang untuk ChatGPT</textarea><div class="assistant-manual-actions"><button class="button button-small">Salin prompt</button><a class="button button-ghost button-small">Buka ChatGPT</a></div></div></details></section>');
    const sidebar = document.querySelector('.admin-sidebar');
    const nav = sidebar.querySelector('nav');
    const jump = document.querySelector('.mobile-admin-jump');
    const stats = document.querySelector('.admin-stats');
    const offenders = [...document.querySelectorAll('.admin-page *')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -0.5 || rect.right > innerWidth + 0.5;
    }).slice(0, 6).map((element) => ({ tag: element.tagName, className: element.className, rect: element.getBoundingClientRect().toJSON() }));
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, sidebar: getComputedStyle(sidebar).position, nav: getComputedStyle(nav).position, jump: getComputedStyle(jump).display, stats: getComputedStyle(stats).display, paymentSummary: getComputedStyle(document.querySelector('.payment-queue-summary')).display, offenders };
  })()`)
    if (layout.scrollWidth > width || layout.sidebar !== "sticky" || layout.nav !== "fixed" || layout.jump !== "flex" || layout.stats !== "grid" || layout.paymentSummary !== "grid" || layout.offenders.length) {
      throw new Error("Layout admin mobile tidak aktif: " + JSON.stringify(layout))
    }
    adminMobile.push(layout)
  }
  if (browserErrors.length) throw new Error("Error JavaScript browser: " + browserErrors.join("\n"))

  console.log(JSON.stringify({ api: { unknown: unknownApi.status, invalidJson: invalidJson.status }, desktop, mobile, menu, keyboard, customerGuard, adminGuard, formLayouts, adminMobile, browserErrors }, null, 2))
} finally {
  socket.close()
  await stopProcess(chrome)
  await stopProcess(appServer)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { rmSync(profile, { recursive: true, force: true }); break } catch (error) {
      if (attempt === 4) console.warn("Profil browser sementara belum dapat dihapus:", error.message)
      await wait(200)
    }
  }
}
