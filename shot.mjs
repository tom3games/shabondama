import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 台本で撮る: node shot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 6611
mkdirSync(ROOT + '/shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__sbReady, null, { timeout: 15000 }); await p.waitForTimeout(600)
await p.screenshot({ path: ROOT + '/shots/s-title.png' })
await p.click('#bStart'); await p.evaluate(() => { sb.dbg.pause(); sb.dbg.seed(11); sb.start(); sb.dbg.pause(); sb.dbg.step(30) })
await p.screenshot({ path: ROOT + '/shots/s-blow.png' })
const r = await p.evaluate(() => { const bot = sb.makeBot({ lag: 0.3, err: 8, dist: 110, vmax: 90, shoo: true }); let f = 0; const snaps = []; while (sb.G.scene === 'play' && f++ < 60 * 240) { bot(1 / 60); sb.dbg.tick(1); if (f === 60 * 4 || f === 60 * 40) snaps.push(f) } return { ...sb.state(), res: sb.result() } })
console.log(JSON.stringify(r))
await p.evaluate(() => { sb.dbg.seed(11); sb.start(); sb.dbg.pause(); const bot = sb.makeBot({ lag: 0.3, err: 8, dist: 110, vmax: 90, shoo: true }); let f = 0; while (f++ < 60 * 9) { bot(1 / 60); sb.dbg.tick(1) } sb.dbg.render() })
await p.screenshot({ path: ROOT + '/shots/s-fly.png' })
await p.evaluate(() => { const bot = sb.makeBot({ lag: 0.3, err: 8, dist: 110, vmax: 90, shoo: true }); let f = 0; while (f++ < 60 * 40 && sb.G.orders < 6) { bot(1 / 60); sb.dbg.tick(1) } let g = 0; while (g++ < 60 * 6 && sb.G.phase !== 'fly') sb.dbg.tick(1); for (let i = 0; i < 200; i++) { bot(1 / 60); sb.dbg.tick(1) } sb.dbg.render() })
await p.screenshot({ path: ROOT + '/shots/s-fly2.png' })
await p.evaluate(() => { sb.dbg.finish(); sb.dbg.tick(200) }); await p.waitForTimeout(800)
await p.screenshot({ path: ROOT + '/shots/s-end.png' })
console.log('errs', errs)
await b.close(); server.kill()
