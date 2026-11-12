// うちわでシャボン玉配達（shabondama）。指を置いた所にうちわ。玉はうちわから遠ざかる。団地の光る窓まで届ける
// 仕様の正本: ~/Desktop/claudecode/ideas/shabondama.md
;(() => {
'use strict'
window.__jsUp = true
const D = SB_DATA, A = SB_ATLAS
const $ = s => document.querySelector(s)
const on = (s, f) => $(s).addEventListener('click', f)
const isJa = () => (navigator.language || 'ja').toLowerCase().startsWith('ja')
let lang = 'ja'
try { lang = localStorage.getItem('sb_lang') || (isJa() ? 'ja' : 'en') } catch (e) { lang = isJa() ? 'ja' : 'en' }
const T = () => D.TXT[lang]

// ---- 乱数（種を固定できる） ----
let seedV = (Date.now() % 2147483646) + 1, runSeed = seedV
const R = () => (seedV = seedV * 16807 % 2147483647) / 2147483647
const rr = (a, b) => a + (b - a) * R()
const pick = a => a[Math.floor(R() * a.length)]
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
// 窓ごとの飾り（描く順番で乱数を食わないよう、種と場所から決める）
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }

// ---- 音（録音素材） ----
Snd.def({
  pop: ['snd/pop1.mp3', 'snd/pop2.mp3', 'snd/pop3.mp3'], fan: ['snd/fan1.mp3', 'snd/fan2.mp3', 'snd/fan3.mp3'],
  sneeze: 'snd/sneeze.mp3', flap: 'snd/flap.mp3', mew: 'snd/mew.mp3', ding: 'snd/ding.mp3', coin: 'snd/coin.mp3',
  jgood: 'snd/jgood.mp3', jmeh: 'snd/jmeh.mp3', jover: 'snd/jover.mp3', jrare: 'snd/jrare.mp3', click: 'snd/click.mp3', window: 'snd/window.mp3',
})
const LOOPS = { bgm: 'snd/bgm_play.mp3', city: 'snd/amb_city.mp3', wind: 'snd/amb_wind.mp3' }
let muted = false
try { muted = localStorage.getItem('sb_mute') === '1' } catch (e) {}
Snd.setMute(muted)
const sfx = (n, o) => Snd.play(n, o)
function loopVol(slot, v, tc = 0.2) { const l = Snd.loops[slot]; if (l && l.g && Snd.ctx) { l.g.gain.cancelScheduledValues(Snd.ctx.currentTime); l.g.gain.setTargetAtTime(Math.max(0.0001, v), Snd.ctx.currentTime, tc) } }
const loopsOn = {}
function loop(slot, vol) { if (vol == null) { if (loopsOn[slot]) { Snd.loop(slot, null); loopsOn[slot] = 0 } return } if (!loopsOn[slot]) { Snd.loop(slot, LOOPS[slot], vol); loopsOn[slot] = 1 } else loopVol(slot, vol) }
function allLoopsOff() { for (const k in loopsOn) loop(k, null) }

// ---- 絵 ----
const IMG = new Image()
let imgOk = false
const fr = n => A.f[n]
const aspect = n => fr(n)[3] / fr(n)[2]
// anchor: bottom（足元）/ mid / top
function spr(c, name, x, y, w, rot = 0, o = {}) {
  if (!imgOk || !fr(name)) return
  const f = fr(name), h = w * f[3] / f[2]
  c.save(); c.translate(x, y); if (rot) c.rotate(rot)
  if (o.flip) c.scale(-1, 1)
  if (o.sx || o.sy) c.scale(o.sx || 1, o.sy || 1)
  if (o.alpha != null) c.globalAlpha *= o.alpha
  const top = o.anchor === 'top' ? 0 : o.anchor === 'mid' ? -h / 2 : -h
  c.drawImage(IMG, f[0], f[1], f[2], f[3], -w / 2, top, w, h)
  c.restore()
}

// ---- 調整値（sim で決めた値） ----
const TUNE = { g: 40, drag: 2.2, fanK: 700, fanNear: 60, fanFar: 320, fanPow: 1.6, wobMax: 620, wobV: 1.0, hitFan: 44, life0: 40, birdK: 0.6 }
const FH = D.FH, WALL = 182, WX = 92, WIN_W = 104, WIN_H = 92

// ---- 画面 ----
const cv = $('#cv')
const cx = cv.getContext('2d')
let W = 390, H = 844, DPR = 1, S = 1
function resize() {
  const r = cv.getBoundingClientRect()
  W = r.width || 390; H = r.height || 844
  DPR = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
  S = W / 390
}
addEventListener('resize', () => { resize(); sizeTitleArt() })
const VH = () => H / S
const sx = wx => W / 2 + wx * S
const sy = wy => H - (wy - G.camY) * S

// ---- 状態 ----
const G = window.__sbG = { scene: 'title', phase: 'title', t: 0, paused: false, camY: -60 }
function reset() {
  Object.assign(G, {
    phase: 'blow', t: 0, phT: 0, camY: -60, n: 0, misses: 0, pops: 0, bubbles: [], birds: [], fx: [], ptr: null, fanT: 0, fanOn: 0,
    order: null, orders: 0, nextBird: 6, lastDel: null, lastPop: null, kid: 'kid', kidT: 0, popUntil: 0, bubUntil: 0, bub: null,
    cats: {}, sneez: {}, shoos: 0, catShoos: 0, sneezes: 0, twins: 0, giants: 0, fanned: 0, result: null, delivered: [], tutDone: false,
  })
  runSeed = seedV
  newOrder()
}

// ---- 窓と飾り ----
const winX = side => side * WX
const winY = k => k * FH + 20
// 飾り: none / flower / cactus / shirt / cat / sneezer。1〜2階は何も置かない
function deco(k, side) {
  if (k < 1) return 'none'
  const u = hash(runSeed, k, side + 7)
  if (k <= 2) return u < 0.25 ? 'flower' : 'none'
  const w = [['none', Math.max(22, 56 - k * 2.5)], ['flower', 12], ['cactus', 15], ['shirt', 11], ['cat', k >= 3 ? 11 : 0], ['sneezer', k >= 4 ? 9 : 0]]
  let s = 0; for (const x of w) s += x[1]
  let v = u * s; for (const x of w) { if ((v -= x[1]) < 0) return x[0] }
  return 'none'
}
// 室外機（窓の間の柱）。3階から
function acOf(k) { if (k < 3) return 0; const u = hash(runSeed, k, 99); return u < 0.3 ? (u < 0.15 ? -1 : 1) : 0 }
const decoSide = (k, side) => hash(runSeed, k, side + 31) < 0.5 ? -1 : 1
const isTarget = (k, side) => G.order && G.order.k === k && G.order.side === side
const decoAt = (k, side) => isTarget(k, side) ? 'none' : deco(k, side)

// ---- 注文 ----
const ITEM_KEYS = ['ham', 'teeth', 'fish', 'oji', 'chick']
function newOrder() {
  const n = G.orders
  let item = pick(ITEM_KEYS.filter(k => !G.order || k !== G.order.item))
  const giant = n >= 2 && R() < 0.12
  if (giant) item = 'wig'
  const twin = !giant && n >= 3 && R() < (n >= 6 ? 0.55 : 0.35)
  let k = clamp(2 + Math.floor(n * 0.55 + R() * 1.4), 2, 15)
  if (n === 0) k = 2
  let side = R() < 0.5 ? -1 : 1
  if (n === 0) side = 1
  // 狙う窓に危ない飾りがあれば反対側へ
  if (['cactus', 'cat', 'sneezer'].includes(deco(k, side))) side = -side
  G.order = { item, k, side, twin, giant, x: winX(side), y: winY(k), who: D.ITEMS[item].who }
  G.orders++
  G.phase = 'blow'; G.phT = 0
  G.kid = 'kid'
}
function spawnBubbles() {
  const o = G.order, it = o.item
  const mk = (dx, item) => ({ id: Math.random(), x: 18 + dx, y: 96, vx: dx * 0.6, vy: 14, r: o.giant ? 44 : 27, item, life: o.giant ? TUNE.life0 * 0.8 : TUNE.life0, maxLife: o.giant ? TUNE.life0 * 0.8 : TUNE.life0, wob: 0, ax: 0, ay: 0, alive: true, giant: o.giant, ph: R() * 6 })
  if (o.twin) { const it2 = pick(ITEM_KEYS.filter(k => k !== it)); G.bubbles = [mk(-26, it), mk(26, it2)]; G.twins++ }
  else G.bubbles = [mk(0, it)]
  if (o.giant) G.giants++
  sfx('fan', { vol: 0.25, rate: 1.3 })
  pop(T().order(o.k + 1, o.twin ? T().twin : D.ITEMS[it][lang] + (o.giant ? '' : '')), false, 1.7)
}
const live = () => G.bubbles.filter(b => b.alive)

// ---- ことば（同時に1つだけ） ----
function say(text, wx, wy, sec = 1.6) {
  G.bub = { text, wx, wy }; G.bubUntil = G.t + Math.max(sec, 0.9 + text.length * 0.09)
  G.popUntil = Math.min(G.popUntil, G.t)
  $('#pop').className = ''
}
function pop(text, bad, sec = 1.5) {
  const el = $('#pop'); el.textContent = text; el.className = ''; void el.offsetWidth; el.className = 'on' + (bad ? ' bad' : '')
  G.popUntil = G.t + sec; G.bubUntil = Math.min(G.bubUntil, G.t)
}

// ---- 割れる・届く ----
function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = R() * 6.283, s = rr(40, 160); G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.3, 0.7), t: 0, col, sz: rr(2, 5) }) } }
function popBubble(b, why) {
  if (!b.alive) return
  b.alive = false; G.pops++; G.misses++
  G.lastPop = { item: b.item, why }
  sfx('pop', { vol: 0.9 })
  burst(b.x, b.y, 14, 'rgba(160,220,225,.9)')
  // 中身は落ちる
  G.fx.push({ kind: 'item', f: D.ITEMS[b.item].f, x: b.x, y: b.y, vx: b.vx * 0.3, vy: 40, rot: 0, vr: rr(-3, 3), w: b.r * 1.1, t: 0, life: 9 })
  pop(T().popWhy[why] || T().pop, true, 1.5)
  G.kid = 'kid_cry'; G.kidT = G.t
  drawMisses()
  if (G.misses >= D.MISSES) { G.phase = 'over'; G.phT = 0; sfx('jover', { vol: 0.5, delay: 0.5 }) }
  checkDone()
}
function deliver(b) {
  b.alive = false
  const it = D.ITEMS[b.item], pts = b.giant ? 3 : 1
  G.n += pts
  const line = pick(it.say[lang])
  G.lastDel = { item: b.item, who: it.who, line, lineIdx: it.say[lang].indexOf(line) }
  G.delivered.push(b.item)
  sfx('ding', { vol: 0.7 }); sfx('coin', { vol: 0.5, delay: 0.15 }); if (b.giant) sfx('jrare', { vol: 0.5, delay: 0.3 })
  burst(b.x, b.y, 10, 'rgba(255,240,180,.95)')
  G.kid = 'kid_joy'; G.kidT = G.t
  say(line, G.order.x, G.order.y + 60, 1.8)
  score()
  if (!G.tutDone) { G.tutDone = true; hideTut() }
  checkDone()
}
function checkDone() {
  if (G.phase !== 'fly') return
  if (live().length === 0 && G.phase !== 'over') { G.phase = 'next'; G.phT = 0 }
}
function score() { $('#hN').innerHTML = `${G.n}<small>${T().unit}</small>` }
const RING = (ok) => `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="${ok ? 'rgba(207,233,230,.6)' : 'none'}" stroke="${ok ? '#4fb3b5' : '#f27c5c'}" stroke-width="2.2" ${ok ? '' : 'stroke-dasharray="4 3"'}/>${ok ? '<path d="M6.5 7.5a4 4 0 0 1 3-2.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>' : ''}</svg>`
function drawMisses() { $('#hX').innerHTML = Array.from({ length: D.MISSES }, (_, i) => RING(i >= G.misses)).join('') }

