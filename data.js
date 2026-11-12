// うちわでシャボン玉配達（shabondama）の文言とデータ。仕様の正本: ~/Desktop/claudecode/ideas/shabondama.md
const SB_DATA = {
  MISSES: 2,
  FH: 150,            // 1階分の高さ（世界）
  // 玉の中身と届け先。who は窓から受け取る人の絵、say は受け取った時のひとこと
  ITEMS: {
    ham: { f: 'ham', who: 'girl', ja: 'ハムスター', en: 'a hamster', say: { ja: ['ハム子！生きてた！', '散歩、長すぎ', 'ちょっと太った？'], en: ['Hammy! You live!', 'Long walk, huh?', 'Did you gain weight?'] } },
    teeth: { f: 'teeth', who: 'grandma', ja: '入れ歯', en: 'dentures', say: { ja: ['ふがふが（ありがとう）', 'これで煎餅が食える', 'おじいさんのじゃった'], en: ['Fank you (mumbled)', 'Rice crackers tonight', 'Oops, these are grandpa’s'] } },
    fish: { f: 'fish', who: 'dad', ja: '金魚', en: 'a goldfish', say: { ja: ['…水は？', '金魚すくいの子か', '朝から重い'], en: ['...Where is the water?', 'From the festival?', 'Too much for a morning'] } },
    oji: { f: 'oji', who: 'macho', ja: '小さいおじさん', en: 'a tiny man', say: { ja: ['師匠、おかえりなさい', '今日も小さいっすね', 'プロテイン飲みます？'], en: ['Welcome back, master', 'Still tiny, I see', 'Protein shake?'] } },
    chick: { f: 'chick', who: 'dog', ja: 'ひよこ', en: 'a chick', say: { ja: ['ワン！（友だち！）', 'ワン（なめていい？）', 'クゥン（ちっちゃ）'], en: ['Woof! (A friend!)', 'Woof (Can I lick it?)', 'Whine (So tiny)'] } },
    wig: { f: 'wig', who: 'boss', ja: '社長のカツラ', en: 'the CEO’s wig', giant: 1, say: { ja: ['見なかったことにしてくれ', '風が強い日だった', 'ボーナスは期待するな'], en: ['You saw nothing.', 'It was a windy day.', 'Don’t expect a bonus.'] } },
  },
  // 結果の称号（届けた数のしきい値）。kid は配った子のひとこと
  RANKS: [
    { min: 0, ja: '全部わった人', en: 'Popped them all', kid: { ja: 'おとなでしょ', en: 'You’re a grown-up!' } },
    { min: 1, ja: 'ご近所デビュー', en: 'Neighborhood rookie', kid: { ja: 'もうちょっとがんばって', en: 'Try a little harder' } },
    { min: 3, ja: '団地の配達員', en: 'Apartment courier', kid: { ja: 'まあまあ', en: 'Not bad' } },
    { min: 6, ja: 'うちわの達人', en: 'Fan master', kid: { ja: 'あしたもやって', en: 'Do it again tomorrow' } },
    { min: 10, ja: '風の職人', en: 'Wind craftsman', kid: { ja: 'しょうらい、なにになるの', en: 'What do you do for a living?' } },
    { min: 15, ja: '伝説のあおぎ手', en: 'Legendary fanner', kid: { ja: 'ママより上手', en: 'Better than Mom' } },
    { min: 25, ja: '空の郵便屋さん', en: 'Postman of the sky', kid: { ja: 'それ、仕事にしたら', en: 'Make it your job' } },
  ],
  TXT: {
    ja: {
      title: ['うちわで', 'シャボン玉', '配達'], sub: '子どもの夢を、割らずに届けて', start: 'あおぐ', how: '遊び方', lang: 'English',
      loading: 'シャボン液をまぜています', best: n => `自己ベスト ${n}件`,
      tutT: '玉の下に指を置いて、あおいで運ぶ', tutM: '玉の下でクリックしたまま、あおいで運ぶ',
      howH: '遊び方',
      howList: [
        '<b>指を置いた所にうちわ</b>。玉はうちわから遠ざかる。近いほど強い風。',
        '<b>近すぎると割れる。</b>うちわが当たる・強すぎる風・壁・地面・サボテン・ハト・猫の手もだめ。',
        '光っている窓の人に届ける。<b>2個割ったら終わり</b>。ハトと猫は、あおぐと逃げる。',
        'とちゅうから玉が2つになる。たまに大きな玉（社長のカツラ・3件分）。',
      ],
      close: 'とじる', again: 'もう一回', save: '画像を保存', post: 'Xでポスト',
      order: (fl, it) => `${fl}階へ ${it}`, twin: '2つ同時', giant: '大玉', floor: n => `${n}階`,
      popWhy: { fan: 'うちわが当たった', wind: '風が強すぎた', wall: '壁に当たった', ground: '地面に落ちた', spike: 'サボテンに刺さった', bird: 'ハトが割った', cat: '猫の手', sneeze: 'くしゃみで割れた', time: '時間切れ', ac: '室外機に当たった', cloth: '洗濯物に当たった' },
      pop: 'パチン', got: '配達完了', sneezeT: 'はっ…', sneezeT2: 'はっくしょん',
      kidPop: ['おとなでしょ', 'ママに言う', 'もう一回ふく', 'なんで'],
      catShoo: 'ニャッ', birdShoo: 'バサッ',
      unit: '件', resTitle: 'シャボン玉 配達伝票', resN: '届けた数', resLast: '最後に届けた先', resBy: '依頼人', resKid: '近所の子（6さい）',
      resPops: n => `割れた玉 ${n}個`,
      postText: (n, r) => `シャボン玉を${n}件届けた。「${r}」 #うちわでシャボン玉配達 #ひまつぶし横丁`,
    },
    en: {
      title: ['Bubble', 'Delivery', 'by Fan'], sub: 'Carry a kid’s dream without popping it', start: 'Fan it', how: 'How to play', lang: '日本語',
      loading: 'Mixing the soap', best: n => `Best: ${n}`,
      tutT: 'Hold your finger under the bubble and fan it up', tutM: 'Hold the mouse under the bubble and fan it up',
      howH: 'How to play',
      howList: [
        '<b>A paper fan appears under your finger.</b> The bubble drifts away from it. Closer means stronger.',
        '<b>Too close and it pops.</b> So do walls, the ground, cacti, pigeons and cat paws.',
        'Deliver to the glowing window. <b>Pop two and you are done.</b> Fan pigeons and cats to shoo them.',
        'Later the kid blows two at once. Sometimes a giant one (the CEO’s wig, worth 3).',
      ],
      close: 'Close', again: 'Again', save: 'Save image', post: 'Post on X',
      order: (fl, it) => `Floor ${fl}: ${it}`, twin: 'Two at once', giant: 'Giant one', floor: n => `${n}F`,
      popWhy: { fan: 'The fan hit it', wind: 'Too much wind', wall: 'Hit the wall', ground: 'Hit the ground', spike: 'Cactus', bird: 'Pigeon', cat: 'Cat paw', sneeze: 'Sneezed on', time: 'Too slow', ac: 'Hit the AC unit', cloth: 'Hit the laundry' },
      pop: 'Pop', got: 'Delivered', sneezeT: 'Ah...', sneezeT2: 'ACHOO',
      kidPop: ['You’re a grown-up!', 'I’m telling Mom', 'I’ll blow another', 'Why'],
      catShoo: 'Mrrp', birdShoo: 'Flap',
      unit: '', resTitle: 'Bubble Delivery Slip', resN: 'Delivered', resLast: 'Last delivery', resBy: 'Client', resKid: 'Kid next door (6)',
      resPops: n => `Popped: ${n}`,
      postText: (n, r) => `Delivered ${n} soap bubbles. "${r}" #BubbleDelivery`,
    },
  },
}
