// 画面の動き。データの保存は store.js にまかせる。
import * as store from './store.js';
import { DEFAULT_PRESETS } from './defaults.js';
import { loadFoods, searchFoods, recentFoods, rememberFood } from './foods.js';
import { parseBlock, checkTotal } from './paste.js';
import { METRICS, parseBody, diffOf, fmt, chartSVG, bindChart, shrinkImage } from './body.js';

const $ = (s) => document.querySelector(s);
const state = {
  date: todayStr(),
  logs: [],   // 食事・晩酌の記録
  water: [],  // 水分の記録
  body: [],   // 体組成（新しい順）
  bodyMetric: 'weight', // グラフに出す項目
  presets: [],
  products: [],
  settings: null,
  unsubLogs: null,
};

// ---------- 小さな道具 ----------
function todayStr(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const r0 = (n) => Math.round(n).toLocaleString('ja-JP');
const r1 = (n) => (Math.round(n * 10) / 10).toString();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// w = 料理や飲み物に自分で加えた水(ml)
const sum = (arr) => arr.reduce((a, x) => ({ kcal: a.kcal + num(x.kcal), p: a.p + num(x.p), f: a.f + num(x.f), c: a.c + num(x.c), w: a.w + num(x.w) }), { kcal: 0, p: 0, f: 0, c: 0, w: 0 });
const pfcText = (t) => `${r0(t.kcal)}kcal P${r1(t.p)} F${r1(t.f)} C${r1(t.c)}`;
const isTmp = (p) => (p.items || []).some((it) => it.tmp);
const TMP = '<span class="tmp">仮</span>';
const hourOf = (time) => parseInt(String(time || '0').split(':')[0], 10);

// ---------- 起動 ----------
store.initStore(async (user) => {
  if (!user) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    return;
  }
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#localBanner').hidden = !user.local;
  $('#userInfo').textContent = user.local ? 'お試しモード（Firebase未設定）' : `ログイン中：${user.email}`;
  state.settings = await store.getSettings();
  fillSettingsForm();
  store.watchPresets((list) => { state.presets = list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); addWaterToOldPresets(); renderPresets(); renderPresetList(); });
  store.watchProducts((list) => { state.products = list.sort((a, b) => a.name.localeCompare(b.name, 'ja')); renderProducts(); });
  store.watchBody((list) => { state.body = list.sort((a, b) => b.date.localeCompare(a.date)); renderBody(); });
  watchDay();
}).catch(() => {
  // Firebaseの部品が読み込めなかったとき（初回に電波がない など）
  $('#login').hidden = false;
  $('#loginForm').hidden = true;
  $('#login').insertAdjacentHTML('beforeend', '<p class="card error">読み込みに失敗しました。電波のある場所で開き直してください。</p>');
});

$('#showPw').addEventListener('change', (e) => ($('#loginForm [name=pw]').type = e.target.checked ? 'text' : 'password'));
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#loginError').textContent = '';
  try {
    await store.signIn(String(f.get('email')).trim(), f.get('pw'));
  } catch (err) {
    const code = err?.code || '';
    const msg = {
      'auth/invalid-credential': 'メールかパスワードが違います（大文字・小文字、自動入力された古いパスワードに注意）',
      'auth/wrong-password': 'パスワードが違います',
      'auth/user-not-found': 'このメールのユーザーがいません',
      'auth/invalid-email': 'メールアドレスの形が正しくありません',
      'auth/too-many-requests': '失敗が続いたため一時的にロックされています。数分待ってから試してください',
      'auth/network-request-failed': '通信できませんでした。電波を確認してください',
      'auth/unauthorized-domain': 'このURLがFirebaseで許可されていません（承認済みドメイン）',
    }[code] || 'ログインできませんでした';
    $('#loginError').textContent = `${msg}${code ? `（${code}）` : ''}`;
  }
});

function watchDay() {
  if (state.unsubLogs) state.unsubLogs();
  state.unsubLogs = store.watchLogs(state.date, (logs) => {
    logs.sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.ts || 0) - (b.ts || 0));
    state.logs = logs.filter((l) => l.kind !== 'water');
    state.water = logs.filter((l) => l.kind === 'water');
    renderHome();
  });
  renderDate();
}

// ---------- タブ ----------
document.querySelectorAll('.tabbar button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabbar button').forEach((x) => x.classList.toggle('active', x === b));
    ['home', 'body', 'products', 'settings'].forEach((t) => ($(`#tab-${t}`).hidden = t !== b.dataset.tab));
    window.scrollTo(0, 0);
  })
);

// ---------- 日付 ----------
document.querySelectorAll('[data-day]').forEach((b) =>
  b.addEventListener('click', () => {
    const d = new Date(state.date + 'T12:00:00');
    d.setDate(d.getDate() + Number(b.dataset.day));
    state.date = todayStr(d);
    watchDay();
  })
);
$('#dateLabel').addEventListener('click', () => { state.date = todayStr(); watchDay(); });

