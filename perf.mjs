import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// スマホ相当（CPU 4倍遅）で遊んでいる間の fps。node perf.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 6616, NS = process.env.NS || 'sb', READY = process.env.READY || '__sbReady'
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(r => window[r], READY)
const blank = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2) }; requestAnimationFrame(f) }))
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await p.tap('#bStart'); await p.waitForTimeout(300)
const r = await p.evaluate(ns => new Promise(res => {
  const g = window[ns]; const bot = g.makeBot(window.PERF_BOT || { lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: true, avoid: true, spd: 650 })
  const iv = setInterval(() => bot(1 / 30), 33)
  setTimeout(() => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++; if (now - t0 < 4000) requestAnimationFrame(f); else { clearInterval(iv); res({ fps: +(n / 4).toFixed(1), worstMs: Math.round(worst) }) } }; requestAnimationFrame(f) }, 2500)
}), NS)
console.log(JSON.stringify({ blankFps: blank, cpu4x: r }))
await b.close(); server.kill()
