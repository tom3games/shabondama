import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// shabondama __sb を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/shabondama/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  // 横丁に登録する前は github.io から横丁へ転送されて 404 になるので、確認の時だけ転送の script を外す
  await p.route(/tom3games\.github\.io\/shabondama\/(\?.*)?$/, async r => { const res = await r.fetch(); const body = (await res.text()).replace(/<script id="ghMove">.*?<\/script>/, ''); await r.fulfill({ response: res, body }) })
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__sbReady, null, { timeout: 15000 })
  await p.waitForTimeout(500)
  if (name === 'webkit') await p.tap('#bStart'); else await p.click('#bStart')
  const r = await p.evaluate(() => { sb.dbg.pause(); sb.dbg.seed(3); sb.start(); sb.dbg.pause(); const bot = sb.makeBot({ lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: true, avoid: true, spd: 650 }); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); sb.dbg.tick(1) } return { scene: sb.G.scene, n: sb.G.n, mute: window.__muteOk ? window.__muteOk() : 'n/a' } })
  await p.waitForTimeout(800)
  out.push(`${name}: play=${JSON.stringify(r)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch('og.png?v=1'); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/shabondama', 'https://github.com/tom3games/shabondama/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