function renderDate() {
  const d = new Date(state.date + 'T12:00:00');
  const w = '日月火水木金土'[d.getDay()];
  const isToday = state.date === todayStr();
  $('#dateLabel').textContent = `${d.getMonth() + 1}/${d.getDate()}(${w})${isToday ? ' 今日' : ''}`;
}

// ---------- ホーム ----------
function targets() {
  const s = state.settings;
  return {
    kmin: s.p.min * 4 + s.f.min * 9 + s.c.min * 4,
    kmax: s.p.max * 4 + s.f.max * 9 + s.c.max * 4,
  };
}

function renderHome() {
  if (!state.settings) return;
  const s = state.settings;
  const food = sum(state.logs.filter((l) => l.kind !== 'drink'));
  const drink = sum(state.logs.filter((l) => l.kind === 'drink'));
  const all = sum(state.logs);
  const nightF = sum(state.logs.filter((l) => hourOf(l.time) >= s.nightStartHour)).f;
  const { kmin, kmax } = targets();

  $('#kcalEaten').textContent = r0(food.kcal);
  $('#kcalDrink').textContent = r0(drink.kcal);
  $('#kcalTotal').textContent = r0(food.kcal + drink.kcal);
  const left = $('#kcalLeft');
  let msg;
  if (food.kcal < kmin) msg = `あと ${r0(kmin - food.kcal)}〜${r0(kmax - food.kcal)} kcal`;
  else if (food.kcal <= kmax) msg = `目標の範囲内 ✓（上限まで ${r0(kmax - food.kcal)}）`;
  else msg = `${r0(food.kcal - kmax)} kcal オーバー`;
  left.className = 'kcal-left' + (food.kcal > kmax ? ' over' : '');
  left.innerHTML = `${msg}<small>目標 ${r0(kmin)}〜${r0(kmax)} kcal（PFCの目標から計算・晩酌は別枠）</small>`;

  $('#bars').innerHTML =
    bar('P たんぱく質', all.p, s.p.min, s.p.max, 'var(--p)') +
    bar('F 脂質', all.f, s.f.min, s.f.max, 'var(--f)') +
    bar('C 炭水化物', all.c, s.c.min, s.c.max, 'var(--c)') +
    bar(`🌙 夜の脂質（${s.nightStartHour}時〜）`, nightF, 0, s.nightFatMax, 'var(--f)', true);

  renderWater();
  renderPresets();
  renderLogs();
}

function bar(label, val, min, max, color, isNight = false) {
  const scale = Math.max(max * 1.3, val, 1);
  const pct = (v) => `${Math.min(100, (v / scale) * 100)}%`;
  let left, cls;
  if (val > max) { left = `+${r1(val - max)}g オーバー`; cls = 'over'; }
  else if (isNight) { left = `残り ${r1(max - val)}g`; cls = ''; }
  else if (val >= min) { left = '範囲内 ✓'; cls = 'ok'; }
  else { left = `残り ${r1(min - val)}〜${r1(max - val)}g`; cls = ''; }
  const target = isNight ? `${max}g以内` : `${min}〜${max}g`;
  return `<div class="bar-row${isNight ? ' night' : ''}">
    <div class="bar-head"><span>${label}</span><span class="left ${cls}">${left}</span></div>
    <div class="bar-val"><b>${r1(val)}</b> / ${target}</div>
    <div class="bar">
      <div class="zone" style="left:${pct(min)};width:calc(${pct(max)} - ${pct(min)})"></div>
      <div class="fill ${val > max ? 'over' : ''}" style="width:${pct(val)};background:${color}"></div>
    </div></div>`;
}

function renderPresets() {
  const count = (id) => state.logs.filter((l) => l.presetId === id).length;
  const btn = (p) => {
    const t = sum(p.items || []);
    const n = count(p.id);
    return `<button class="quick" data-preset="${p.id}">
      <span class="name">${esc(p.name)}${isTmp(p) ? TMP : ''}</span>
      <span class="meta">${r0(t.kcal)}kcal${p.kind === 'drink' ? '' : ` · F${r1(t.f)}`}${n ? ` <span class="count">×${n}</span>` : ''}</span>
    </button>`;
  };
  $('#foodButtons').innerHTML = state.presets.filter((p) => p.kind !== 'drink').map(btn).join('') || '<p class="muted">まだありません</p>';
  $('#drinkButtons').innerHTML = state.presets.filter((p) => p.kind === 'drink').map(btn).join('');
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const p = state.presets.find((x) => x.id === b.dataset.preset);
  if (!p) return;
  const t = sum(p.items || []);
  await record({ kind: p.kind, name: p.name, ...t, items: p.items, presetId: p.id });
});

async function record(entry) {
  const time = state.date === todayStr() ? nowTime() : '12:00';
  const id = await store.addLog({ date: state.date, time, ...entry });
  showToast(`${entry.name} を記録`, () => store.deleteLog(id));
}

