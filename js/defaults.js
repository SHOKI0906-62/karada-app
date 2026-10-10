// 最初に入っている目標値と「いつものボタン」。
// 数値は「日本食品標準成分表（八訂）」や商品の表示をもとにした目安。
// 「仮」と書いたものは、パッケージの表示を見て あとで直す。

export const DEFAULT_SETTINGS = {
  p: { min: 100, max: 110 },
  f: { min: 30, max: 40 },
  c: { min: 180, max: 200 },
  nightFatMax: 15,   // 夜の脂質の上限(g)
  nightStartHour: 17, // この時刻以降を「夜」として数える
};

// 1食材 = { name, kcal, p, f, c }（その量での値）
const item = (name, kcal, p, f, c) => ({ name, kcal, p, f, c });

export const DEFAULT_PRESETS = [
  {
    kind: 'food', order: 1, name: '昼の蕎麦セット',
    items: [
      item('小諸七兵衛 80g（仮）', 277, 10.6, 1.7, 54.8),
      item('茹で鶏むね 皮なし 50g', 69, 14.6, 1.0, 0.0),
      item('卵 1個（50g）', 71, 6.1, 5.1, 0.2),
      item('乾燥わかめ 5g', 9, 0.9, 0.2, 2.1),
      item('黒千石納豆 1個（タレ込み・仮）', 58, 4.9, 2.6, 4.9),
      item('オリーブオイル 14g', 125, 0.0, 14.0, 0.0),
      item('黒ごま 2g', 12, 0.4, 1.1, 0.4),
    ],
  },
  { kind: 'food', order: 2, name: '＋キムチ 40g', items: [item('キムチ 40g', 11, 0.9, 0.0, 2.2)] },
  {
    kind: 'food', order: 3, name: '切り餅1個＋醤油',
    items: [item('切り餅 1個（50g）', 112, 2.0, 0.3, 25.4), item('醤油 6g', 5, 0.5, 0.0, 0.5)],
  },
  { kind: 'food', order: 4, name: 'オリーブオイル 14g', items: [item('オリーブオイル 14g', 125, 0.0, 14.0, 0.0)] },
  { kind: 'food', order: 5, name: '黒ごま 2g', items: [item('黒ごま 2g', 12, 0.4, 1.1, 0.4)] },

  { kind: 'drink', order: 11, name: 'PSB 350ml', items: [item('パーフェクトサントリービール 350ml', 112, 0.7, 0.0, 1.4)] },
  { kind: 'drink', order: 12, name: '焼酎ハイボール 226ml', items: [item('すごむぎ60ml＋ソーダ', 84, 0.0, 0.0, 0.0)] },
  { kind: 'drink', order: 13, name: 'ワイン ½本', items: [item('赤ワイン 375ml', 254, 0.7, 0.0, 5.6)] },
  { kind: 'drink', order: 14, name: 'ワイン 1本', items: [item('赤ワイン 750ml', 508, 1.5, 0.0, 11.2)] },
  { kind: 'drink', order: 15, name: '焼酎ロック（仮60ml）', items: [item('すごむぎ 60ml', 84, 0.0, 0.0, 0.0)] },
];