// ---- 入力（指を置いた所にうちわ） ----
let ptr = null
function toWorld(e) { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; return { x: (x - W / 2) / S, y: G.camY + (H - y) / S } }
cv.addEventListener('pointerdown', e => {
  if (G.scene !== 'play') return
  e.preventDefault(); ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY }
  try { cv.setPointerCapture(e.pointerId) } catch (er) {}
  G.ptr = toWorld(e); sfx('fan', { vol: 0.35 })
})
cv.addEventListener('pointermove', e => { if (ptr && ptr.id === e.pointerId) { ptr.sx = e.clientX; ptr.sy = e.clientY; G.ptr = toWorld(e) } })
const up = e => { if (ptr && ptr.id === e.pointerId) { ptr = null; G.ptr = null } }
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up)

// うちわの風: 指から遠ざかる向き。近いほど強い
function fanAcc(px, py, fx, fy) {
  const dx = px - fx, dy = py - fy, d = Math.hypot(dx, dy) || 1
  const k = Math.pow(clamp(1 - (d - TUNE.fanNear) / TUNE.fanFar, 0, 1), TUNE.fanPow) * TUNE.fanK
  return { ax: dx / d * k, ay: dy / d * k, d, k }
}

// ---- くしゃみ・猫・ハト ----
function sneezerState(k, side) { const key = k * 3 + side; return G.sneez[key] || (G.sneez[key] = { st: 'idle', t: 0, cd: 0 }) }
function catState(k, side) { const key = k * 3 + side; return G.cats[key] || (G.cats[key] = { st: 'sit', t: 0, gone: 0, blow: 0 }) }
function nearFloors(y) { const k0 = Math.floor((y - 20) / FH); return [k0 - 1, k0, k0 + 1, k0 + 2].filter(k => k >= 1) }
function spawnBird() {
  const lb = live(); if (!lb.length) return
  const b = lb[Math.floor(R() * lb.length)]
  const dir = R() < 0.5 ? 1 : -1
  G.birds.push({ x: -dir * 250, y: b.y + rr(40, 190), vx: dir * rr(55, 85), vy: 0, ph: R() * 6, flee: 0, id: Math.random() })
  sfx('flap', { vol: 0.35 })
}

