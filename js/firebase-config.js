// Firebase の設定。Firebaseコンソールの「プロジェクトの設定 → マイアプリ」に出てくる値を貼る。
// apiKey が空のままだと「お試しモード」（この端末だけに保存）で動く。
// ※ この値は公開されても大丈夫なもの。データは Firestore のルールで守る。
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
