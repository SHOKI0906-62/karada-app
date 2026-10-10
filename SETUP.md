# 準備の手順（1回だけ）

全部で 20〜30分くらいです。パソコンがあると楽ですが、スマホでもできます。

---

## 1. GitHub（アプリを置く場所）

1. https://claude.ai/connect-github を開いて、GitHub をつなぐ（Claude がコードを送れるようにするため）
2. GitHub で新しいリポジトリ（入れ物）を作る
   - 名前：`karada-app`
   - **Public（公開）** を選ぶ
     - 無料で GitHub Pages を使うには公開が必要です
     - 公開されるのはアプリの作りだけです。食事の記録は Firebase に入り、本人しか見られません
   - 中身は空のままで OK
3. できたら「作った」と Claude に伝える → Claude がアプリを送ります
4. 送ったあと：リポジトリの **Settings → Pages** で
   - Source：`Deploy from a branch`
   - Branch：`main` / `/(root)` → Save
   - 数分で `https://（あなたのID）.github.io/karada-app/` が使えるようになります

## 2. Firebase（データを同期する場所・無料）

1. https://console.firebase.google.com を Google アカウントで開く
2. **プロジェクトを追加** → 名前は `karada` など → Google アナリティクスは「オフ」でOK
3. **ログインの準備**
   - 左上「≡」→「セキュリティ」→「Authentication」→「始める」
   - ※ Firebaseの画面に入るには、Googleアカウントの2段階認証が必要
   - 「ログイン方法」→「メール/パスワード」→ 有効にする → 保存
   - 「ユーザー」タブ →「ユーザーを追加」→ 自分のメールアドレスとパスワードを入れる
     （このメール・パスワードでアプリにログインします）
4. **データの保管庫**
   - 左上「≡」→「Database と Storage」→「Firestore」→「データベースを作成」
     （直接開くURL：https://console.firebase.google.com/project/karada-app/firestore ）
   - 場所：`asia-northeast1（東京）`（選べないときはそのままでOK）
   - 「本番環境モード」で開始
   - 「ルール」タブを開き、中身を全部消して、下をそのまま貼り付けて「公開」

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

   （「自分のデータは自分だけ読み書きできる」という鍵です）

5. **アプリの登録**
   - 左上の ⚙️ →「プロジェクトの設定」→ 下の方「マイアプリ」→ `</>`（ウェブ）を押す
   - ニックネーム `karada` → 「アプリを登録」（Hosting のチェックは不要）
   - `const firebaseConfig = { apiKey: ... }` という部分が出るので、**それをコピーして Claude に送る**
     （この値は公開されても大丈夫なものです。パスワードは送らないでください）

## 3. ホーム画面に追加

- **iPhone**：Safari でアプリのURLを開く → 下の「共有」ボタン →「ホーム画面に追加」
- **POCO Pad**：Chrome でURLを開く → 右上「︙」→「ホーム画面に追加」（または「アプリをインストール」）
- 開いたら、Firebase で作ったメール・パスワードでログイン（それぞれの端末で1回だけ）