// ---- 1コマ（固定60Hz） ----
function update(dt) {
  G.t += dt; G.phT += dt
  if (G.scene !== 'play') return
  // 粒
  for (const p of G.fx) {
    p.t += dt
    if (p.kind === 'item') { p.vy -= 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y < 8) { p.y = 8; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.6; p.vr *= 0.5 } }
    else if (p.kind === 'wisp') { p.x += p.vx * dt; p.y += p.vy * dt }
    else if (p.kind === 'feather') { p.vy -= 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98 }
    else { p.vy -= 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt }
  }
  G.fx = G.fx.filter(p => p.t < p.life)

  const lb = live()
  // カメラ: 玉を下から4割に。玉がない時は通りへ戻る
  let camT = -60
  if (G.phase === 'fly' && lb.length) { const y = Math.min(...lb.map(b => b.y)); camT = Math.max(-60, y - VH() * 0.42) }
  else if (G.phase === 'next' && G.phT < 1.2 && G.order) camT = G.camY
  else if (G.phase === 'over') camT = G.camY
  G.camY = lerp(G.camY, camT, 1 - Math.exp(-dt * (G.phase === 'blow' ? 5 : 3.2)))

  if (G.phase === 'blow') {
    // 子どもが吹いている。0.9秒で玉が出る
    if (G.phT > 0.15 && G.kid === 'kid_cry' && G.t - G.kidT > 0.4 && G.lastPop && !G.kidSaid) { G.kidSaid = 1; say(pick(T().kidPop), -10, 150, 1.3) }
    if (G.phT > (G.kidSaid === 1 && G.orders > 1 ? 1.5 : 0.9)) { G.kidSaid = 0; G.kid = 'kid'; spawnBubbles(); G.phase = 'fly'; G.phT = 0 }
    return
  }
  if (G.phase === 'next') { if (G.phT > 1.5) newOrder(); return }
  if (G.phase === 'over') { if (G.phT > 1.8) showEnd(); return }

  // ---- 飛んでいる ----
  const F = G.ptr
  if (F) { G.fanT += dt; G.fanned += dt; if (G.fanT > 0.32) { G.fanT = 0; sfx('fan', { vol: 0.18 }); const lb0 = lb[0]; if (lb0) { const a = Math.atan2(lb0.y - F.y, lb0.x - F.x); G.fx.push({ kind: 'wisp', x: F.x + Math.cos(a) * 30, y: F.y + Math.sin(a) * 30, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, a, t: 0, life: 0.55 }) } } }
  G.fanOn = lerp(G.fanOn, F ? 1 : 0, 1 - Math.exp(-dt * 8))
  loopVol('wind', 0.0001 + G.fanOn * 0.16)

  // ハト
  G.nextBird -= dt
  if (G.orders >= 2 && G.nextBird <= 0) { spawnBird(); G.nextBird = Math.max(3.6, rr(7, 11) - G.orders * 0.25) }
  for (const p of G.birds) {
    p.ph += dt * 9
    let ax = 0, ay = 0
    if (F) { const f = fanAcc(p.x, p.y, F.x, F.y); ax += f.ax * TUNE.birdK; ay += f.ay * TUNE.birdK; if (f.k > 200 && !p.flee) { p.flee = 1; G.shoos++; sfx('flap', { vol: 0.5 }); if (G.t > G.popUntil && G.t > G.bubUntil) say(T().birdShoo, p.x, p.y + 30, 0.9); for (let i = 0; i < 3; i++) G.fx.push({ kind: 'feather', x: p.x, y: p.y, vx: rr(-60, 60), vy: rr(10, 60), t: 0, life: 1.2 }) } }
    if (p.flee) { p.vy += 260 * dt; p.vx *= 1 + dt * 1.5 }
    p.vx += ax * dt; p.vy += ay * dt; p.vy *= 1 - dt * 1.5
    p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.ph) * 12 * dt
  }
  G.birds = G.birds.filter(p => Math.abs(p.x) < 320 && p.y > G.camY - 200 && p.y < G.camY + VH() + 300)

  // 猫とくしゃみ（玉の近くの階だけ）
  const ys = lb.map(b => b.y)
  const floors = new Set(); for (const y of ys) for (const k of nearFloors(y)) floors.add(k)
  for (const k of floors) for (const side of [-1, 1]) {
    const d = decoAt(k, side)
    if (d === 'cat') {
      const c = catState(k, side), ds = decoSide(k, side), px = winX(side) + ds * 34, py = winY(k) - WIN_H / 2 + 22
      c.t += dt
      if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) { c.st = 'sit'; c.t = 0 } continue }
      if (F) { const f = fanAcc(px, py, F.x, F.y); if (f.k > 240) c.blow += dt; else c.blow = Math.max(0, c.blow - dt) } else c.blow = Math.max(0, c.blow - dt)
      if (c.blow > 0.25) { c.st = 'gone'; c.gone = 5; c.blow = 0; G.catShoos++; sfx('mew', { vol: 0.6 }); if (G.t > G.popUntil && G.t > G.bubUntil) say(T().catShoo, px, py + 40, 0.9); continue }
      const near = lb.find(b => Math.hypot(b.x - px, b.y - py) < 120)
      if (c.st === 'sit' && near) { c.st = 'raise'; c.t = 0 }
      else if (c.st === 'raise' && c.t > 0.6) { c.st = 'swipe'; c.t = 0; sfx('mew', { vol: 0.5, rate: 1.15 }); for (const b of lb) if (Math.hypot(b.x - px, b.y - py) < 92 + b.r * 0.4) popBubble(b, 'cat') }
      else if (c.st === 'swipe' && c.t > 0.5) { c.st = near ? 'raise' : 'sit'; c.t = 0 }
    } else if (d === 'sneezer') {
      const s = sneezerState(k, side), px = winX(side), py = winY(k)
      s.t += dt; s.cd -= dt
      const near = lb.find(b => Math.abs(b.y - py) < 220)
      if (s.st === 'idle' && near && s.cd <= 0) { s.st = 'wind'; s.t = 0; if (G.t > G.popUntil && G.t > G.bubUntil) say(T().sneezeT, px, py + 70, 1.0) }
      else if (s.st === 'wind' && s.t > 1.35) {
        s.st = 'blow'; s.t = 0; s.cd = 4.5; G.sneezes++; sfx('sneeze', { vol: 0.8 })
        for (const b of lb) { const dx = b.x - px, dy = b.y - py, dd = Math.hypot(dx, dy) || 1; if (dd < 78 + b.r * 0.3) popBubble(b, 'sneeze'); else if (dd < 330) { const k2 = 330 * Math.pow(1 - dd / 330, 1.2); b.vx += dx / dd * k2; b.vy += dy / dd * k2; b.wob += k2 * 0.9 } }
        for (const p of G.birds) { const dx = p.x - px, dy = p.y - py, dd = Math.hypot(dx, dy) || 1; if (dd < 260) { p.vx += dx / dd * 200; p.vy += dy / dd * 200 } }
      } else if (s.st === 'blow' && s.t > 0.7) { s.st = 'idle'; s.t = 0 }
    }
  }

  // 玉
  for (const b of lb) {
    let ax = Math.sin(G.t * 0.7 + b.ph) * 6, ay = -TUNE.g, fa = 0
    if (F) {
      const f = fanAcc(b.x, b.y, F.x, F.y)
      if (f.d < TUNE.hitFan + b.r * 0.7) { popBubble(b, 'fan'); continue }
      ax += f.ax; ay += f.ay; fa = f.k
    }
    // 室外機の風（横向き）
    for (const k of nearFloors(b.y)) { const ac = acOf(k); if (!ac) continue; const ay0 = winY(k) - 8; if (Math.abs(b.y - ay0) < 34) { const dx = (b.x - 0) * ac; if (dx > 20 && dx < 190) { ax += ac * 240 * (1 - dx / 190); fa += 240 * (1 - dx / 190) * 0.6 } } }
    b.wob += (fa + Math.hypot(b.vx, b.vy) * TUNE.wobV - b.wob) * Math.min(1, dt * 3)
    const wm = TUNE.wobMax * (b.giant ? 0.8 : 1)
    if (b.wob > wm) { popBubble(b, 'wind'); continue }
    b.vx += ax * dt; b.vy += ay * dt
    const dr = Math.exp(-TUNE.drag * dt); b.vx *= dr; b.vy *= dr
    const ox = b.x, oy = b.y
    b.x += b.vx * dt; b.y += b.vy * dt
    b.life -= dt
    // 届いたか（前のコマとの線分で）
    const o = G.order, rx0 = o.x - WIN_W / 2 + 6, rx1 = o.x + WIN_W / 2 - 6, ry0 = o.y - WIN_H / 2 + 4, ry1 = o.y + WIN_H / 2 - 4
    if (segRect(ox, oy, b.x, b.y, rx0, ry0, rx1, ry1)) { deliver(b); continue }
    if (b.life <= 0) { popBubble(b, 'time'); continue }
    if (b.x - b.r < -WALL || b.x + b.r > WALL) {
      // ゆっくり触れたら跳ね返る。速いと割れる
      if (Math.abs(b.vx) > 70) { popBubble(b, 'wall'); continue }
      b.x = clamp(b.x, -WALL + b.r, WALL - b.r); b.vx = -b.vx * 0.5; b.wob += 60
    }
    if (b.y - b.r < 0) { popBubble(b, 'ground'); continue }
    // 飾りに当たる
    let hit = null
    for (const k of nearFloors(b.y)) {
      for (const side of [-1, 1]) {
        const d = decoAt(k, side), wx = winX(side), wy = winY(k), ds = decoSide(k, side)
        if (d === 'cactus' && Math.hypot(b.x - (wx + ds * 32), b.y - (wy - WIN_H / 2 + 26)) < b.r + 16) hit = 'spike'
        if (d === 'shirt' && Math.abs(b.x - wx) < 40 + b.r * 0.8 && Math.abs(b.y - (wy + WIN_H / 2 - 4)) < 22 + b.r * 0.8) hit = 'cloth'
      }
      const ac = acOf(k); if (ac && Math.abs(b.x) < 30 + b.r * 0.85 && Math.abs(b.y - (winY(k) - 8)) < 20 + b.r * 0.85) hit = 'ac'
    }
    for (const p of G.birds) if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 11) hit = 'bird'
    if (hit) { popBubble(b, hit); continue }
  }
  // 玉同士は軽く押し合う
  if (lb.length === 2 && lb[0].alive && lb[1].alive) { const a = lb[0], b = lb[1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + b.r; if (d < m) { const p = (m - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; const vx = (a.vx + b.vx) / 2, vy = (a.vy + b.vy) / 2; a.vx = b.vx = vx; a.vy = b.vy = vy } }
  checkDone()
}
// 線分と四角が交わるか
function segRect(x0, y0, x1, y1, rx0, ry0, rx1, ry1) {
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0
  for (const [p, q] of [[-dx, x0 - rx0], [dx, rx1 - x0], [-dy, y0 - ry0], [dy, ry1 - y0]]) {
    if (p === 0) { if (q < 0) return false } else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r } else { if (r < t0) return false; if (r < t1) t1 = r } }
  }
  return true
}