function renderLogs() {
  const ul = $('#logList');
  if (!state.logs.length) { ul.innerHTML = '<li class="empty">まだ記録がありません</li>'; return; }
  ul.innerHTML = state.logs.map((l) => `<li class="${l.kind === 'drink' ? 'drink' : ''}">
      <span class="time">${esc(l.time)}</span>
      <div class="main"><div class="title">${esc(l.name)}</div><div class="meta">${pfcText(l)}</div></div>
      <button data-log="${l.id}" aria-label="編集">✎</button>
    </li>`).join('');
}

$('#logList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-log]');
  if (!b) return;
  const l = state.logs.find((x) => x.id === b.dataset.log);
  openSheet(`<h3>${esc(l.name)}</h3>
    <p class="muted">${pfcText(l)}</p>
    <label>時刻<input type="time" name="time" value="${esc(l.time)}"></label>
    <button class="btn primary big" value="save">保存</button>
    <button class="btn danger" value="delete">この記録を消す</button>
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`,
  (f, action) => {
    if (action === 'save') store.updateLog(l.id, { time: f.get('time') || l.time });
    if (action === 'delete') store.deleteLog(l.id);
  });
});

// ---------- 数字を直接入力 ----------
$('#openManual').addEventListener('click', () => {
  openSheet(`<h3>数字を直接入力</h3>
    <label>名前<input name="name" placeholder="例：外食ランチ"></label>
    ${nutrientInputs()}
    <label class="check"><input type="checkbox" name="asPreset"> いつものボタンにも追加する</label>
    <button class="btn primary big" value="save">記録する</button>
    <button class="btn" value="cancel" formnovalidate>やめる</button>`,
  (f, action) => {
    if (action !== 'save') return;
    const it = readNutrients(f, f.get('name') || '手入力');
    record({ kind: 'food', ...it, items: [it] });
    if (f.get('asPreset')) store.savePreset({ kind: 'food', order: 50, name: it.name, items: [it] });
  });
});

function nutrientInputs(v = {}) {
  const field = (k, label) => `<label>${label}<input name="${k}" inputmode="decimal" value="${v[k] ?? ''}" placeholder="0"></label>`;
  return `<div class="nums">${field('kcal', 'エネルギー kcal')}${field('p', 'P たんぱく質 g')}${field('f', 'F 脂質 g')}${field('c', 'C 炭水化物 g')}</div>`;
}
const readNutrients = (f, name) => ({ name, kcal: num(f.get('kcal')), p: num(f.get('p')), f: num(f.get('f')), c: num(f.get('c')) });

// ---------- 商品 ----------
function renderProducts() {
  const q = $('#productSearch').value.trim();
  const list = state.products.filter((p) => !q || p.name.includes(q));
  $('#productList').innerHTML = list.length
    ? list.map((p) => `<li>
        <div class="main"><div class="title">${esc(p.name)}</div><div class="meta">${basisLabel(p)}：${pfcText(p)}</div></div>
        <button data-edit-product="${p.id}">編集</button>
        <button data-use-product="${p.id}">記録</button>
      </li>`).join('')
    : '<li class="empty">登録した商品はまだありません</li>';
}
const basisLabel = (p) => (p.basis === 'g' ? '100gあたり' : `1${p.unitName || '個'}あたり`);
$('#productSearch').addEventListener('input', renderProducts);
$('#newProduct').addEventListener('click', () => productForm());
$('#productList').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edit-product]');
  const use = e.target.closest('[data-use-product]');
  if (ed) productForm(state.products.find((p) => p.id === ed.dataset.editProduct));
  if (use) productRecord(state.products.find((p) => p.id === use.dataset.useProduct));
});

function productForm(p = { basis: 'unit', unitName: '個' }, after = null) {
  openSheet(`<h3>${p.id ? '商品を編集' : '商品を登録'}</h3>
    <p class="muted small">パッケージの「栄養成分表示」を見て入れてください</p>
    <label>商品名<input name="name" value="${esc(p.name || '')}" required placeholder="例：セブン サラダチキン"></label>
    <div class="seg">
      <label><input type="radio" name="basis" value="unit" ${p.basis !== 'g' ? 'checked' : ''}><span>1個・1袋あたり</span></label>
      <label><input type="radio" name="basis" value="g" ${p.basis === 'g' ? 'checked' : ''}><span>100gあたり</span></label>
    </div>
    ${nutrientInputs(p)}
    <button class="btn primary big" value="save">保存</button>
    ${p.id ? '<button class="btn danger" value="delete" formnovalidate>この商品を消す</button>' : ''}
    <button class="btn" value="cancel" formnovalidate>やめる</button>`,
  (f, action) => {
    if (action === 'delete') return store.deleteProduct(p.id);
    if (action !== 'save') return;
    store.saveProduct({ ...(p.id ? { id: p.id } : {}), ...readNutrients(f, f.get('name').trim()), basis: f.get('basis'), unitName: '個' });
    if (after) setTimeout(after, 300);
  });
}

