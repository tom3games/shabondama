import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// うちわでシャボン玉配達の検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = +(process.env.VPORT || 6614)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__sbReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#bub,#pop')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) canvas,main:not([hidden]) a,.ovl:not([hidden]) button,#tmSupport,#tmHome')) { if (!el.offsetParent && el.id !== 'tmSupport') continue; const r = el.getBoundingClientRect(); if (!r.height) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const SIZES = [[360, 640, 'small'], [375, 667, 'se'], [390, 844, 'phone'], [412, 915, 'android'], [430, 932, 'max'], [768, 1024, 'tablet']]
const HUMAN = "{ lag: 0.5, err: 16, dist: 115, vmax: 85, shoo: true, avoid: true, spd: 650 }"

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('ロード画面が消えて、タイトルの絵が描けている', async () => {
  await p.waitForTimeout(500)
  const r = await p.evaluate(() => ({ load: getComputedStyle(document.querySelector('#loading')).display, title: document.querySelector('#tH').textContent }))
  const v = await variance(p, '#tArt')
  expect(r.load === 'none' && r.title.includes('シャボン玉') && v > 200, JSON.stringify({ ...r, v })); return { v }
})
await t('はじめると遊ぶ画面・音を鳴らす呼び出しがある・それでも実際は無音', async () => {
  await p.click('#bStart'); await p.waitForTimeout(300)
  const r = await p.evaluate(() => ({ scene: sb.state().scene, loops: Snd.played['loop:bgm'] || 0, click: Snd.played.click || 0, mute: window.__muteOk() }))
  expect(r.scene === 'play' && r.click >= 1 && r.mute, JSON.stringify(r)); return r
})
await t('固定60Hz: 実時間1秒でゲーム時間も約1秒', async () => {
  const r = await p.evaluate(async () => { sb.dbg.pause(false); const t0 = sb.G.t, p0 = performance.now(); await new Promise(r => setTimeout(r, 1500)); return { dg: sb.G.t - t0, dr: (performance.now() - p0) / 1000 } })
  const k = r.dg / r.dr
  expect(k > 0.9 && k < 1.05, JSON.stringify(r)); return { ratio: +k.toFixed(3) }
})
// 本物の指: 玉の下に置くと上へ、左に置くと右へ
await t('本物の指（マウス）: 玉の下に置くと上がり、左に置くと右へ行く', async () => {
  await p.evaluate(() => { sb.dbg.seed(3); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); sb.G.order.y = 5000 })
  const b0 = await p.evaluate(() => sb.bubbleXY())
  await p.mouse.move(b0.x, b0.y + 150 * b0.S); await p.mouse.down()
  await p.evaluate(() => sb.dbg.tick(45))
  const a = await p.evaluate(() => sb.live()[0] && { y: sb.live()[0].y, x: sb.live()[0].x, misses: sb.G.misses })
  await p.mouse.up()
  const b1 = await p.evaluate(() => sb.bubbleXY())
  await p.mouse.move(b1.x - 150 * b1.S, b1.y); await p.mouse.down()
  const x0 = await p.evaluate(() => sb.live()[0].x)
  await p.evaluate(() => sb.dbg.tick(40))
  const x1 = await p.evaluate(() => sb.live()[0] && sb.live()[0].x)
  await p.mouse.up()
  expect(a && a.y > 140 && a.misses === 0 && x1 - x0 > 25, JSON.stringify({ a, x0, x1 })); return { y: Math.round(a.y), dx: Math.round(x1 - x0) }
})
await t('うちわを玉にくっつけると割れる（うちわが当たった）', async () => {
  await p.evaluate(() => { sb.dbg.seed(4); sb.start(); sb.dbg.pause(); sb.dbg.toFly() })
  const b0 = await p.evaluate(() => sb.bubbleXY())
  await p.mouse.move(b0.x, b0.y + 20); await p.mouse.down()
  await p.evaluate(() => sb.dbg.tick(2)); await p.mouse.up()
  const r = await p.evaluate(() => ({ ...sb.state(), pop: document.querySelector('#pop').textContent }))
  expect(r.misses === 1 && r.lastPop.why === 'fan' && r.pop === 'うちわが当たった', JSON.stringify(r)); return r.pop
})
await t('何もしないと玉は地面に落ちて割れる', async () => {
  const r = await p.evaluate(() => { sb.dbg.seed(5); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); let f = 0; while (sb.G.misses === 0 && f++ < 60 * 30) sb.dbg.tick(1); return { ...sb.state(), sec: f / 60 } })
  expect(r.misses === 1 && r.lastPop.why === 'ground' && r.sec < 15, JSON.stringify(r)); return { sec: +r.sec.toFixed(1) }
})
await t('速くても窓をすり抜けない（前のコマとの線分で判定）', async () => {
  const r = await p.evaluate(() => { sb.dbg.seed(6); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); const o = sb.G.order, b = sb.live()[0]; b.x = o.x; b.y = o.y - 80; b.vy = 9000; b.vx = 0; sb.dbg.tick(1); return sb.state() })
  expect(r.n === 1 && r.misses === 0, JSON.stringify(r)); return { n: r.n }
})
await t('届けると窓の人がひとこと言い、次の注文が来る', async () => {
  const r = await p.evaluate(() => { sb.dbg.seed(7); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); sb.dbg.deliver(); sb.dbg.step(2); const said = sb.state().bub; const o1 = sb.G.orders; sb.dbg.tick(200); return { said, n: sb.G.n, o1, o2: sb.G.orders, bubOn: document.querySelector('#bub').textContent } })
  expect(r.n === 1 && r.said && r.o2 === r.o1 + 1, JSON.stringify(r)); return r.said
})
await t('2個割ると結果の伝票が出る（称号・ボタン・支援リンク）', async () => {
  await p.evaluate(() => { sb.dbg.seed(8); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); for (let i = 0; i < 4; i++) { sb.dbg.deliver(); sb.dbg.tick(200) } sb.dbg.finish(); sb.dbg.tick(200) })
  const r = await p.evaluate(() => ({ s: sb.state(), res: sb.result(), btn: document.querySelector('#bAgain').textContent, sup: !!document.querySelector('#tmSupport') }))
  const v = await variance(p, '#res')
  await p.waitForTimeout(700); await p.screenshot({ path: `${ROOT}/shots/v-end.png` })
  expect(r.s.scene === 'end' && r.res.n === 4 && r.res.rank === '団地の配達員' && r.btn === 'もう一回' && r.sup && v > 300, JSON.stringify({ ...r, v })); return { n: r.res.n, rank: r.res.rank, v }
})
await t('自己ベストが残り、タイトルに出る', async () => {
  const r = await p.evaluate(() => { const ls = localStorage.getItem('sb_best'); return { ls } })
  expect(r.ls === '4', JSON.stringify(r)); return r
})
await t('もう一回で最初から（0件・ミス0）', async () => {
  await p.click('#bAgain'); await p.waitForTimeout(200)
  const r = await p.evaluate(() => sb.state())
  expect(r.scene === 'play' && r.n === 0 && r.misses === 0 && r.orders === 1, JSON.stringify(r)); return r.phase
})
await t('何もしない通しは最低の称号（全部わった人）', async () => {
  const rs = await p.evaluate(() => { const out = []; for (let s = 1; s <= 6; s++) { sb.dbg.seed(s * 31); sb.start(); sb.dbg.pause(); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 120) sb.dbg.tick(1); out.push({ n: sb.G.n, rank: sb.rankOf(sb.G.n).ja, scene: sb.G.scene }) } return out })
  expect(rs.every(r => r.rank === '全部わった人' && r.scene === 'end'), JSON.stringify(rs)); return rs.map(r => r.n).join(',')
})
await t('同じ種と同じ操作なら同じ結果（3回）', async () => {
  const rs = await p.evaluate((H) => { const out = []; for (let i = 0; i < 3; i++) { sb.dbg.seed(4242); sb.start(); sb.dbg.pause(); let r0 = 9; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); sb.dbg.tick(1) } out.push(sb.G.n + '/' + sb.G.t.toFixed(2) + '/' + sb.G.lastPop.why) } return out }, HUMAN)
  expect(rs[0] === rs[1] && rs[1] === rs[2] && +rs[0].split('/')[0] > 0, JSON.stringify(rs)); return rs[0]
})
await t('人の速さの bot は最初の1件を届けられる（12回中10回以上）', async () => {
  const rs = await p.evaluate((H) => { const out = []; for (let s = 1; s <= 12; s++) { sb.dbg.seed(s * 77 + 1); sb.start(); sb.dbg.pause(); let r0 = s * 99 + 5; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (sb.G.scene === 'play' && sb.G.n === 0 && sb.G.misses === 0 && f++ < 60 * 60) { bot(1 / 60); sb.dbg.tick(1) } out.push(sb.G.n > 0) } return out }, HUMAN)
  expect(rs.filter(Boolean).length >= 10, JSON.stringify(rs)); return rs.filter(Boolean).length
})
await t('上手い操作（遠くから弱く）が、近くで強くあおぐより届ける', async () => {
  const r = await p.evaluate((H) => { const run = cfg => { let sum = 0; for (let s = 1; s <= 8; s++) { sb.dbg.seed(s * 53 + 3); sb.start(); sb.dbg.pause(); let r0 = s * 7 + 1; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(cfg, Rb); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); sb.dbg.tick(1) } sum += sb.G.n } return sum / 8 }; return { good: run(eval('(' + H + ')')), close: run({ lag: 0.3, err: 10, near: 80, spd: 900 }) } }, HUMAN)
  expect(r.good >= 2 && r.close < 0.5, JSON.stringify(r)); return r
})
await t('文字は同時に1つまで（吹き出しと大きい文字が重ならない）', async () => {
  const r = await p.evaluate((H) => { sb.dbg.seed(5); sb.start(); sb.dbg.pause(); let r0 = 7; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(eval('(' + H + ')'), Rb); let both = 0, bubs = 0, f = 0; while (sb.G.scene === 'play' && f++ < 60 * 300) { bot(1 / 60); sb.dbg.tick(1); if (f % 6 === 0) { sb.dbg.render(); const b = document.querySelector('#bub').classList.contains('on'), pp = sb.G.t < sb.G.popUntil; if (b) bubs++; if (b && pp) both++ } } return { both, bubs } }, HUMAN)
  expect(r.both === 0 && r.bubs > 5, JSON.stringify(r)); return r
})
await t('ハト追い払い・猫追い払い・くしゃみ・2つ同時・大玉が通しの中で起きる', async () => {
  const r = await p.evaluate((H) => { const seen = { shoo: 0, cat: 0, sneeze: 0, twin: 0, giant: 0 }; for (let s = 1; s <= 8; s++) { sb.dbg.seed(s * 13); sb.start(); sb.dbg.pause(); let r0 = s; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); sb.dbg.tick(1) } const g = sb.G; seen.shoo += g.shoos; seen.cat += g.catShoos; seen.sneeze += g.sneezes; seen.twin += g.twins; seen.giant += g.giants } return seen }, HUMAN)
  expect(Object.values(r).every(v => v > 0), JSON.stringify(r)); return r
})
await t('ページを離れたら BGM と環境音が止まる', async () => {
  const r = await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return { away: Snd.away, playing: Snd.playing().length, hide: Snd.life.hide } })
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }) })
  expect(r.away && r.playing === 0 && r.hide >= 1, JSON.stringify(r)); return r
})
await t('英語に切り替えると文言が英語・結果も英語', async () => {
  const q = await open(browser)
  await q.click('#bLang')
  const a = await q.evaluate(() => ({ h: document.querySelector('#tH').textContent, b: document.querySelector('#bStartT').textContent }))
  await q.click('#bStart'); await q.evaluate(() => { sb.dbg.pause(); sb.dbg.toFly(); sb.dbg.deliver(); sb.dbg.tick(200); sb.dbg.finish(); sb.dbg.tick(200) })
  const r = await q.evaluate(() => ({ rank: sb.result().rank, again: document.querySelector('#bAgain').textContent }))
  await q.waitForTimeout(700); await q.screenshot({ path: `${ROOT}/shots/v-end-en.png` })
  await q.close()
  expect(a.h.includes('Bubble') && a.b === 'Fan it' && r.rank === 'Neighborhood rookie' && r.again === 'Again', JSON.stringify({ a, r })); return { a, r }
})
await t('遊び方が開いて閉じる', async () => {
  const q = await open(browser)
  await q.click('#bHow'); const a = await q.evaluate(() => !document.querySelector('#how').hidden && document.querySelectorAll('#howBody li').length)
  await q.click('#howClose'); const b = await q.evaluate(() => document.querySelector('#how').hidden)
  await q.close(); expect(a === 4 && b, JSON.stringify({ a, b }))
})
await t('X 内ブラウザ（?inapp=x）: 下52pxに操作が入らない', async () => {
  const q = await open(browser)
  await q.goto(URL0 + '?inapp=x'); await q.waitForFunction(() => window.__sbReady)
  const r = await q.evaluate(() => { const H = innerHeight, bad = []; for (const el of document.querySelectorAll('#vTitle button')) { const b = el.getBoundingClientRect(); if (b.height && b.bottom > H - 52) bad.push(el.id + ':' + Math.round(b.bottom)) } return { H, bad, cls: document.documentElement.className } })
  await q.close(); expect(!r.bad.length && /inapp-x/.test(r.cls), JSON.stringify(r)); return r
})
await t('全体でエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  await q.waitForTimeout(600); views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.click('#howClose')
  await q.click('#bStart'); await q.evaluate(() => { sb.dbg.pause(); sb.dbg.seed(9); sb.start(); sb.dbg.pause(); sb.dbg.toFly(); sb.dbg.step(30) })
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => { for (let i = 0; i < 6; i++) { sb.dbg.deliver(); sb.dbg.tick(200) } sb.dbg.finish(); sb.dbg.tick(200) })
  await q.waitForTimeout(700)
  views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()
// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて bot で通し、結果まで行ける・無音', async () => {
  await wp.tap('#bStart'); await wp.waitForTimeout(300)
  const r = await wp.evaluate((H) => { sb.dbg.pause(); sb.dbg.seed(3); sb.start(); sb.dbg.pause(); let r0 = 3; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = sb.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (sb.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); sb.dbg.tick(1) } return { scene: sb.G.scene, n: sb.G.n, mute: window.__muteOk() } }, HUMAN)
  await wp.waitForTimeout(700); await wp.screenshot({ path: `${ROOT}/shots/v-webkit-end.png` })
  expect(r.scene === 'end' && r.n > 0 && r.mute, JSON.stringify(r)); return r
})
await t('WebKit: 本物のタッチで玉が動く', async () => {
  await wp.evaluate(() => { sb.start(); sb.dbg.pause(); sb.dbg.toFly(); sb.G.order.y = 5000 })
  const b0 = await wp.evaluate(() => sb.bubbleXY())
  const cdp = null
  await wp.evaluate(({ x, y }) => { const cv = document.querySelector('#cv'); cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 3, pointerType: 'touch' })) }, { x: b0.x, y: b0.y + 140 * b0.S })
  await wp.evaluate(() => sb.dbg.tick(45))
  const y = await wp.evaluate(() => sb.live()[0] && sb.live()[0].y)
  expect(y > 140, String(y)); return Math.round(y)
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