// ---- 描く ----
const INK = '#3b2a20'
const CURT = ['#f2c14e', '#86b65a', '#f27c5c', '#4fb3b5', '#e8d9c0', '#9fc6dd']
function drawSky(c) {
  const alt = clamp(G.camY / 2400, 0, 1)
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, `rgb(${Math.round(lerp(150, 110, alt))},${Math.round(lerp(208, 180, alt))},${Math.round(lerp(214, 222, alt))})`)
  g.addColorStop(1, '#e6f2ea')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  // 遠くの雲と団地（ゆっくり動く）
  c.fillStyle = 'rgba(255,255,255,.75)'
  for (let i = 0; i < 6; i++) {
    const wy = 300 + i * 520, y = H - (wy - G.camY * 0.25) * S, x = W * ((i * 0.37 + 0.12) % 1)
    if (y < -60 || y > H + 60) continue
    c.beginPath(); c.ellipse(x, y, 52 * S, 16 * S, 0, 0, 7); c.ellipse(x + 30 * S, y - 9 * S, 32 * S, 15 * S, 0, 0, 7); c.fill()
  }
  c.fillStyle = '#b9d6d2'
  for (let i = 0; i < 9; i++) { const bw = 70 + (i * 37) % 50, bh = 260 + (i * 97) % 420, x = (i * 61) % 430 - 40, y = H - (bh - G.camY * 0.45) * S; c.fillRect(x * S, y, bw * S, H) }
}
function drawBuilding(c) {
  const top = G.camY + VH() + 40, bot = Math.max(0, G.camY - 40)
  // 側面（奥行き）と壁
  c.fillStyle = '#c9b48f'; c.fillRect(sx(WALL - 2), 0, (195 - WALL + 4) * S, sy(-1))
  c.fillRect(0, 0, sx(-WALL + 2), sy(-1))
  c.fillStyle = '#efe3c9'; c.fillRect(sx(-WALL), 0, (WALL * 2) * S, sy(0))
  // 雨どい
  c.fillStyle = '#a7a39a'; for (const x of [-WALL + 3, WALL - 9]) c.fillRect(sx(x), 0, 6 * S, sy(0))
  const k0 = Math.max(0, Math.floor((bot - 20) / FH) - 1), k1 = Math.ceil((top - 20) / FH) + 1
  for (let k = k0; k <= k1; k++) {
    const y = winY(k)
    // 床の帯
    const by = sy(k * FH - 55)
    c.fillStyle = '#e3d3b4'; c.fillRect(sx(-WALL), by - 10 * S, WALL * 2 * S, 10 * S)
    c.fillStyle = 'rgba(59,42,32,.12)'; c.fillRect(sx(-WALL), by, WALL * 2 * S, 2 * S)
    if (k < 1) continue
    for (const side of [-1, 1]) drawWindow(c, k, side)
    const ac = acOf(k); if (ac) { spr(c, 'ac', sx(0), sy(winY(k) - 8), 62 * S, 0, { anchor: 'mid', flip: ac < 0 }) }
    // 階数
    c.fillStyle = 'rgba(59,42,32,.35)'; c.font = `${11 * S}px "Kiwi Maru",serif`; c.textAlign = 'center'; c.fillText(T().floor(k + 1), sx(0), sy(y + 40))
  }
}
function drawWindow(c, k, side) {
  const x = winX(side), y = winY(k), tgt = isTarget(k, side) && G.phase !== 'next'
  const x0 = sx(x - WIN_W / 2), y0 = sy(y + WIN_H / 2), w = WIN_W * S, h = WIN_H * S
  const lit = hash(runSeed, k, side + 3) < 0.35
  c.fillStyle = tgt ? '#ffe9b0' : lit ? '#f7e7c4' : '#5f8a8f'
  c.fillRect(x0, y0, w, h)
  if (!tgt) {
    const cc = CURT[Math.floor(hash(runSeed, k, side + 5) * CURT.length)]
    c.fillStyle = cc; const cw = w * (0.18 + hash(runSeed, k, side + 9) * 0.22)
    c.fillRect(x0, y0, cw, h); c.fillRect(x0 + w - cw * 0.7, y0, cw * 0.7, h)
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(x0 + w * 0.3, y0); c.lineTo(x0 + w * 0.55, y0); c.lineTo(x0 + w * 0.2, y0 + h); c.lineTo(x0 - w * 0.05, y0 + h); c.fill()
  }
  // 枠
  c.strokeStyle = INK; c.lineWidth = 2 * S; c.strokeRect(x0, y0, w, h)
  if (!tgt) { c.beginPath(); c.moveTo(x0 + w / 2, y0); c.lineTo(x0 + w / 2, y0 + h); c.stroke() }
  // 窓台
  c.fillStyle = '#d8c4a0'; c.fillRect(x0 - 6 * S, y0 + h, w + 12 * S, 7 * S); c.strokeRect(x0 - 6 * S, y0 + h, w + 12 * S, 7 * S)
  const d = decoAt(k, side), ds = decoSide(k, side)
  if (tgt) {
    // 受け取る人が身を乗り出して待つ
    const who = G.order.who, bob = Math.sin(G.t * 4) * 2
    c.save(); c.beginPath(); c.rect(x0, y0 - 40 * S, w, h + 40 * S); c.clip()
    spr(c, who, sx(x), sy(y - WIN_H / 2) + bob * S, 86 * S)
    c.restore()
    const pulse = 0.5 + 0.5 * Math.sin(G.t * 5)
    c.strokeStyle = `rgba(242,193,78,${0.5 + pulse * 0.5})`; c.lineWidth = (4 + pulse * 3) * S; c.strokeRect(x0 - 5 * S, y0 - 5 * S, w + 10 * S, h + 10 * S)
  } else if (d === 'flower') spr(c, 'sunflower', sx(x + ds * 30), sy(y - WIN_H / 2 + 2), 30 * S)
  else if (d === 'cactus') spr(c, 'cactus', sx(x + ds * 32), sy(y - WIN_H / 2 + 2), 38 * S)
  else if (d === 'shirt') spr(c, 'shirt', sx(x), sy(y + WIN_H / 2 + 14), 82 * S, Math.sin(G.t * 1.7 + k) * 0.05, { anchor: 'top' })
  else if (d === 'cat') {
    const s = G.cats[k * 3 + side]
    if (!s || s.st !== 'gone') {
      const st = s ? s.st : 'sit', lift = st === 'raise' ? -0.25 : st === 'swipe' ? 0.35 : 0
      spr(c, 'cat', sx(x + ds * 34), sy(y - WIN_H / 2 + 2), 58 * S, lift * ds, { flip: ds < 0 ? false : true })
      if (st === 'swipe') { c.strokeStyle = 'rgba(59,42,32,.5)'; c.lineWidth = 3 * S; c.beginPath(); c.arc(sx(x + ds * 34), sy(y - WIN_H / 2 + 24), 70 * S, ds > 0 ? Math.PI * 0.95 : -0.2, ds > 0 ? Math.PI * 1.25 : 0.1); c.stroke() }
    }
  } else if (d === 'sneezer') {
    const s = G.sneez[k * 3 + side], st = s ? s.st : 'idle'
    c.save(); c.beginPath(); c.rect(x0, y0 - 20 * S, w, h + 20 * S); c.clip()
    const tilt = st === 'wind' ? -0.15 - Math.min(1, s.t / 1.3) * 0.15 : st === 'blow' ? 0.22 : 0
    const dy = st === 'idle' ? 30 : 0
    spr(c, 'sneezer', sx(x), sy(y - WIN_H / 2 - dy), 84 * S, tilt)
    c.restore()
    if (st === 'blow') { c.fillStyle = 'rgba(255,255,255,.55)'; const rr2 = (60 + s.t * 400) * S; c.beginPath(); c.arc(sx(x), sy(y), rr2, 0, 7); c.fill() }
  }
}
function drawStreet(c) {
  if (G.camY > 260) return
  const gy = sy(0)
  c.fillStyle = '#b8b0a2'; c.fillRect(0, gy, W, 26 * S)
  c.fillStyle = '#8c8578'; c.fillRect(0, gy + 26 * S, W, H)
  c.fillStyle = '#f5efe2'; for (let i = 0; i < 6; i++) c.fillRect((i * 80 + 10) * S, gy + 60 * S, 40 * S, 5 * S)
  // 入口
  c.fillStyle = '#d8c4a0'; c.fillRect(sx(-150), sy(110), 90 * S, 110 * S); c.strokeStyle = INK; c.lineWidth = 2 * S; c.strokeRect(sx(-150), sy(110), 90 * S, 110 * S)
  c.fillStyle = '#6d8f93'; c.fillRect(sx(-140), sy(98), 70 * S, 98 * S)
  spr(c, 'bottle', sx(70), sy(0), 22 * S)
  const kid = G.kid, kw = kid === 'kid_joy' ? 86 : 70
  const hop = kid === 'kid_joy' ? Math.abs(Math.sin((G.t - G.kidT) * 7)) * 14 : 0
  spr(c, kid, sx(-6), sy(0 + hop), kw * S)
}
function drawBubble(c, b) {
  const x = sx(b.x), y = sy(b.y), r = b.r * S
  const lifeK = clamp(b.life / b.maxLife, 0, 1), blink = lifeK < 0.25 && Math.sin(G.t * 18) > 0
  // 風でひしゃげる
  const sq = clamp(b.wob / TUNE.wobMax, 0, 1) * 0.28
  const ang = Math.atan2(-b.vy, b.vx)
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(1 + sq, 1 - sq * 0.8); c.rotate(-ang)
  // 中身
  c.save(); c.rotate(Math.sin(G.t * 1.3 + b.ph) * 0.2); spr(c, D.ITEMS[b.item].f, 0, 0, b.r * 1.15 * S, 0, { anchor: 'mid' }); c.restore()
  // 膜
  const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.65, 'rgba(255,255,255,.05)'); g.addColorStop(0.9, `rgba(170,225,230,${0.25 * lifeK + 0.08})`); g.addColorStop(1, `rgba(242,124,92,${0.3 * lifeK + 0.06})`)
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill()
  // 虹の縁（時間で回る）
  const hues = ['rgba(242,193,78,', 'rgba(242,124,92,', 'rgba(150,120,200,', 'rgba(79,179,181,', 'rgba(134,182,90,']
  c.lineWidth = 2.2 * S
  for (let i = 0; i < 5; i++) { const a0 = G.t * 0.8 + b.ph + i * 1.2566; c.strokeStyle = hues[i] + (blink ? 0.15 : 0.35 + 0.45 * lifeK) + ')'; c.beginPath(); c.arc(0, 0, r - 1 * S, a0, a0 + 1.2566); c.stroke() }
  const dz = clamp((b.wob / (TUNE.wobMax * (b.giant ? 0.8 : 1)) - 0.62) / 0.38, 0, 1)
  c.strokeStyle = blink || dz > 0.5 ? 'rgba(242,124,92,.95)' : 'rgba(59,42,32,.25)'; c.lineWidth = (1 + dz * 2.5) * S; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke()
  // 光
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 3 * S; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, r * 0.72, -2.5, -1.75); c.stroke()
  c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(r * 0.42, r * 0.38, r * 0.07, 0, 7); c.fill()
  c.restore()
}
function drawFan(c) {
  const F = G.ptr; if (!F) return
  const lb = live(); const tgt = lb[0] || { x: F.x, y: F.y + 100 }
  const a = Math.atan2(-(tgt.y - F.y), tgt.x - F.x)
  const flap = Math.sin(G.t * 22) * 0.35
  const x = sx(F.x), y = sy(F.y)
  c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); c.scale(1, 0.75 + 0.25 * Math.abs(Math.cos(G.t * 22)))
  spr(c, 'uchiwa', 0, 22 * S, 66 * S, flap, { anchor: 'bottom' })
  c.restore()
}
function drawBirds(c) { for (const p of G.birds) spr(c, 'pigeon', sx(p.x), sy(p.y), 54 * S, Math.sin(p.ph) * 0.08 + (p.flee ? -0.3 * Math.sign(p.vx) : 0), { anchor: 'mid', flip: p.vx < 0 }) }
function drawFx(c) {
  for (const p of G.fx) {
    const k = 1 - p.t / p.life
    if (p.kind === 'item') { spr(c, p.f, sx(p.x), sy(p.y), p.w * S, p.rot, { anchor: 'mid', alpha: Math.min(1, (p.life - p.t) * 2) }); continue }
    if (p.kind === 'wisp') { c.strokeStyle = `rgba(255,255,255,${k * 0.8})`; c.lineWidth = 2.5 * S; c.lineCap = 'round'; c.beginPath(); const x = sx(p.x), y = sy(p.y), dx = Math.cos(p.a) * 22 * S, dy = -Math.sin(p.a) * 22 * S; c.moveTo(x - dx, y - dy); c.quadraticCurveTo(x - dy * 0.3, y + dx * 0.3, x + dx, y + dy); c.stroke(); continue }
    if (p.kind === 'feather') { c.fillStyle = `rgba(150,150,155,${k})`; c.beginPath(); c.ellipse(sx(p.x), sy(p.y), 6 * S, 2.5 * S, p.t * 3, 0, 7); c.fill(); continue }
    c.fillStyle = p.col; c.globalAlpha = k; c.beginPath(); c.arc(sx(p.x), sy(p.y), p.sz * S, 0, 7); c.fill(); c.globalAlpha = 1
  }
}
// 狙う窓が画面の外なら、上（下）に受け取る人の顔を出す
function drawPointer(c) {
  if (!G.order || G.phase === 'next' || G.phase === 'over') return
  const y = sy(G.order.y), x = sx(G.order.x)
  if (y > 70 * S && y < H - 20) return
  const up = y <= 70 * S, py = up ? 110 * S : H - 60 * S
  c.fillStyle = 'rgba(255,250,240,.92)'; c.strokeStyle = INK; c.lineWidth = 2 * S
  c.beginPath(); c.arc(x, py, 24 * S, 0, 7); c.fill(); c.stroke()
  c.beginPath(); if (up) { c.moveTo(x - 9 * S, py - 22 * S); c.lineTo(x, py - 36 * S); c.lineTo(x + 9 * S, py - 22 * S) } else { c.moveTo(x - 9 * S, py + 22 * S); c.lineTo(x, py + 36 * S); c.lineTo(x + 9 * S, py + 22 * S) } c.fill(); c.stroke()
  c.save(); c.beginPath(); c.arc(x, py, 22 * S, 0, 7); c.clip(); spr(c, G.order.who, x, py + 30 * S, 56 * S); c.restore()
  c.fillStyle = INK; c.font = `${12 * S}px "Kiwi Maru",serif`; c.textAlign = 'center'; c.fillText(T().floor(G.order.k + 1), x, py + 40 * S)
}
// 初回だけ、玉の下に指の見本
function drawGhost(c) {
  if (G.tutDone || G.orders > 1 || G.phase !== 'fly' || G.ptr) return
  const b = live()[0]; if (!b) return
  const a = 0.5 + 0.5 * Math.sin(G.t * 4), x = sx(b.x + 30), y = sy(Math.max(b.y - 130, G.camY + 150 / S * 0 + 150) - a * 14)
  c.globalAlpha = 0.75
  c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 2 * S
  c.beginPath(); c.arc(x, y, 16 * S, 0, 7); c.fill(); c.stroke()
  c.beginPath(); c.arc(x, y, (24 + a * 10) * S, 0, 7); c.strokeStyle = 'rgba(59,42,32,.4)'; c.stroke()
  c.globalAlpha = 1
}
function render() {
  const c = cx
  c.setTransform(DPR, 0, 0, DPR, 0, 0)
  drawSky(c); drawBuilding(c); drawStreet(c)
  for (const b of G.bubbles) if (b.alive) drawBubble(c, b)
  drawBirds(c); drawFx(c); drawFan(c); drawGhost(c); drawPointer(c)
  // 吹き出し
  const el = $('#bub')
  if (G.bub && G.t < G.bubUntil) { el.textContent = G.bub.text; const x = clamp(sx(G.bub.wx), 90, W - 90), y = clamp(sy(G.bub.wy), 70, H - 40); el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('on') }
  else el.classList.remove('on')
}