function productRecord(p) {
  const isG = p.basis === 'g';
  const calc = (amount) => {
    const k = isG ? amount / 100 : amount;
    return { kcal: p.kcal * k, p: p.p * k, f: p.f * k, c: p.c * k, w: (p.w || 0) * k };
  };
  openSheet(`<h3>${esc(p.name)}</h3>
    <p class="muted small">${basisLabel(p)}：${pfcText(p)}</p>
    <div class="stepper">
      <button type="button" data-step="-1">−</button>
      <input name="amount" inputmode="decimal" value="${isG ? 100 : 1}">
      <button type="button" data-step="1">＋</button>
    </div>
    <p class="calc">${isG ? 'g' : '個'}　→　<b id="calcOut"></b></p>
    <label class="check"><input type="checkbox" name="asPreset"> この量でいつものボタンに追加する</label>
    <button class="btn primary big" value="save">記録する</button>
    <button class="btn" value="cancel" formnovalidate>やめる</button>`,
  (f, action) => {
    if (action !== 'save') return;
    const amount = num(f.get('amount'));
    const name = isG ? `${p.name} ${r1(amount)}g` : `${p.name}${amount === 1 ? '' : ` ×${r1(amount)}`}`;
    const it = { name, ...calc(amount) };
    record({ kind: 'food', ...it, items: [it] });
    if (f.get('asPreset')) store.savePreset({ kind: 'food', order: 50, name, items: [it] });
  });
  const input = $('#sheetForm [name=amount]');
  const update = () => ($('#calcOut').textContent = pfcText(calc(num(input.value))));
  input.addEventListener('input', update);
  $('#sheetForm').querySelectorAll('[data-step]').forEach((b) =>
    b.addEventListener('click', () => {
      const step = isG ? 10 : 0.5;
      input.value = r1(Math.max(0, num(input.value) + step * Number(b.dataset.step)));
      update();
    })
  );
  update();
}

// ホームの「商品から記録」：さがして選ぶ
$('#openProductPick').addEventListener('click', () => {
  openSheet(`<h3>商品から記録</h3>
    <input class="search" name="q" type="search" placeholder="名前でさがす" autocomplete="off">
    <ul class="list pick-list" id="pickList"></ul>
    <button class="btn" value="new" formnovalidate>＋ 新しく商品を登録</button>
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`,
  (f, action) => { if (action === 'new') setTimeout(() => productForm(), 0); });
  const q = $('#sheetForm [name=q]');
  const draw = () => {
    const list = state.products.filter((p) => !q.value.trim() || p.name.includes(q.value.trim()));
    $('#pickList').innerHTML = list.map((p) => `<li data-pick="${p.id}"><div class="main"><div class="title">${esc(p.name)}</div><div class="meta">${basisLabel(p)}：${pfcText(p)}</div></div></li>`).join('')
      || '<li class="empty">見つかりません</li>';
  };
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  $('#pickList').addEventListener('click', (e) => {
    const li = e.target.closest('[data-pick]');
    if (!li) return;
    $('#sheet').close();
    productRecord(state.products.find((p) => p.id === li.dataset.pick));
  });
  draw();
});

// ---------- 水分 ----------
function renderWater() {
  const drank = state.water.reduce((a, w) => a + num(w.ml), 0);
  const inFood = sum(state.logs.filter((l) => l.kind !== 'drink')).w; // 料理に使った水。晩酌は数えない
  const total = drank + inFood;
  const goal = state.settings.waterGoal || 2000;
  $('#waterTotal').textContent = r0(total);
  $('#waterGoal').textContent = r0(goal);
  $('#waterBreak').textContent = `飲んだ水 ${r0(drank)} ＋ 料理に使った水 ${r0(inFood)}`;
  $('#waterFood').style.width = `${Math.min(100, (inFood / goal) * 100)}%`;
  $('#waterFill').style.width = `${Math.min(100, (total / goal) * 100)}%`;
}

// 初期ボタンと同じ名前のボタンで、水(w)の量が初期値と違えば中身を入れ直す
// （前の版のボタンを今の決まりに合わせるため。合っていれば何もしない）
function addWaterToOldPresets() {
  for (const p of state.presets) {
    const def = DEFAULT_PRESETS.find((d) => d.name === p.name);
    if (!def) continue;
    const ws = (items) => (items || []).map((it) => num(it.w)).join(',');
    if (ws(p.items) !== ws(def.items)) store.savePreset({ id: p.id, items: def.items });
  }
}

