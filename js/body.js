// 体組成（InBody）の項目・貼り付けの読み取り・推移グラフ・画像の縮小。
// データ保存は store.js、画面のつなぎは app.js が行う。

// 記録する項目（InBodyアプリ「詳細」の並び）。good = 増えると良い(+1)／減ると良い(-1)／どちらでもない(0)
export const METRICS = [
  { key: 'weight', label: '体重', unit: 'kg', step: 0.1, good: 0, words: ['体重'] },
  { key: 'muscle', label: '筋肉量', unit: 'kg', step: 0.1, good: 1, words: ['筋肉量'] },
  { key: 'smm', label: '骨格筋量', unit: 'kg', step: 0.1, good: 1, words: ['骨格筋量', '骨格筋'] },
  { key: 'fatMass', label: '体脂肪量', unit: 'kg', step: 0.1, good: -1, words: ['体脂肪量'] },
  { key: 'fatPct', label: '体脂肪率', unit: '%', step: 0.1, good: -1, words: ['体脂肪率'] },
  { key: 'whr', label: 'ウエストヒップ比', unit: '', step: 0.01, good: -1, words: ['ウエストヒップ比', 'ウエスト・ヒップ比', 'WHR'] },
  { key: 'visceral', label: '内臓脂肪レベル', unit: 'Lv', step: 1, good: -1, words: ['内臓脂肪レベル', '内臓脂肪'] },
  { key: 'bmr', label: '基礎代謝量', unit: 'kcal', step: 1, good: 0, words: ['基礎代謝量', '基礎代謝'] },
];

// 「#体組成 2026-10-12 / 体重 61.2kg / … / CID D型」を読み取る。体組成ブロックでなければ null
export function parseBody(raw) {
  const text = String(raw).normalize('NFKC');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length || !/^#\s*体組成/.test(lines[0])) return null;
  const out = {};
  const d = lines[0].match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (d) out.date = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
  for (const line of lines.slice(1)) {
    const cid = line.match(/^CID\s*[:：]?\s*(.+)$/i);
    if (cid) { out.cid = cid[1].trim(); continue; }
    // 長い言葉から先に見る（「骨格筋量」を「筋肉量」と取り違えない、「体脂肪率」と「体脂肪量」を分ける）
    const m = METRICS
      .flatMap((mt) => mt.words.map((w) => ({ mt, w })))
      .sort((a, b) => b.w.length - a.w.length)
      .find(({ w }) => line.startsWith(w));
    if (!m) continue;
    const n = line.slice(m.w.length).match(/-?[\d.]+/);
    if (n) out[m.mt.key] = parseFloat(n[0]);
  }
  return out;
}

// 前回との差。良い方向なら 'up-good' など、見た目用のクラスも返す
export function diffOf(mt, now, prev) {
  if (now == null || prev == null) return null;
  const d = Math.round((now - prev) / mt.step) * mt.step;
  if (Math.abs(d) < mt.step / 2) return { text: '±0', cls: '' };
  const sign = d > 0 ? '+' : '−';
  const digits = mt.step < 0.1 ? 2 : mt.step < 1 ? 1 : 0;
  const cls = mt.good === 0 ? '' : Math.sign(d) === mt.good ? 'good' : 'bad';
  return { text: `${sign}${Math.abs(d).toFixed(digits)}`, cls };
}

export const fmt = (mt, v) => {
  if (v == null || v === '') return '—';
  const digits = mt.step < 0.1 ? 2 : mt.step < 1 ? 1 : 0;
  return Number(v).toFixed(digits);
};

// 推移グラフ（1項目・折れ線）。SVGの文字列を返す。点の位置は data-i で tooltip に使う
export function chartSVG(mt, rows, width = 340, height = 200) {
  const pts = rows.filter((r) => r[mt.key] != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!pts.length) return '<p class="muted small" style="text-align:center;margin:40px 0">まだデータがありません</p>';
  const pad = { l: 40, r: 44, t: 16, b: 28 };
  const vals = pts.map((p) => p[mt.key]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.max(Math.abs(hi) * 0.02, mt.step * 5);
  lo -= span * 0.25; hi += span * 0.25;
  const t0 = new Date(pts[0].date).getTime();
  const t1 = new Date(pts[pts.length - 1].date).getTime();
  const x = (p) => (pts.length === 1 ? (pad.l + width - pad.r) / 2 : pad.l + ((new Date(p.date).getTime() - t0) / (t1 - t0)) * (width - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.8];
  const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  const last = pts[pts.length - 1];
  const grid = ticks.map((t) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(t)}" y2="${y(t)}" class="ch-grid"/>
    <text x="${pad.l - 6}" y="${y(t) + 4}" class="ch-axis" text-anchor="end">${fmt(mt, t)}</text>`).join('');
  const line = pts.length > 1 ? `<polyline points="${pts.map((p) => `${x(p)},${y(p[mt.key])}`).join(' ')}" class="ch-line"/>` : '';
  const dots = pts.map((p, i) => `<circle cx="${x(p)}" cy="${y(p[mt.key])}" r="4.5" class="ch-dot" data-i="${i}"/>`).join('');
  const hits = pts.map((p, i) => `<rect x="${x(p) - 18}" y="${pad.t}" width="36" height="${height - pad.t - pad.b}" fill="transparent" data-i="${i}" class="ch-hit"/>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${mt.label}の推移">
    ${grid}
    <text x="${pad.l}" y="${height - 8}" class="ch-axis">${md(pts[0].date)}</text>
    ${pts.length > 1 ? `<text x="${width - pad.r}" y="${height - 8}" class="ch-axis" text-anchor="end">${md(last.date)}</text>` : ''}
    <line x1="0" x2="0" y1="${pad.t}" y2="${height - pad.b}" class="ch-cross" hidden/>
    ${line}${dots}
    <text x="${x(last) + 8}" y="${y(last[mt.key]) + 4}" class="ch-last">${fmt(mt, last[mt.key])}</text>
    ${hits}
  </svg>
  <p class="ch-tip muted small" aria-live="polite"></p>`;
}

// タップした点の値を下に出す（指で押しやすいよう、点より広い範囲で反応）
export function bindChart(container, mt, rows) {
  const pts = rows.filter((r) => r[mt.key] != null).sort((a, b) => a.date.localeCompare(b.date));
  const tip = container.querySelector('.ch-tip');
  const cross = container.querySelector('.ch-cross');
  const show = (i) => {
    const p = pts[i];
    const dot = container.querySelector(`.ch-dot[data-i="${i}"]`);
    container.querySelectorAll('.ch-dot').forEach((d) => d.classList.toggle('on', d === dot));
    cross.setAttribute('x1', dot.getAttribute('cx')); cross.setAttribute('x2', dot.getAttribute('cx'));
    cross.hidden = false;
    tip.textContent = `${p.date.replaceAll('-', '/')}　${mt.label} ${fmt(mt, p[mt.key])}${mt.unit}`;
  };
  container.querySelectorAll('.ch-hit').forEach((h) => {
    h.addEventListener('pointerenter', () => show(Number(h.dataset.i)));
    h.addEventListener('click', () => show(Number(h.dataset.i)));
  });
  if (pts.length) show(pts.length - 1);
}

// スクショを小さくして保存できる形（JPEGの文字列）にする。1枚 約100KB 以下が目安
export function shrinkImage(file, maxW = 720, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