// ---- 時計（固定60Hz・performance.now で数える） ----
let lastT = performance.now(), acc = 0
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let d = (now - lastT) / 1000; lastT = now
  if (G.paused) return
  if (d > 0.25) d = 0.25
  acc += d
  while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60 }
  if (G.scene === 'play') render()
  else if (G.scene === 'title') drawTitleArt()
}

// ---- タイトル ----
const ta = $('#tArt'), tc = ta.getContext('2d')
function sizeTitleArt() { const r = ta.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, devicePixelRatio || 1); ta.width = Math.round(r.width * d); ta.height = Math.round(r.height * d); ta._w = r.width; ta._h = r.height; ta._d = d }
let tt = 0
function drawTitleArt() {
  tt += 1 / 60
  if (!ta._w) sizeTitleArt(); if (!ta._w) return
  const c = tc, w = ta._w, h = ta._h, k = Math.min(w / 390, h / 740)
  c.setTransform(ta._d, 0, 0, ta._d, 0, 0)
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#a6d6da'); g.addColorStop(1, '#e6f2ea'); c.fillStyle = g; c.fillRect(0, 0, w, h)
  // 団地の壁（文字の下から）
  const bx = w / 2 - 150 * k, gy = h * 0.78, top = h * 0.30
  c.fillStyle = '#c9b48f'; c.fillRect(bx + 300 * k, top, 16 * k, gy - top)
  c.fillStyle = '#efe3c9'; c.fillRect(bx, top, 300 * k, gy - top)
  const rows = 3, rh = (gy - top - 20 * k) / rows
  for (let r = 0; r < rows; r++) for (let s = 0; s < 2; s++) {
    const x = bx + 28 * k + s * 150 * k, y = top + 16 * k + r * rh, ww = 96 * k, hh = Math.min(74 * k, rh - 18 * k)
    const tg = r === 0 && s === 1
    c.fillStyle = tg ? '#ffe9b0' : ['#5f8a8f', '#f7e7c4', '#5f8a8f'][(r + s) % 3]; c.fillRect(x, y, ww, hh)
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x, y, ww, hh)
    if (tg) { c.save(); c.beginPath(); c.rect(x, y - 30 * k, ww, hh + 30 * k); c.clip(); spr(c, 'grandma', x + ww / 2, y + hh, 74 * k); c.restore(); c.strokeStyle = `rgba(242,193,78,${0.6 + 0.4 * Math.sin(tt * 5)})`; c.lineWidth = 5; c.strokeRect(x - 4, y - 4, ww + 8, hh + 8) }
    else if (r === 1 && s === 0) spr(c, 'cat', x + ww - 14 * k, y + hh, 46 * k, Math.sin(tt * 2) * 0.1, { flip: true })
    else if (r === 2 && s === 1) spr(c, 'cactus', x + 20 * k, y + hh, 30 * k)
  }
  c.fillStyle = '#b8b0a2'; c.fillRect(0, gy, w, h - gy)
  spr(c, 'kid', w * 0.17, gy + 4 * k, 64 * k)
  // 玉（中に入れ歯）がおばあちゃんの窓へ
  const by = gy - 150 * k - Math.sin(tt * 0.9) * 22 * k, bxx = w * 0.56 + Math.sin(tt * 0.7) * 16 * k
  const fake = { x: 0, y: 0, r: 40, item: 'teeth', life: 1, maxLife: 1, wob: 80 + Math.sin(tt * 3) * 70, vx: 0, vy: 1, ph: 1 }
  c.save(); c.translate(bxx, by); const S0 = S; S = k; const gC = G.camY; G.camY = 0
  const W0 = W, H0 = H; W = 0; H = 0
  drawBubble(c, fake)
  W = W0; H = H0; S = S0; G.camY = gC
  c.restore()
  c.save(); c.translate(bxx + 6 * k, by + 120 * k); c.rotate(Math.sin(tt * 14) * 0.25); spr(c, 'uchiwa', 0, 0, 58 * k, 0, { anchor: 'top', sy: -1 }); c.restore()
}