async function addWater(ml) {
  if (!(ml > 0)) return;
  const time = state.date === todayStr() ? nowTime() : '12:00';
  const id = await store.addLog({ date: state.date, time, kind: 'water', name: `水分 ${ml}ml`, ml, kcal: 0, p: 0, f: 0, c: 0 });
  showToast(`💧 ${ml}ml を記録`, () => store.deleteLog(id));
}
document.querySelectorAll('[data-water]').forEach((b) => b.addEventListener('click', () => addWater(Number(b.dataset.water))));
$('#waterCustom').addEventListener('click', () => {
  openSheet(`<h3>💧 水分を入力</h3>
    <label>量（ml）<input name="ml" inputmode="numeric" placeholder="例：300"></label>
    <button class="btn primary big" value="save">記録する</button>
    <button class="btn" value="cancel" formnovalidate>やめる</button>`,
  (f, action) => { if (action === 'save') addWater(Math.round(num(f.get('ml')))); });
});
$('#waterListBtn').addEventListener('click', () => {
  const rows = state.water.map((w) => `<li><span class="time">${esc(w.time)}</span><div class="main"><div class="title">${r0(w.ml)} ml</div></div><button type="button" data-del-water="${w.id}">消す</button></li>`).join('');
  openSheet(`<h3>💧 この日の水分</h3>
    <ul class="list">${rows || '<li class="empty">まだ記録がありません</li>'}</ul>
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`, () => {});
  $('#sheetForm').querySelectorAll('[data-del-water]').forEach((b) =>
    b.addEventListener('click', () => { store.deleteLog(b.dataset.delWater); b.closest('li').remove(); }));
});

// ---------- 貼り付けて記録（からだ記録ブロック） ----------
const normName = (s) => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const UNIT_COUNT = ['個', '袋', '本', '杯', '枚', '切れ', 'パック', '缶', '食'];
const UNIT_WEIGHT = ['g', 'ml', 'cc'];

// 数値がない行を、自分の商品 → 成分表 の順でさがして計算する
function resolveItem(it) {
  const label = it.amount !== null ? `${it.name} ${r1(it.amount)}${it.unit}` : it.name;
  // 「水 200ml」「お湯 150ml」の行は、料理に使った水として水分に数える
  if (/^(水|お湯|湯|白湯|水道水|ミネラルウォーター)$/.test(String(it.name).trim()) && UNIT_WEIGHT.includes(it.unit)) {
    return { ok: true, label, src: '水（水分に数えます）', kcal: 0, p: 0, f: 0, c: 0, w: it.amount };
  }
  if (it.nut) return { ok: true, label, src: '書いてある数値', ...it.nut };
  const key = normName(it.name);
  const isCount = UNIT_COUNT.includes(it.unit);
  const isWeight = UNIT_WEIGHT.includes(it.unit);
  // 商品名との照合：貼った名前の言葉が、商品名の「言葉の頭」と合うときだけ一致とする
  // （例：「オートミール」→ ON365 オートミール ○、「バナナ」→ ソイプロテイン ナチュラルバナナ ×）
  const terms = String(it.name).normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
  const prod = state.products.find((p) => {
    const words = String(p.name).normalize('NFKC').toLowerCase().split(/[\s（）()［］\[\]・]+/).filter(Boolean);
    const nameOk = key.includes(normName(p.name)) || terms.every((t) => words.some((w) => w.startsWith(t)));
    return nameOk && ((p.basis === 'g' && isWeight) || (p.basis !== 'g' && isCount));
  });
  if (prod) {
    const k = prod.basis === 'g' ? it.amount / 100 : it.amount;
    return { ok: true, label, src: `商品：${prod.name}`, kcal: prod.kcal * k, p: prod.p * k, f: prod.f * k, c: prod.c * k, w: (prod.w || 0) * k };
  }
  if (isWeight) {
    const fd = searchFoods(it.name, 1)[0];
    if (fd) {
      const k = it.amount / 100;
      return { ok: true, label, src: `成分表：${fd.label}`, kcal: fd.kcal * k, p: fd.p * k, f: fd.f * k, c: fd.c * k };
    }
  }
  return { ok: false, label, src: '見つかりません（登録してください）', kcal: 0, p: 0, f: 0, c: 0, it };
}

