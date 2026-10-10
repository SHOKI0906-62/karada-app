// データの保存係。画面(app.js)はここの関数だけを使う。
// Firebase の設定があれば Firestore（iPhoneとタブレットで同期）、
// なければ localStorage（この端末だけ）に保存する。
//
// 保存する場所（Firestore）
//   users/{uid}/logs/{id}      … 食べた・飲んだ記録（1回の記録 = 1件）
//   users/{uid}/products/{id}  … 自分で登録した商品
//   users/{uid}/presets/{id}   … いつものボタン・晩酌ボタン
//   users/{uid}/meta/settings  … 目標値など
import { firebaseConfig } from './firebase-config.js';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS, DEFAULT_PRODUCTS } from './defaults.js';

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
export const isLocalMode = !firebaseConfig.apiKey;

let backend;

export async function initStore(onUser) {
  backend = isLocalMode ? localBackend() : await firebaseBackend();
  backend.onUser(async (user) => {
    if (user) await seedIfEmpty();
    onUser(user);
  });
}

export const signIn = (email, pw) => backend.signIn(email, pw);
export const signOut = () => backend.signOut();
export const watchLogs = (date, cb) => backend.watch('logs', cb, ['date', date]);
export const watchProducts = (cb) => backend.watch('products', cb);
export const watchPresets = (cb) => backend.watch('presets', cb);
export const addLog = (log) => backend.add('logs', { ...log, ts: Date.now() });
export const updateLog = (id, data) => backend.update('logs', id, data);
export const deleteLog = (id) => backend.remove('logs', id);
export const saveProduct = (p) => (p.id ? backend.update('products', p.id, strip(p)) : backend.add('products', p));
export const deleteProduct = (id) => backend.remove('products', id);
export const savePreset = (p) => (p.id ? backend.update('presets', p.id, strip(p)) : backend.add('presets', p));
export const deletePreset = (id) => backend.remove('presets', id);
export async function getSettings() {
  let saved = null;
  try { saved = await backend.getMeta('settings'); } catch { /* 電波なし → 初期値で表示 */ }
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}
export const saveSettings = (s) => backend.setMeta('settings', s);
export const exportAll = () => backend.exportAll();

function strip(obj) {
  const { id, ...rest } = obj;
  return rest;
}

// 初めて使うときに、いつものボタンと商品を入れておく
async function seedIfEmpty() {
  let meta;
  try { meta = (await backend.getMeta('seed')) || {}; } catch { return; } // 電波なしのときは次回に
  if (meta.done) return;
  for (const p of DEFAULT_PRESETS) await backend.add('presets', p);
  for (const p of DEFAULT_PRODUCTS) await backend.add('products', p);
  await backend.setMeta('seed', { done: true });
}

// ---------- お試しモード（localStorage） ----------
function localBackend() {
  const KEY = 'karada-v1';
  const listeners = [];
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  let db = load();
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(db));
    listeners.forEach((l) => l());
  };
  const col = (name) => (db[name] ||= {});
  const list = (name, filter) =>
    Object.entries(col(name))
      .map(([id, v]) => ({ id, ...v }))
      .filter((d) => !filter || d[filter[0]] === filter[1]);

  return {
    onUser(cb) { cb({ email: 'お試しモード', local: true }); },
    async signIn() {},
    async signOut() {},
    watch(name, cb, filter) {
      const run = () => cb(list(name, filter));
      listeners.push(run);
      run();
      return () => listeners.splice(listeners.indexOf(run), 1);
    },
    async add(name, data) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      col(name)[id] = data;
      save();
      return id;
    },
    async update(name, id, data) { col(name)[id] = { ...col(name)[id], ...data }; save(); },
    async remove(name, id) { delete col(name)[id]; save(); },
    async getMeta(key) { return col('meta')[key]; },
    async setMeta(key, val) { col('meta')[key] = val; save(); },
    async exportAll() { return db; },
  };
}

// ---------- Firebase（Firestore） ----------
async function firebaseBackend() {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const auth$ = await import(FB + 'firebase-auth.js');
  const fs = await import(FB + 'firebase-firestore.js');

  const app = initializeApp(firebaseConfig);
  const auth = auth$.getAuth(app);
  // 電波がなくても記録できて、つながったら自動で同期される設定
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  let uid = null;
  const colRef = (name) => fs.collection(db, 'users', uid, name);
  const metaRef = (key) => fs.doc(db, 'users', uid, 'meta', key);

  return {
    onUser(cb) {
      auth$.onAuthStateChanged(auth, (u) => {
        uid = u ? u.uid : null;
        cb(u ? { email: u.email } : null);
      });
    },
    signIn: (email, pw) => auth$.signInWithEmailAndPassword(auth, email, pw),
    signOut: () => auth$.signOut(auth),
    watch(name, cb, filter) {
      const q = filter ? fs.query(colRef(name), fs.where(filter[0], '==', filter[1])) : colRef(name);
      return fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    // オフラインでも待たずに進めるよう、書き込みは完了を待たない
    async add(name, data) {
      const ref = fs.doc(colRef(name));
      fs.setDoc(ref, data);
      return ref.id;
    },
    async update(name, id, data) { fs.updateDoc(fs.doc(colRef(name), id), data); },
    async remove(name, id) { fs.deleteDoc(fs.doc(colRef(name), id)); },
    async getMeta(key) {
      const s = await fs.getDoc(metaRef(key));
      return s.exists() ? s.data() : null;
    },
    async setMeta(key, val) { await fs.setDoc(metaRef(key), val); },
    async exportAll() {
      const out = {};
      for (const name of ['logs', 'products', 'presets']) {
        const snap = await fs.getDocs(colRef(name));
        out[name] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
      }
      out.meta = { settings: await this.getMeta('settings') };
      return out;
    },
  };
}
