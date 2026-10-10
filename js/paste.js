// 「からだ記録ブロック」の読み取り。画面やデータ保存には触らない（文字 → データにするだけ）。
//
// 形：
//   #からだ記録
//   ON365 オートミール 30g | 116kcal P3.0 F3.3 C20.3
//   水 200ml | 0kcal P0 F0 C0      ← 料理に使った水。アプリ側で水分に数える
//   卵 全卵 生 50g | 71kcal P6.1 F5.1 C0.2
//   合計: 187kcal P9.1 F8.4 C20.5
//
// ・「|」の右に数値があれば、その数値をそのまま使う
// ・数値がない行は name / amount / unit だけ返す（照合はアプリ側で行う）

const UNITS = 'g|個|袋|本|杯|枚|切れ|ml|cc|パック|缶|食';

// 「116kcal P3.0 F3.3 C20.3」から数値を取り出す。見つからなければ null
export function parseNutrients(text) {
  const t = text.replace(/[:：=]/g, ' ');
  const grab = (re) => {
    const m = t.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  const kcal = grab(/([\d.]+)\s*kcal/i);
  const p = grab(/(?:^|[^a-z])P\s*([\d.]+)/i);
  const f = grab(/(?:^|[^a-z])F\s*([\d.]+)/i);
  const c = grab(/(?:^|[^a-z])C\s*([\d.]+)/i);
  if (kcal === null && p === null && f === null && c === null) return null;
  return { kcal: kcal ?? 0, p: p ?? 0, f: f ?? 0, c: c ?? 0 };
}

// 「卵 全卵 生 50g」→ { name:'卵 全卵 生', amount:50, unit:'g' }
export function parseFood(text) {
  // 先頭の「- 」「・」「1. 」のような箇条書きの印を外す
  const t = text.replace(/^\s*(?:[-・*•●○◯]|\d+[.)）、](?!\d))\s*/u, '').trim();
  const m = t.match(new RegExp(`^(.*?)\\s*([\\d.]+)\\s*(${UNITS})\\s*$`, 'i'));
  if (m && m[1].trim()) return { name: m[1].trim(), amount: parseFloat(m[2]), unit: m[3].toLowerCase() };
  return { name: t, amount: null, unit: null };
}

export function parseBlock(raw) {
  const lines = String(raw).normalize('NFKC').split(/\r?\n/);
  const result = { title: '', items: [], total: null };
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('```')) continue;
    if (line.startsWith('#')) {
      const t = line.replace(/^#+\s*/, '').replace(/^からだ記録\s*/, '').trim();
      if (t && !result.title) result.title = t;
      continue;
    }
    if (/^合計/.test(line)) {
      result.total = parseNutrients(line.replace(/^合計/, ''));
      continue;
    }
    const [left, ...rest] = line.split('|');
    const right = rest.join('|');
    const nut = right ? parseNutrients(right) : null;
    const food = parseFood(left);
    // 量も数値もない短い行は見出し（例：「朝食」）として扱う
    if (!nut && food.amount === null) {
      if (!result.title && !result.items.length) result.title = food.name.replace(/[【】\[\]]/g, '');
      continue;
    }
    result.items.push({ ...food, label: left.trim(), nut });
  }
  return result;
}

// 計算した合計と「合計:」行のズレをしらべる（10%以上かつ少しの差は無視）
export function checkTotal(calc, total) {
  if (!total) return [];
  const names = { kcal: 'kcal', p: 'P', f: 'F', c: 'C' };
  const minDiff = { kcal: 10, p: 1, f: 1, c: 1 };
  return Object.keys(names)
    .filter((k) => {
      const diff = Math.abs(calc[k] - total[k]);
      return diff > minDiff[k] && diff / Math.max(total[k], 1) >= 0.1;
    })
    .map((k) => ({ key: names[k], calc: calc[k], total: total[k] }));
}