async function openPaste(text = '') {
  openSheet(`<h3>📋 貼り付けて記録</h3>
    <p class="muted small">Claudeの「#からだ記録」ブロックをそのまま貼り付けてください</p>
    <textarea name="text" placeholder="#からだ記録&#10;食品名 30g | 116kcal P3.0 F3.3 C20.3&#10;合計: 116kcal P3.0 F3.3 C20.3">${esc(text)}</textarea>
    <div id="pastePreview"></div>
    <button class="btn primary big" value="save" id="pasteSave" disabled>記録する</button>
    <button class="btn" value="cancel" formnovalidate>やめる</button>`,
  (f, action) => {
    if (action !== 'save' || !state.paste) return;
    const { title, rows } = state.paste;
    const ok = rows.filter((r) => r.ok);
    const ng = rows.length - ok.length;
    if (!ok.length) return;
    if (ng && !confirm(`見つからない ${ng} 件は記録されません。よろしいですか？`)) return setTimeout(() => openPaste(f.get('text')), 0);
    const items = ok.map((r) => ({ name: r.label, kcal: r.kcal, p: r.p, f: r.f, c: r.c, w: r.w || 0 }));
    record({ kind: 'food', name: `${title || '貼り付け'}（${items.length}品）`, ...sum(items), items });
  });
  const ta = $('#sheetForm [name=text]');
  try { await loadFoods(); } catch { /* 成分表なしでも、数値付きの行は使える */ }
  const draw = () => {
    if (parseBody(ta.value)) { $('#sheet').close(); openBodyForm({}, ta.value); return; }
    const block = parseBlock(ta.value);
    const rows = block.items.map(resolveItem);
    state.paste = { title: block.title, rows };
    const total = sum(rows);
    const warns = checkTotal(total, block.total);
    const ng = rows.filter((r) => !r.ok).length;
    $('#pasteSave').disabled = !rows.some((r) => r.ok);
    if (!rows.length) { $('#pastePreview').innerHTML = ta.value.trim() ? '<p class="warn">読み取れる行がありません。「食品名 量g | 〇kcal P〇 F〇 C〇」の形か確認してください</p>' : ''; return; }
    $('#pastePreview').innerHTML = `
      <ul class="list">${rows.map((r, i) => `<li class="paste-row ${r.ok ? '' : 'ng'}">
        <div class="main"><div class="title">${esc(r.label)}</div>
          <div class="meta">${r.ok ? pfcText(r) : ''}</div><div class="src">${esc(r.src)}</div></div>
        ${r.ok ? '' : `<button type="button" data-reg="${i}">登録</button>`}
      </li>`).join('')}</ul>
      <p class="paste-total">合計　<b>${pfcText(total)}</b></p>
      ${warns.length ? `<p class="warn">⚠️ 「合計:」の行と10%以上ズレています：${warns.map((w) => `${w.key} 計算${r1(w.calc)} / 合計行${r1(w.total)}`).join('、')}</p>` : ''}
      ${block.total && !warns.length ? '<p class="muted small" style="text-align:center">✓ 「合計:」の行と一致しています</p>' : ''}
      ${ng ? `<p class="warn">見つからない食品が ${ng} 件あります。「登録」から商品として登録できます</p>` : ''}`;
    $('#pastePreview').querySelectorAll('[data-reg]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = rows[Number(b.dataset.reg)].it;
        const saved = ta.value;
        $('#sheet').close();
        productForm({ name: it.name, basis: UNIT_WEIGHT.includes(it.unit) ? 'g' : 'unit', unitName: '個' }, () => openPaste(saved));
      }));
  };
  ta.addEventListener('input', draw);
  draw();
}
$('#openPaste').addEventListener('click', () => openPaste());

// ---------- 体組成（InBody） ----------
function renderBody() {
  const [latest, prev] = state.body;
  $('#bodyLatest').innerHTML = latest
    ? `<div class="body-head"><b>${latest.date.replaceAll('-', '/')}</b>${latest.cid ? `<span class="cid">CID ${esc(latest.cid)}</span>` : ''}</div>
       <div class="metric-grid">${METRICS.filter((mt) => latest[mt.key] != null).map((mt) => {
         const d = diffOf(mt, latest[mt.key], prev?.[mt.key]);
         return `<div class="metric"><div class="name">${mt.label}</div>
           <div class="val">${fmt(mt, latest[mt.key])}<small>${mt.unit}</small></div>
           <div class="diff ${d?.cls || ''}">${d ? `前回比 ${d.text}` : '&nbsp;'}</div></div>`;
       }).join('')}</div>`
    : '<p class="muted">まだ記録がありません。InBodyの結果を「📋 貼り付けて記録」か「✏️ 手で入力」で入れてください</p>';
  const shown = METRICS.filter((mt) => state.body.some((r) => r[mt.key] != null));
  if (!shown.some((mt) => mt.key === state.bodyMetric) && shown.length) state.bodyMetric = shown[0].key;
  $('#bodyChips').innerHTML = (shown.length ? shown : METRICS.slice(0, 1)).map((mt) =>
    `<button type="button" data-metric="${mt.key}" class="${mt.key === state.bodyMetric ? 'on' : ''}">${mt.label}</button>`).join('');
  const mt = METRICS.find((m) => m.key === state.bodyMetric);
  $('#bodyChart').innerHTML = chartSVG(mt, state.body);
  bindChart($('#bodyChart'), mt, state.body);
  $('#bodyList').innerHTML = state.body.map((r) => `<li>
      <div class="main"><div class="title">${r.date.replaceAll('-', '/')}${r.images?.length ? ' 📷' : ''}</div>
        <div class="meta">${['weight', 'fatPct', 'smm'].map((k) => { const m = METRICS.find((x) => x.key === k); return r[k] != null ? `${m.label} ${fmt(m, r[k])}${m.unit}` : ''; }).filter(Boolean).join('　')}</div></div>
      <button data-body="${r.date}">開く</button></li>`).join('') || '<li class="empty">まだ記録がありません</li>';
}
$('#bodyChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-metric]');
  if (b) { state.bodyMetric = b.dataset.metric; renderBody(); }
});
$('#bodyList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-body]');
  if (b) openBodyForm(state.body.find((r) => r.date === b.dataset.body));
});
$('#bodyNew').addEventListener('click', () => openBodyForm());
$('#bodyPaste').addEventListener('click', () => openBodyForm({}, '', true));

