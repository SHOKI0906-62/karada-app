// 食品成分表（data/foods.json）の読み込みと検索。
// 自分の記録ではないので store.js ではなくここで扱う。

let foods = null; // [{ code, name, label, kcal, p, f, c, key }]

// よく使う言い方 → 成分表での書き方（ひらがなにそろえたあとで比べる）
const SYNONYMS = {
  '鶏': ['にわとり', '鶏'], 'とり': ['にわとり'], 'ちきん': ['にわとり'],
  '豚': ['ぶた'], '牛': ['うし', '牛'],
  '卵': ['鶏卵', '卵'], 'たまご': ['鶏卵'], '玉子': ['鶏卵'],
  'ご飯': ['めし'], 'ごはん': ['めし'], '白米': ['精白米'], '米': ['こめ', '米'],
  '鮭': ['さけ'], '鯖': ['さば'], '鮪': ['まぐろ'], '鰯': ['いわし'], '鯵': ['あじ'],
  '胸': ['むね'], '腿': ['もも'], '蕎麦': ['そば'], '饂飩': ['うどん'],
  '芋': ['いも'], '玉ねぎ': ['たまねぎ'], '人参': ['にんじん'], '胡麻': ['ごま'],
  '茹で': ['ゆで'], '焼': ['焼き'],
};

// 全角→半角、カタカナ→ひらがな、小文字にそろえる
function norm(s) {
  return String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// 画面に出す名前：先頭の＜鳥肉類＞のような分類を外す
const labelOf = (name) => name.replace(/^＜[^＞]*＞\s*/, '');

export async function loadFoods() {
  if (foods) return foods;
  const res = await fetch('data/foods.json');
  const data = await res.json();
  foods = data.foods.map(([code, name, kcal, p, f, c]) => ({
    code, name, label: labelOf(name), kcal, p, f, c, key: norm(name),
  }));
  return foods;
}

// 並び順：名前が短いほど上。ふだん食べるもの（若どり・白米）は上、親鶏などは下へ
const PREFER = ['若どり', '精白米 うるち米', '全卵 生'];
const AVOID = ['［親', '［成鶏', '乾燥', '缶詰'];
const score = (fd) =>
  fd.key.length - (PREFER.some((w) => fd.name.includes(w)) ? 30 : 0) + (AVOID.some((w) => fd.name.includes(w)) ? 30 : 0);

export function searchFoods(query, limit = 60) {
  if (!foods) return [];
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const alts = terms.map((t) => [t, ...(SYNONYMS[t] || []).map(norm)]);
  return foods
    .filter((fd) => alts.every((list) => list.some((t) => fd.key.includes(t))))
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit);
}

export const foodByCode = (code) => foods?.find((fd) => fd.code === code);

// 最近使った食材（この端末だけのメモ）
const RECENT_KEY = 'karada-recent-foods';
export function recentFoods() {
  let codes = [];
  try { codes = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { /* 使えなくてもOK */ }
  return codes.map(foodByCode).filter(Boolean);
}
export function rememberFood(code) {
  try {
    const codes = [code, ...recentFoods().map((fd) => fd.code).filter((c) => c !== code)].slice(0, 15);
    localStorage.setItem(RECENT_KEY, JSON.stringify(codes));
  } catch { /* 使えなくてもOK */ }
}