// ---- 画面の出し分け ----
function show(id) { for (const v of ['#vTitle', '#vPlay', '#vEnd']) $(v).hidden = v !== id }
function applyLang() {
  const t = T()
  document.documentElement.lang = lang
  $('#tH').innerHTML = `<span class="s1">${t.title[0]}</span><span>${t.title[1]}</span><span class="s3">${t.title[2]}</span>`
  $('#tSub').textContent = t.sub; $('#bStartT').textContent = t.start; $('#bHow').textContent = t.how; $('#bLang').textContent = t.lang
  $('#loadTxt').textContent = t.loading; $('#bAgain').textContent = t.again; $('#bSave').textContent = t.save; $('#bPost').textContent = t.post
  $('#howH').textContent = t.howH; $('#howBody').innerHTML = t.howList.map(s => `<li>${s}</li>`).join(''); $('#howClose').textContent = t.close
  $('#howCred').textContent = lang === 'ja' ? '音: Kenney / wubitog / Neo139 / Of Far Different Nature / Kerzoven ほか（CC0・パブリックドメイン）' : 'Sound: Kenney / wubitog / Neo139 / Of Far Different Nature / Kerzoven and others (CC0 / public domain)'
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches
  $('#tutT').textContent = fine ? t.tutM : t.tutT
  let b = 0; try { b = +localStorage.getItem('sb_best') || 0 } catch (e) {}
  $('#tBest').textContent = b ? t.best(b) : ''
  if (G.scene === 'play') score()
  if (G.scene === 'end') drawRes()
}
function setMuteIcons() { for (const s of ['#bMute', '#bMute2']) { const el = $(s); el.querySelector('.wave').style.display = muted ? 'none' : ''; el.querySelector('.x').style.display = muted ? '' : 'none' } }
function toggleMute() { muted = !muted; Snd.setMute(muted); try { localStorage.setItem('sb_mute', muted ? '1' : '0') } catch (e) {} setMuteIcons() }
on('#bMute', () => { Snd.init(); toggleMute() }); on('#bMute2', () => { Snd.init(); toggleMute() })
on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('sb_lang', lang) } catch (e) {} applyLang() })
on('#bHow', () => { sfx('click', { vol: 0.5 }); $('#how').hidden = false })
on('#howClose', () => { $('#how').hidden = true })
$('#how').addEventListener('click', e => { if (e.target.id === 'how') $('#how').hidden = true })
on('#bStart', () => { Snd.init(); sfx('click', { vol: 0.6 }); startGame() })
on('#bAgain', () => { Snd.init(); sfx('click', { vol: 0.6 }); startGame() })
document.addEventListener('pointerdown', () => { if (G.scene === 'title' && !loopsOn.city && $('#loading').style.display === 'none') { Snd.init(); loop('city', 0.3) } }, true)

function hideTut() { const el = $('#tut'); if (!el.hidden) { el.style.opacity = '0'; setTimeout(() => { if (G.tutDone) el.hidden = true }, 400) } }
function startGame() {
  G.scene = 'play'; show('#vPlay'); resize(); reset()
  $('#tut').hidden = false; $('#tut').style.opacity = '1'
  drawMisses(); score(); $('#pop').className = ''; G.bub = null; ptr = null
  allLoopsOff(); loop('bgm', 0.22); loop('city', 0.3); loop('wind', 0.0001)
  window.TM && TM.start()
}

