# Firebase の準備（家族共有・クラウド保存用）

所要 10 分ほど。無料の Spark プランのまま使います（カードの登録は不要）。

## 1. プロジェクトを作る

1. https://console.firebase.google.com/ を Google アカウントで開き、［プロジェクトを作成］。
2. 名前は `megurikago` など。Google アナリティクスは**オフ**でよい。

## 2. 匿名ログインを有効にする

1. 左のメニュー［構築］→［Authentication］→［始める］。
2. ［ログイン方法］タブ →［匿名］を選んで**有効**にし、保存。

## 3. データベース（Firestore）を作る

1. ［構築］→［Firestore Database］→［データベースを作成］。
2. 場所は `asia-northeast1`（東京）。あとから変えられません。
3. 「本番環境モード」で作成。
4. ［ルール］タブを開き、中身をすべて消して、リポジトリの `firestore.rules` の中身を貼り付けて［公開］。

## 4. アプリを登録して設定値を受け取る

1. プロジェクトの概要（左上の歯車 →［プロジェクトの設定］）→ 下の［マイアプリ］→ **ウェブ**（`</>`）を選ぶ。
   （iOS ではなくウェブを選びます。このアプリは Firebase の JS SDK を使うため）
2. ニックネームは `megurikago`。Hosting は不要。
3. 表示される `firebaseConfig` のうち、次の 4 つを控える: `apiKey`、`authDomain`、`projectId`、`appId`。

## 5. 設定値を入れる（リポジトリには書かない）

**GitHub（.ipa のビルド用）**: リポジトリの［Settings］→［Secrets and variables］→［Actions］→［New repository secret］で 4 つ登録。

| 名前 | 値 |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | apiKey |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | authDomain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | projectId |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | appId |

**手元（Expo Go で試す用）**: リポジトリ直下に `.env.local` を作り、同じ 4 行を `名前=値` の形で書く（このファイルは Git に入りません）。

## 補足

- `apiKey` は「このプロジェクトを指す名前」で、パスワードではありません。守りはステップ 3 のルールが担います。
  それでもリポジトリには書かない運用にしています。
- 無料枠（1 日 5 万回の読み取り・2 万回の書き込み・保存 1GB）は、家族で使う分には十分です。
- ルールを変えたら、リポジトリの `firestore.rules` とコンソールの両方を同じにしてください。
