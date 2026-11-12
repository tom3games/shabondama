import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 遊び方ごとの分布: node sim.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 6612
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__sbReady)
const BOTS = {
  idle: null,
  human: { lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: true, avoid: true, spd: 650 },
  humanNoAvoid: { lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: true, spd: 650 },
  humanNoShoo: { lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: false, avoid: true, spd: 650 },
  expert: { lag: 0.25, err: 6, dist: 140, vmax: 95, maxK: 0.45, shoo: true, avoid: true, spd: 900 },
  close: { lag: 0.3, err: 10, near: 80, spd: 900 },
  rush: { lag: 0.3, err: 10, dist: 80, vmax: 200, shoo: false, spd: 900 },
}
const out = {}
for (const [name, cfg] of Object.entries(BOTS)) {
  out[name] = await p.evaluate(([cfg]) => {
    const rs = []
    for (let s = 1; s <= 12; s++) {
      sb.dbg.seed(s * 101 + 7); sb.start(); sb.dbg.pause()
      let r0 = s * 13 + 1; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647
      const bot = cfg ? sb.makeBot(cfg, Rb) : null
      let f = 0, first = null
      while (sb.G.scene === 'play' && f++ < 60 * 600) { if (bot) bot(1 / 60); sb.dbg.tick(1); if (first === null && (sb.G.n > 0 || sb.G.misses > 0)) first = sb.G.n > 0 }
      const res = sb.G.result || {}
      rs.push({ n: sb.G.n, t: Math.round(sb.G.t), first, why: sb.G.lastPop && sb.G.lastPop.why, shoos: res.shoos, cat: res.catShoos, sn: res.sneezes, tw: res.twins, gi: res.giants })
    }
    const ns = rs.map(r => r.n).sort((a, b) => a - b)
    const whys = {}; for (const r of rs) whys[r.why] = (whys[r.why] || 0) + 1
    return { mean: +(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1), med: ns[6], ns: ns.join(','), firstOk: rs.filter(r => r.first).length, tMean: Math.round(rs.reduce((a, r) => a + r.t, 0) / rs.length), whys, shoos: rs.reduce((a, r) => a + (r.shoos || 0), 0), cat: rs.reduce((a, r) => a + (r.cat || 0), 0), sn: rs.reduce((a, r) => a + (r.sn || 0), 0), tw: rs.reduce((a, r) => a + (r.tw || 0), 0), gi: rs.reduce((a, r) => a + (r.gi || 0), 0) }
  }, [cfg])
  console.log(name.padEnd(12), JSON.stringify(out[name]))
}
await b.close(); server.kill()