// ---- 結果（SNS に貼れる1枚 = 配達伝票） ----
const rankOf = n => { let r = D.RANKS[0]; for (const k of D.RANKS) if (n >= k.min) r = k; return r }
function drawCard(c, Wc, Hc) {
  const t = T(), n = G.n, rk = rankOf(n)
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.fillStyle = '#fffaf0'; c.fillRect(0, 0, Wc, Hc)
  const F = (px) => `500 ${px}px "Kiwi Maru","Hiragino Maru Gothic ProN",serif`
  // 伝票の罫線
  c.fillStyle = '#4fb3b5'; c.fillRect(0, 0, Wc, 140)
  c.fillStyle = '#fffaf0'; c.font = F(54); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillText(t.resTitle, 60, 92)
  c.fillStyle = 'rgba(255,250,240,.6)'; c.font = F(28); c.textAlign = 'right'; c.fillText('No.' + String(1000 + (runSeed % 9000)), Wc - 60, 90)
  c.strokeStyle = 'rgba(59,42,32,.25)'; c.lineWidth = 2
  for (const y of [420, 760, 1180]) { c.beginPath(); c.moveTo(50, y); c.lineTo(Wc - 50, y); c.stroke() }
  c.setLineDash([6, 10]); c.beginPath(); c.moveTo(0, 150); c.lineTo(Wc, 150); c.stroke(); c.setLineDash([])
  c.textAlign = 'left'; c.fillStyle = '#7a6656'; c.font = F(30); c.fillText(t.resN, 64, 210)
  c.fillStyle = INK; c.font = F(220); const ns = String(n); c.fillText(ns, 64, 395)
  const nw = c.measureText(ns).width
  c.font = F(70); c.fillText(t.unit, 80 + nw, 392)
  c.font = F(52); c.fillStyle = '#f27c5c'; c.fillText(rk[lang], 470, 300)
  c.font = F(30); c.fillStyle = '#7a6656'; c.fillText(t.resPops(G.pops), 474, 360)
  // 最後に届けた先
  c.fillStyle = '#7a6656'; c.font = F(30); c.fillText(t.resLast, 64, 470)
  const ld = G.lastDel
  if (ld) {
    c.fillStyle = '#ffe9b0'; c.fillRect(64, 500, 300, 230); c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(64, 500, 300, 230)
    c.save(); c.beginPath(); c.rect(64, 500, 300, 230); c.clip(); spr(c, ld.who, 214, 735, 250); c.restore()
    spr(c, D.ITEMS[ld.item].f, 330, 520, 90, 0.2, { anchor: 'mid' })
    bubbleText(c, ld.line, 400, 520, 640, ld.line.length > 9 && lang === 'ja' ? 50 : 56)
  } else {
    // 一件も届かなかった: 落ちた中身
    if (G.lastPop) spr(c, D.ITEMS[G.lastPop.item].f, 210, 700, 170, 2.6, { anchor: 'mid' })
    c.fillStyle = INK; c.font = F(46); c.fillText(G.lastPop ? D.ITEMS[G.lastPop.item][lang] : '', 400, 640)
    c.fillStyle = '#7a6656'; c.font = F(32); c.fillText(G.lastPop ? (t.popWhy[G.lastPop.why] || '') : '', 402, 700)
  }
  // 依頼人（子ども）
  c.fillStyle = '#7a6656'; c.font = F(30); c.fillText(t.resBy, 64, 810)
  const kid = n === 0 ? 'kid_cry' : n >= 6 ? 'kid_joy' : 'kid'
  spr(c, kid, 220, 1165, kid === 'kid_joy' ? 200 : 160)
  bubbleText(c, rk.kid[lang], 400, 870, 620, 56)
  c.fillStyle = '#7a6656'; c.font = F(28); c.fillText(t.resKid, 420, 1120)
  // はんこ
  c.save(); c.translate(Wc - 190, 1040); c.rotate(-0.2); c.strokeStyle = 'rgba(242,124,92,.85)'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 80, 0, 7); c.stroke(); c.fillStyle = 'rgba(242,124,92,.85)'; c.font = F(34); c.textAlign = 'center'; c.fillText(lang === 'ja' ? (n ? '受領' : '割れ') : (n ? 'OK' : 'POP'), 0, 12); c.restore()
  c.textAlign = 'left'; c.fillStyle = '#7a6656'; c.font = F(28); c.fillText('tom3games.com', 64, Hc - 60)
}
function bubbleText(c, s, x, y, maxW, px) {
  c.font = `500 ${px}px "Kiwi Maru","Hiragino Maru Gothic ProN",serif`
  const lines = wrap(c, s, maxW - 60)
  const bw = Math.max(...lines.map(l => c.measureText(l).width)) + 60, bh = lines.length * px * 1.3 + 40
  c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 4
  rrect(c, x, y, bw, bh, 30); c.fill(); c.stroke()
  c.beginPath(); c.moveTo(x + 4, y + bh * 0.55); c.lineTo(x - 34, y + bh * 0.8); c.lineTo(x + 4, y + bh * 0.78); c.fill(); c.stroke()
  c.fillStyle = '#fff'; c.fillRect(x + 1, y + bh * 0.55 + 2, 6, bh * 0.22)
  c.fillStyle = INK; c.textAlign = 'left'; lines.forEach((l, i) => c.fillText(l, x + 30, y + 20 + px * 1.05 + i * px * 1.3))
}
function wrap(c, s, maxW) {
  const out = []; let cur = ''
  for (const ch of (lang === 'ja' ? [...s] : s.split(/(?<= )/))) { if (c.measureText(cur + ch).width > maxW && cur) { out.push(cur.trim()); cur = ch } else cur += ch }
  if (cur) out.push(cur.trim()); return out
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function fitRes() {
  const box = $('#resBox').getBoundingClientRect(), el = $('#res')
  const w = Math.min(box.width, box.height * 0.8)
  el.style.width = w + 'px'; el.style.height = (w * 1.25) + 'px'
}
function drawRes() { const el = $('#res'); drawCard(el.getContext('2d'), el.width, el.height); fitRes() }
function showEnd() {
  G.scene = 'end'; show('#vEnd'); ptr = null; G.ptr = null
  allLoopsOff(); loop('city', 0.25)
  const n = G.n
  let b = 0; try { b = +localStorage.getItem('sb_best') || 0 } catch (e) {}
  if (n > b) { try { localStorage.setItem('sb_best', String(n)) } catch (e) {} }
  G.result = { n, rank: rankOf(n)[lang], newBest: n > b, pops: G.pops, orders: G.orders, shoos: G.shoos, catShoos: G.catShoos, sneezes: G.sneezes, twins: G.twins, giants: G.giants, t: +G.t.toFixed(1) }
  sfx(n >= 6 ? 'jgood' : 'jmeh', { vol: 0.6, delay: 0.3 })
  drawRes(); const el = $('#res'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in')
  window.TM && TM.end(n, n >= 6)
  applyLang()
}
on('#bSave', async () => {
  window.TM && TM.share('save')
  const el = $('#res')
  el.toBlob(async blob => {
    if (!blob) return
    const file = new File([blob], 'shabondama.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return } catch (e) { if (e && e.name === 'AbortError') return } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shabondama.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
  }, 'image/png')
})
on('#bPost', () => {
  window.TM && TM.share('x')
  const r = G.result || { n: 0, rank: '' }
  const u = 'https://x.com/intent/post?text=' + encodeURIComponent(T().postText(r.n, r.rank)) + '&url=' + encodeURIComponent('https://tom3games.com/play/shabondama/')
  window.open(u, '_blank', 'noopener')
})

// ---- 読み込み（絵・フォント・短い音を先に） ----
async function boot() {
  applyLang(); setMuteIcons(); resize(); drawMisses()
  const list = ['snd/pop1.mp3', 'snd/fan1.mp3', 'snd/ding.mp3', 'snd/click.mp3']
  let done = 0; const total = list.length + 2, bar = $('#loadBar i')
  const tick = () => { done++; bar.style.width = Math.round(done / total * 100) + '%' }
  const img = new Promise(ok => { IMG.onload = () => { imgOk = true; ok() }; IMG.onerror = () => ok(); IMG.src = A.img + '?v=1' }).then(tick)
  const font = (document.fonts ? document.fonts.load('500 20px "Kiwi Maru"', 'うちわでシャボン玉配達件0123456789') : Promise.resolve()).catch(() => {}).then(tick)
  const snds = list.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => {}).then(tick))
  await Promise.race([Promise.all([img, font, ...snds]), new Promise(r => setTimeout(r, 12000))])
  const l = $('#loading'); l.style.opacity = '0'; setTimeout(() => { l.style.display = 'none' }, 380)
  sizeTitleArt()
  window.__sbReady = true
}
requestAnimationFrame(frame)
boot()

// 危ない物の一覧（bot が避ける）
function hazards(y) {
  const out = []
  for (const k of nearFloors(y)) {
    for (const side of [-1, 1]) {
      const d = decoAt(k, side), wx = winX(side), wy = winY(k), ds = decoSide(k, side)
      if (d === 'cactus') out.push({ x: wx + ds * 32, y: wy - WIN_H / 2 + 26, r: 16 })
      if (d === 'shirt') { out.push({ x: wx - 22, y: wy + WIN_H / 2 - 4, r: 24 }); out.push({ x: wx + 22, y: wy + WIN_H / 2 - 4, r: 24 }) }
      if (d === 'cat') { const c = G.cats[k * 3 + side]; if (!c || c.st !== 'gone') out.push({ x: wx + ds * 34, y: wy - WIN_H / 2 + 22, r: 80 }) }
      if (d === 'sneezer') out.push({ x: wx, y: wy, r: 70 })
    }
    if (acOf(k)) out.push({ x: 0, y: winY(k) - 8, r: 34 })
  }
  for (const p of G.birds) if (!p.flee) out.push({ x: p.x + p.vx * 0.6, y: p.y, r: 22 })
  out.push({ x: -WALL - 20, y, r: 40 }, { x: WALL + 20, y, r: 40 })
  return out
}
// ---- 人の速さで遊ぶ bot（sim と ?demo=1 で使う） ----
// cfg: lag 指を動かすまでの遅れ（秒）/ err 狙いのずれ / dist うちわを置く最短の距離 / vmax 運ぶ速さ / shoo ハトと猫を追い払うか / spd 指の速さ（世界/秒）/ near 下手: 玉の真下すぐに置く
function makeBot(cfg, rnd = Math.random) {
  let goal = null, nextLook = 0, noise = { x: 0, y: 0 }, cur = null, lift = 0
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15
  return function step(dt) {
    if (G.phase !== 'fly') { cur = null; G.ptr = null; return }
    const lb = live(); if (!lb.length) { G.ptr = null; return }
    if (G.t >= nextLook) {
      nextLook = G.t + (cfg.lag || 0.2)
      noise = { x: gauss() * (cfg.err || 0), y: gauss() * (cfg.err || 0) }
      // 一番低い玉を見る（2つなら真ん中）
      const b = lb.length === 2 ? { x: (lb[0].x + lb[1].x) / 2, y: (lb[0].y + lb[1].y) / 2, vx: (lb[0].vx + lb[1].vx) / 2, vy: (lb[0].vy + lb[1].vy) / 2 } : lb[0]
      const o = G.order
      // ハトが近ければ先に追い払う
      if (cfg.shoo) {
        const p = G.birds.find(p => !p.flee && Math.hypot(p.x - b.x, p.y - b.y) < 150 && Math.sign(b.x - p.x) === Math.sign(p.vx))
        if (p) { const gx = clamp(p.x + (p.x > b.x ? 40 : -40), -175, 175), gy = p.y - 120; if (Math.hypot(gx - b.x, gy - b.y) > 140) { goal = { x: gx, y: gy }; return applyGoal(dt) } }
        for (const k of nearFloors(b.y)) for (const side of [-1, 1]) { if (decoAt(k, side) !== 'cat') continue; const cs = G.cats[k * 3 + side]; if (cs && cs.st === 'gone') continue; const px = winX(side) + decoSide(k, side) * 34, py = winY(k) - WIN_H / 2 + 22; if (Math.hypot(b.x - px, b.y - py) < 170) { goal = { x: clamp(px + (px > b.x ? 70 : -70), -175, 175), y: py - 60 }; return applyGoal(dt) } }
      }
      if (cfg.near) { goal = { x: b.x + noise.x * 0.3, y: b.y - (cfg.near) }; return applyGoal(dt) }
      // 行きたい速さから要る加速を出し、その強さが出る距離にうちわを置く
      const dx = o.x - b.x, dy = o.y - b.y, dd = Math.hypot(dx, dy) || 1
      const vm = cfg.vmax || 90, sp = Math.min(vm, dd * 0.9)
      const vdx = dx / dd * sp, vdy = dy / dd * sp
      let rvx = 0, rvy = 0
      if (cfg.avoid) for (const h of hazards(b.y)) { const hx = b.x + b.vx * 0.5 - h.x, hy = b.y + b.vy * 0.5 - h.y, hd = Math.hypot(hx, hy) || 1, m = h.r + 26 + 45; if (hd < m) { const k = (m - hd) / m * 120; rvx += hx / hd * k; rvy += hy / hd * k } }
      let axn = (vdx + rvx - b.vx) * 2.4, ayn = (vdy + rvy - b.vy) * 2.4 + TUNE.g
      // 壁から離す
      if (b.x < -120) axn += 60; if (b.x > 120) axn -= 60
      const am = Math.hypot(axn, ayn) || 1
      const want = clamp(am, 20, TUNE.fanK * (cfg.maxK || 0.55))
      // fanAcc の逆: k = fanK * (1-(d-near)/far)^pow
      const d = clamp(TUNE.fanNear + TUNE.fanFar * (1 - Math.pow(want / TUNE.fanK, 1 / TUNE.fanPow)), cfg.dist || 105, 360)
      goal = { x: b.x - axn / am * d + noise.x, y: b.y - ayn / am * d + noise.y }
    }
    return applyGoal(dt)
  }
  function applyGoal(dt) {
    if (!goal) return
    if (!cur) cur = { x: goal.x, y: goal.y }
    // 遠くへ動かす時は指を離して置き直す（人はうちわを玉の上を通さない）
    if (Math.hypot(goal.x - cur.x, goal.y - cur.y) > 120) { if (!lift) lift = G.t + 0.15; if (G.t < lift) { G.ptr = null; return } cur = { x: goal.x, y: goal.y }; lift = 0 }
    const mx = (cfg.spd || 900) * dt, dx = goal.x - cur.x, dy = goal.y - cur.y, d = Math.hypot(dx, dy)
    if (d > mx) { cur.x += dx / d * mx; cur.y += dy / d * mx } else { cur.x = goal.x; cur.y = goal.y }
    G.ptr = { x: cur.x, y: cur.y }
  }
}

// 実機・シミュレーターでの通し確認用（?demo=1）。本物の pointer を人の速さで送る。確認中は鳴らさない
if (/[?&]demo=1/.test(location.search)) {
  muted = true; Snd.setMute(true); setMuteIcons()
  const go = () => {
    if (!window.__sbReady) return setTimeout(go, 200)
    $('#bStart').click()
    const bot = makeBot({ lag: 0.45, err: 14, dist: 115, vmax: 85, shoo: true, spd: 700 })
    let down = false
    const tick = () => {
      if (G.scene !== 'play') return
      const save = G.ptr; bot(1 / 30); const want = G.ptr; G.ptr = save
      const r = cv.getBoundingClientRect()
      if (want) {
        const cxp = r.left + sx(want.x), cyp = r.top + sy(want.y)
        cv.dispatchEvent(new PointerEvent(down ? 'pointermove' : 'pointerdown', { bubbles: true, clientX: cxp, clientY: cyp, pointerId: 9, pointerType: 'touch' })); down = true
      } else if (down) { cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch' })); down = false }
      setTimeout(tick, 33)
    }
    tick()
  }
  go()
}

// ---- 検証用の窓口 ----
window.sb = {
  G, D, TUNE, start: startGame, result: () => G.result, rankOf, makeBot, lang: () => lang, live, fanAcc,
  state: () => ({ scene: G.scene, phase: G.phase, t: +G.t.toFixed(2), n: G.n, misses: G.misses, orders: G.orders, camY: +G.camY.toFixed(1), bubbles: live().map(b => ({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), item: b.item, life: +b.life.toFixed(1), wob: Math.round(b.wob) })), order: G.order && { k: G.order.k, side: G.order.side, item: G.order.item, twin: G.order.twin, giant: G.order.giant }, lastPop: G.lastPop, bub: G.bub && G.t < G.bubUntil ? G.bub.text : null }),
  // 画面座標: 玉の位置
  bubbleXY: (i = 0) => { const b = live()[i]; const r = cv.getBoundingClientRect(); return b ? { x: r.left + sx(b.x), y: r.top + sy(b.y), S } : null },
  dbg: {
    pause(b = true) { G.paused = b; lastT = performance.now(); acc = 0 },
    step(n = 1) { for (let i = 0; i < n; i++) update(1 / 60); render() },
    tick(n = 1) { for (let i = 0; i < n; i++) update(1 / 60) },
    seed(s) { seedV = (s % 2147483646) + 1 },
    toFly() { let f = 0; while (G.phase !== 'fly' && f++ < 600) update(1 / 60) },
    finish() { G.misses = D.MISSES - 1; const b = live()[0]; if (b) popBubble(b, 'wall'); else { G.misses = D.MISSES; G.phase = 'over'; G.phT = 0 } this.tick(200) },
    deliver() { const b = live()[0]; if (b) deliver(b) },
    deco, acOf, render, drawRes,
  },
}
})()
