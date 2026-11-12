import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// og.png（1200x630）: 遊んでいる場面＋題名。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 6615
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__sbReady); await p.waitForTimeout(500)
await p.click('#bStart')
await p.evaluate(() => { sb.dbg.pause(); sb.dbg.seed(11); sb.start(); sb.dbg.pause(); const bot = sb.makeBot({ lag: 0.3, err: 8, dist: 110, vmax: 90, shoo: true }); let f = 0; while (f++ < 60 * 9) { bot(1 / 60); sb.dbg.tick(1) } bot(1/60); f = 0; while (f++ < 60 * 40 && sb.G.orders < 6) { bot(1 / 60); sb.dbg.tick(1) } let g = 0; while (g++ < 60 * 6 && sb.G.phase !== 'fly') sb.dbg.tick(1); for (let i = 0; i < 200; i++) { bot(1 / 60); sb.dbg.tick(1) } document.querySelector('#hud').style.display = 'none'; document.querySelector('#tut').style.display = 'none'; document.querySelector('#pop').style.display = 'none'; const lb = sb.live(); if (lb[0]) sb.G.ptr = { x: Math.min(...lb.map(b => b.x)) + 40, y: Math.min(...lb.map(b => b.y)) - 115 }; sb.dbg.render() })
const shot = (await p.screenshot()).toString('base64')
const font = 'https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@500&display=swap'
const q = await b.newPage({ viewport: { width: 1200, height: 630 } })
await q.setContent(`<html><head><link href="${font}" rel="stylesheet"><style>
body{margin:0;width:1200px;height:630px;background:#cfe9e6;font-family:"Kiwi Maru",serif;color:#3b2a20;overflow:hidden;position:relative}
img{position:absolute;left:60px;top:-120px;width:420px;transform:rotate(-3deg);border:6px solid #3b2a20;box-shadow:10px 12px 0 rgba(59,42,32,.2)}
.t{position:absolute;left:540px;top:120px}
.s1{font-size:48px;color:#7a6656}.s2{font-size:104px;line-height:1.1}.s3{font-size:104px;color:#f27c5c;line-height:1.1;margin-left:150px}
.sub{position:absolute;left:546px;top:470px;font-size:34px;background:#fffaf0;padding:8px 18px;border:3px solid #3b2a20;transform:rotate(-1deg)}
</style></head><body><img src="data:image/png;base64,${shot}"><div class="t"><div class="s1">うちわで</div><div class="s2">シャボン玉</div><div class="s3">配達</div></div><div class="sub">近すぎると、割れる。</div></body></html>`)
await q.waitForTimeout(1200)
await q.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
