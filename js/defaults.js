// 最初に入っている目標値・「いつものボタン」・商品。
// 数値は「日本食品標準成分表（八訂）」や商品の栄養成分表示をもとにした目安。
// tmp: true は「仮」の数値。パッケージの表示を見て あとで直す（画面に「仮」と出る）。

export const DEFAULT_SETTINGS = {
  p: { min: 100, max: 110 },
  f: { min: 30, max: 40 },
  c: { min: 180, max: 200 },
  nightFatMax: 15,   // 夜の脂質の上限(g)
  nightStartHour: 17, // この時刻以降を「夜」として数える
  waterGoal: 2000,    // 1日の水分の目標(ml)
};

// 1食材 = { name, kcal, p, f, c, w }（その量での値。w = 含まれる水分 g ≒ ml）
// 水分は成分表の「水分」から計算。晩酌は水分に数えないので w は付けない
const item = (name, kcal, p, f, c, w = 0, tmp = false) => ({ name, kcal, p, f, c, w, ...(tmp ? { tmp: true } : {}) });

// よく使う食材（何度も出てくるもの）
const CHICKEN50 = item('茹で鶏むね 皮なし 50g', 69, 14.6, 1.0, 0.0, 35); // 水分はささみ ゆで(69%)で推定
const EGG = item('卵 1個（50g）', 71, 6.1, 5.1, 0.2, 38);
const OLIVE14 = item('オリーブオイル 14g', 125, 0.0, 14.0, 0.0, 0);
const SESAME2 = item('黒ごま 2g', 12, 0.4, 1.1, 0.4, 0);

export const DEFAULT_PRESETS = [
  // 朝
  {
    kind: 'food', order: 1, name: '朝プロテイン',
    items: [
      item('ソイプロテイン ナチュラルバナナ 30g', 113, 22.0, 1.1, 4.0, 2), // 表示：28gあたり105.6kcal P20.5 F1.0 C3.7
      item('水 200ml', 0, 0, 0, 0, 200),
    ],
  },
  {
    kind: 'food', order: 2, name: 'オートミール雑炊',
    items: [
      item('ON365 オートミール インスタント小粒 30g', 116, 3.0, 3.3, 20.3, 3), // 表示：1食30gあたり
      EGG,
      item('和風顆粒だし 小さじ1/2（1.5g）', 3, 0.4, 0.0, 0.5, 0),
      item('乾燥わかめ 3g', 6, 0.5, 0.1, 1.3, 0), // 雑炊の水200mlで戻すので水分はそちらで数える
      CHICKEN50,
      item('水 200ml', 0, 0, 0, 0, 200),
    ],
  },
  // 昼
  {
    kind: 'food', order: 3, name: '昼の蕎麦セット',
    items: [
      item('小諸七兵衛 80g', 277, 10.6, 1.7, 54.8, 176), // 表示：乾めん100gあたり346kcal P13.2 F2.1 C68.5。水分：ゆでると約245g（成分表 干しそば ゆで 水分72%）
      CHICKEN50,
      EGG,
      item('乾燥わかめ 5g', 9, 0.9, 0.2, 2.1, 50), // 水分：戻すと約55g（カットわかめ 水煮 93.6%）
      item('黒千石納豆 1個（30g・タレなし）', 52, 4.8, 2.5, 3.8, 18), // あづま食品 黒千石小粒 納豆30gのみの表示
      item('本つゆ 大さじ1（15ml）', 16, 0.5, 0.0, 3.5, 10), // キッコーマン本つゆ 表示：大さじ1あたり
      OLIVE14,
      SESAME2,
    ],
  },
  { kind: 'food', order: 4, name: '＋キムチ 40g', items: [item('キムチ 40g', 11, 0.9, 0.0, 2.2, 35)] },
  {
    kind: 'food', order: 5, name: '切り餅1個＋醤油',
    items: [item('切り餅 1個（50g）', 112, 2.0, 0.3, 25.4, 22), item('醤油 6g', 5, 0.5, 0.0, 0.5, 4)],
  },
  { kind: 'food', order: 6, name: 'オリーブオイル 14g', items: [OLIVE14] },
  { kind: 'food', order: 7, name: '黒ごま 2g', items: [SESAME2] },

  // 晩酌
  { kind: 'drink', order: 11, name: 'PSB 350ml', items: [item('パーフェクトサントリービール 350ml', 112, 0.7, 0.0, 1.4)] },
  { kind: 'drink', order: 12, name: '焼酎ハイボール 226ml', items: [item('すごむぎ60ml＋ソーダ', 84, 0.0, 0.0, 0.0)] },
  { kind: 'drink', order: 15, name: '焼酎ロック 30ml', items: [item('すごむぎ25度 30ml', 42, 0.0, 0.0, 0.0)] },
  // アルパカ赤：度数13%（本人確認済み）で計算（100mlあたり約75kcal）
  { kind: 'drink', order: 13, name: 'アルパカ赤 ½本', items: [item('アルパカ 赤 375ml', 281, 0.7, 0.0, 5.6)] },
  { kind: 'drink', order: 14, name: 'アルパカ赤 1本', items: [item('アルパカ 赤 750ml', 563, 1.5, 0.0, 11.3)] },
];

// 最初から登録しておく商品（パッケージの表示を100gあたりに直した値）
export const DEFAULT_PRODUCTS = [
  { name: 'ON365 オートミール インスタント小粒', basis: 'g', unitName: '個', kcal: 386.7, p: 10.0, f: 11.0, c: 67.8 },
  { name: 'ソイプロテイン ナチュラルバナナ（OgarMade）', basis: 'g', unitName: '個', kcal: 377.1, p: 73.2, f: 3.6, c: 13.2 },
];