// 体組成の入力画面。text があれば読み取って欄を埋める。focusPaste なら貼り付け欄から始める
function openBodyForm(rec = {}, text = '', focusPaste = false) {
  const editing = !!rec.date;
  let images = [...(rec.images || [])];
  openSheet(`<h3>${editing ? '体組成の記録' : '体組成を記録'}</h3>
    <label>Claudeの「#体組成」ブロックを貼り付け（なくてもOK）
      <textarea name="paste" placeholder="#体組成 2026-10-12&#10;体重 61.2kg&#10;体脂肪率 8.4%&#10;…">${esc(text)}</textarea></label>
    <label>測定日<input type="date" name="date" value="${esc(rec.date || todayStr())}" required></label>
    <div class="body-fields">${METRICS.map((mt) => `<label>${mt.label}${mt.unit ? `（${mt.unit}）` : ''}
      <input name="${mt.key}" inputmode="decimal" value="${rec[mt.key] ?? ''}"></label>`).join('')}</div>
    <label>CID型<input name="cid" value="${esc(rec.cid || '')}" placeholder="例：D型"></label>
    <p class="muted small">スクショ（InBodyの画面）</p>
    <div class="thumbs" id="thumbs"></div>
    <label class="btn" style="text-align:center">📷 スクショを追加<input type="file" accept="image/*" multiple id="bodyFiles" hidden></label>
    <button class="btn primary big" value="save">保存</button>
    ${editing ? '<button class="btn danger" value="delete" formnovalidate>この日の記録を消す</button>' : ''}
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`,
  (f, action) => {
    if (action === 'delete') { if (confirm(`${rec.date} の体組成を消しますか？`)) store.deleteBody(rec.date); return; }
    if (action !== 'save') return;
    const date = f.get('date');
    // Firestore の1件の上限は1MB。画像が大きすぎると保存できないので先に確かめる
    if (images.join('').length > 900000) { alert('スクショが大きすぎます。枚数を減らしてください'); return setTimeout(() => openBodyForm(rec, form.elements.paste.value), 0); }
    const data = { cid: String(f.get('cid') || '').trim(), images };
    for (const mt of METRICS) { const v = String(f.get(mt.key) || '').trim(); data[mt.key] = v === '' ? null : num(v); }
    if (editing && rec.date !== date) store.deleteBody(rec.date);
    store.saveBody(date, data);
    showToast(`${date.replaceAll('-', '/')} の体組成を保存`);
  });
  const form = $('#sheetForm');
  const fill = () => {
    const b = parseBody(form.elements.paste.value);
    if (!b) return;
    if (b.date) form.elements.date.value = b.date;
    for (const mt of METRICS) if (b[mt.key] != null) form.elements[mt.key].value = b[mt.key];
    if (b.cid) form.elements.cid.value = b.cid;
  };
  const drawThumbs = () => {
    $('#thumbs').innerHTML = images.map((src, i) => `<figure><img src="${src}" alt="スクショ${i + 1}" data-view="${i}"><button type="button" data-rm="${i}" aria-label="消す">×</button></figure>`).join('');
  };
  form.elements.paste.addEventListener('input', fill);
  $('#thumbs').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { images.splice(Number(rm.dataset.rm), 1); drawThumbs(); return; }
    const v = e.target.closest('[data-view]');
    if (v) showPhoto(images[Number(v.dataset.view)]);
  });
  $('#bodyFiles').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      if (images.length >= 4) { alert('スクショは4枚までです'); break; }
      try { images.push(await shrinkImage(file)); } catch { alert('画像を読み込めませんでした'); }
    }
    e.target.value = '';
    drawThumbs();
  });
  fill();
  drawThumbs();
  if (focusPaste) form.elements.paste.focus();
}

// ---------- 食材をさがす（食品成分表） ----------
$('#openFoodSearch').addEventListener('click', async () => {
  openSheet(`<h3>食材をさがす</h3>
    <input class="search" name="q" type="search" placeholder="例：鶏 むね、ごはん、バナナ" autocomplete="off">
    <p class="muted small" id="foodHint">読み込み中…</p>
    <ul class="list pick-list" id="foodList"></ul>
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`, () => {});
  const q = $('#sheetForm [name=q]');
  const per100 = (fd) => `100gあたり ${pfcText(fd)}`;
  const draw = () => {
    const words = q.value.trim();
    const list = words ? searchFoods(words) : recentFoods();
    $('#foodHint').textContent = words
      ? (list.length ? `${list.length}件${list.length >= 60 ? '以上（言葉を足すとしぼれます）' : ''}` : '見つかりません。ひらがなや別の言い方でも試してください')
      : (list.length ? '最近使った食材' : 'スペースで区切ると しぼりこめます（例：鶏 むね 皮なし）');
    $('#foodList').innerHTML = list.map((fd) => `<li data-food="${fd.code}"><div class="main"><div class="title">${esc(fd.label)}</div><div class="meta">${per100(fd)}</div></div></li>`).join('');
    state.foodList = list;
  };
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); } });
  $('#foodList').addEventListener('click', (e) => {
    const li = e.target.closest('[data-food]');
    if (!li) return;
    const fd = state.foodList.find((x) => x.code === li.dataset.food);
    rememberFood(fd.code);
    $('#sheet').close();
    productRecord({ name: fd.label, basis: 'g', kcal: fd.kcal, p: fd.p, f: fd.f, c: fd.c });
  });
  try {
    await loadFoods();
    draw();
  } catch {
    $('#foodHint').textContent = '成分表を読み込めませんでした。電波のある場所で開き直してください';
  }
});

// ---------- 設定 ----------
function fillSettingsForm() {
  const s = state.settings;
  const f = $('#settingsForm');
  const set = (n, v) => (f.elements[n].value = v);
  set('pmin', s.p.min); set('pmax', s.p.max);
  set('fmin', s.f.min); set('fmax', s.f.max);
  set('cmin', s.c.min); set('cmax', s.c.max);
  set('nightFatMax', s.nightFatMax); set('nightStartHour', s.nightStartHour);
  set('waterGoal', s.waterGoal);
}
$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const g = (n) => num(f.get(n));
  state.settings = {
    p: { min: g('pmin'), max: g('pmax') },
    f: { min: g('fmin'), max: g('fmax') },
    c: { min: g('cmin'), max: g('cmax') },
    nightFatMax: g('nightFatMax'),
    nightStartHour: g('nightStartHour'),
    waterGoal: g('waterGoal') || 2000,
  };
  await store.saveSettings(state.settings);
  renderHome();
  showToast('保存しました');
});

function renderPresetList() {
  $('#presetList').innerHTML = state.presets.map((p) => `<li>
      <div class="main"><div class="title">${p.kind === 'drink' ? '🍺 ' : ''}${esc(p.name)}${isTmp(p) ? TMP : ''}</div><div class="meta">${pfcText(sum(p.items || []))}</div></div>
      <button data-edit-preset="${p.id}">編集</button>
    </li>`).join('');
}
$('#presetList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit-preset]');
  if (!b) return;
  const p = state.presets.find((x) => x.id === b.dataset.editPreset);
  const items = (p.items || []).map((it) => `<li><div class="main"><div class="title">${esc(it.name)}${it.tmp ? TMP : ''}</div><div class="meta">${pfcText(it)}</div></div></li>`).join('');
  openSheet(`<h3>ボタンを編集</h3>
    <label>ボタンの名前<input name="name" value="${esc(p.name)}" required></label>
    <label>並び順（小さいほど前）<input name="order" inputmode="numeric" value="${p.order ?? 50}"></label>
    <p class="muted small">中身</p><ul class="list">${items}</ul>
    <button class="btn primary big" value="save">保存</button>
    <button class="btn danger" value="delete" formnovalidate>このボタンを消す</button>
    <button class="btn" value="cancel" formnovalidate>閉じる</button>`,
  (f, action) => {
    if (action === 'save') store.savePreset({ id: p.id, name: f.get('name'), order: num(f.get('order')) });
    if (action === 'delete' && confirm(`「${p.name}」を消しますか？`)) store.deletePreset(p.id);
  });
});

$('#logoutBtn').addEventListener('click', () => store.signOut());
$('#exportBtn').addEventListener('click', async () => {
  const data = await store.exportAll();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `karada-backup-${todayStr()}.json`;
  a.click();
});

// 写真を画面いっぱいに表示（タップで閉じる）
function showPhoto(src) {
  const div = document.createElement('div');
  div.className = 'photo-overlay';
  div.innerHTML = `<img src="${src}" alt="スクショ">`;
  div.addEventListener('click', () => div.remove());
  ($('#sheet').open ? $('#sheet') : document.body).appendChild(div);
}

// ---------- 共通：シートとトースト ----------
let sheetHandler = null;
function openSheet(html, onClose) {
  $('#sheetForm').innerHTML = html;
  sheetHandler = onClose;
  $('#sheet').showModal();
}
$('#sheetForm').addEventListener('submit', (e) => {
  const action = e.submitter?.value || 'save';
  const f = new FormData(e.target);
  const h = sheetHandler;
  sheetHandler = null;
  if (action !== 'cancel' && h) h(f, action);
});
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').close(); });

let toastTimer;
function showToast(text, undo) {
  $('#toastText').textContent = text;
  $('#toastUndo').hidden = !undo;
  $('#toastUndo').onclick = () => { undo(); $('#toast').hidden = true; };
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 4000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
