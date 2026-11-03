# Chrome Extension Template 開発ガイド

このリポジトリは [ClydeDz/chrome-extension-template](https://github.com/ClydeDz/chrome-extension-template) をベースにした Manifest V3 の Chrome 拡張テンプレートです。このドキュメントは、ソースコードを解析した結果をもとに、このテンプレートを使って実際の拡張機能を開発するために必要な知識をまとめたものです。

## 1. 全体構成

```
src/
├── manifest.json            # 拡張のマニフェスト（MV3）。全機能のエントリポイントを宣言する
├── background/
│   └── index.js              # Service Worker（バックグラウンドスクリプト）
├── content_scripts/
│   └── index.js              # 指定ドメインに注入されるスクリプト
├── common/
│   ├── settings.js           # Storage のキー名・初期値の定義
│   └── storage.js            # chrome.storage.sync の薄いラッパー（get/set）
├── popup/                    # ツールバーアイコンをクリックした時のポップアップ
│   ├── popup.html
│   ├── scripts/index.js
│   └── styles/{popup,_page,_variables}.scss
├── options/                  # 拡張の設定（オプション）ページ
│   ├── options.html
│   ├── scripts/index.js
│   └── styles/...
├── newtab/                   # 新しいタブを上書きするページ
│   ├── newtab.html
│   ├── scripts/index.js
│   └── styles/...
└── icons/                    # 16/48/128px のアイコン
```

ビルド後は `dist/` に以下が出力され、これを「パッケージ化されていない拡張機能」として Chrome に読み込む。

```
dist/
├── manifest.json
├── background.js
├── content_scripts.js
├── popup.html / popup.js / popup.css
├── options.html / options.js / options.css
├── newtab.html / newtab.js / newtab.css
└── icons/*.png
```

`webpack.config.js` の `entry` がこの対応関係（`src/xxx/scripts/index.js` → `dist/xxx.js`）を定義している。新しい画面やスクリプトを追加するときは、ここにエントリを追加しないと `dist` に出力されない。

## 2. manifest.json と機能の対応関係

`manifest.json` の各セクションが、使う機能のスイッチになっている。**不要な機能は、このセクションをマニフェストから削除するだけで無効化できる**（ソースファイル自体を消すかどうかは任意）。

| manifest.json のキー | 対応する機能 | 実装ファイル |
|---|---|---|
| `chrome_url_overrides.newtab` | 新しいタブページの上書き | `src/newtab/*` |
| `options_ui.page` | オプション（設定）ページ | `src/options/*` |
| `action.default_popup` | ツールバーアイコンのポップアップ | `src/popup/*` |
| `content_scripts` | 指定ドメインへのスクリプト注入（現状 `github.com`） | `src/content_scripts/index.js` |
| `background.service_worker` | バックグラウンド処理（MV3 Service Worker） | `src/background/index.js` |
| `commands` | キーボードショートカット（`turn-on`/`turn-off`/`_execute_action`） | `src/background/index.js` 内の `chrome.commands.onCommand` |
| `omnibox.keyword` | アドレスバーでのキーワード検索（`@@` と入力） | `src/background/index.js` 内の `chrome.omnibox.onInputEntered` |
| `permissions: ["storage"]` | `chrome.storage.sync` の使用権限 | `src/common/storage.js` |

一つの拡張は `chrome_url_overrides` を1種類（newtab/history/bookmarks のいずれか）しか持てない点に注意。

### 現状のデモ実装（そのまま使うと不適切なもの）

- `background/index.js`: インストール時に `https://clydedsouza.net` を開く、`turn-on`/`turn-off` でバッジ色を変える、omnibox 入力で Facebook/Twitter/Instagram を開く — これらはテンプレート作者のデモなので、実際の拡張を作る際はロジックを置き換える。
- `options.html` のフッターリンク（GitHub issue / Buy me a coffee / 作者サイト）もテンプレート由来なので、自分のリポジトリ・サポート先に変更するか削除する。
- `content_scripts.matches` が `*://github.com/*` 固定。対象サイトに応じて変更する。

## 3. 共通ストレージ層（common/）

`chrome.storage.sync` を直接呼ばず、`src/common/storage.js` のラッパーを経由する設計になっている。

```js
// common/storage.js
export const getStorage = (componentKey, callback) => {
    chrome.storage.sync.get([componentKey], function(result) {
        callback(result[componentKey]);
    });
};

export const setStorage = (componentKey, value) => {
    chrome.storage.sync.set({[componentKey]: value});
};
```

- `getStorage` はキーに対応する「値（この場合は設定オブジェクト全体）」をコールバックに渡す。値が未保存の場合は `undefined` が渡る。
- `setStorage` はキーに対して丸ごと値を書き込む（マージではない）。

`src/common/settings.js` がストレージキー名とデフォルト値を一元管理する。

```js
export const CHROME_SYNC_STORAGE_KEY = "chrome-extension-template";

export const PRESET_CONFIGURATION = {
    "storageValue": "https://clydedsouza.net",
};
```

popup / options / newtab / content_scripts のどれも、次のパターンで初期値を読み込んでいる。

```js
getStorage(CHROME_SYNC_STORAGE_KEY, (result) => {
    const savedConfiguration = result || PRESET_CONFIGURATION;
    const storageValue = savedConfiguration["storageValue"];
    // ...
});
```

**実際の拡張を作る際のポイント:**
- `CHROME_SYNC_STORAGE_KEY` の値（＝ストレージのトップレベルキー）は拡張ごとに変更すべき（現状テンプレート名のまま）。
- `PRESET_CONFIGURATION` に自分の拡張が必要とする設定項目を追加する。
- `chrome.storage.sync` は同期ストレージなので、各アイテム 8KB、合計 100KB、同期頻度などの制限がある。大きなデータは `chrome.storage.local` を検討する（その場合はラッパーを複製するか、ストレージ領域をパラメータ化する）。

テストは `src/common/storage.test.js` / `settings.test.js` にあり、`global.chrome` をモックして `chrome.storage.sync.get/set` が正しい引数で呼ばれるかを検証するスタイル。新しいストレージ関数を追加した場合も同様のモックパターンでテストを書く。

## 4. 各画面（popup / options / newtab）の実装パターン

3画面とも同じ構造で、HTML + JS(ES Modules) + SCSS の3ファイル構成。

- `popup/popup.html`: `<script src="popup.js">` と `<link href="popup.css">` を直接参照（webpack の entry 名と一致させる必要がある）。
- `scripts/index.js`: `window.onload` でストレージから設定を読み込み、画面に反映する。
- `options/scripts/index.js` だけ `setStorage` も使い、フォーム入力をボタンクリックで保存する（唯一の書き込み側の実装例）。

新しい入力項目を options ページに追加する場合の典型的な流れ：
1. `options.html` に `<input>` を追加。
2. `settings.js` の `PRESET_CONFIGURATION` にデフォルト値のキーを追加。
3. `options/scripts/index.js` の `saveConfiguration`/`loadConfiguration` に読み書きのロジックを追加。
4. 必要なら popup/newtab/content_scripts/background 側でもその設定値を参照する。

## 5. スタイル（SCSS）の構成

各画面の `styles/` フォルダは共通パターン：

```
popup.scss      → @import "./variables"; @import "./page";  （エントリポイント）
_variables.scss → SCSS変数（色・フォント）
_page.scss      → 実際のスタイル定義
```

webpack の entry に SCSS ファイルも含まれている点に注意（JSとCSSを同じエントリ名にまとめて1個の `.css` を出力させるテクニック）。

```js
"popup": ["./src/popup/scripts/index.js", "./src/popup/styles/popup.scss"],
```

ビルドパイプラインは `sass-loader → postcss-loader(autoprefixer) → css-loader → extract-loader → file-loader` の順（配列は下から上に適用される）で、最終的に `[name].css` として `dist/` に出力される。

> **既知の非推奨警告**: 現在の `@import` によるSCSS分割は Dart Sass で deprecated（将来の v3.0.0 で削除予定）。動作には影響しないが、長期的には `@use`/`@forward` への移行を検討する。

新しい画面を追加する場合、同じ3ファイル構成（`xxx.scss` / `_page.scss` / `_variables.scss`）を作り、`webpack.config.js` の `entry` と `CopyWebpackPlugin` の `patterns` にHTMLファイルを追加すること。

## 6. ビルド・開発フロー

```bash
npm install          # 依存インストール
npm run build        # webpack --watch（開発用。ファイル変更を監視して再ビルド）
npm run build:prod   # webpack --mode=production（本番用、distに最終出力）
npm test             # jest（common/ 配下のユニットテスト）
npm run test:ci      # カバレッジ付き・CI向け（jest-junit レポート出力）
```

ローカルで拡張を読み込む手順：
1. `npm run build:prod` を実行し `dist/` を生成。
2. Chrome の `chrome://extensions` を開き、デベロッパーモードを有効化。
3. 「パッケージ化されていない拡張機能を読み込む」で `dist` フォルダを選択。
4. UIを変更しながら確認する場合は `npm run build`（watch）を使い、変更後に拡張ページ（popup/options/newtab）をリロードする。background/content_scripts を変更した場合は `chrome://extensions` でその拡張を再読み込みする必要がある。

> **本テンプレートの既知の修正点（このプロジェクトで対応済み）**: 元テンプレートの `package.json` は `node-sass` を使用しており、Node.js の新しいバージョン（v18以降、特にv20/v24）ではネイティブビルドが失敗する。このリポジトリでは `node-sass` → `sass`（Dart Sass）に置き換え、また `@babel/plugin-transform-runtime` が要求する `@babel/runtime` を `dependencies` に追加済み。新しく clone したテンプレートをそのまま使う場合は同様の対応が必要になる可能性がある。
>
> `@babel/runtime` を追加する際は `@babel/plugin-transform-runtime`/`@babel/preset-env` と同じメジャーバージョン（7系）を明示的に指定すること（`npm install @babel/runtime@^7` のように）。バージョン指定なしで `npm install @babel/runtime --save` すると、npm が最新の `8.x` を解決してしまい、`async`/`await` を使うコードが `Module not found: "./regenerator" is not exported` でビルド失敗する（`@babel/runtime@8` のexportsフィールドが7系プラグインの想定と異なるため）。
>
> **Jestのテスト環境について**: Jest 27（本テンプレートが使用）はデフォルトの `testEnvironment` が `"node"`。DOM（`document`/`window`）を使うテスト（popup/options/content_scripts配下など）を書く場合は `package.json` の `"jest"` 設定に `"testEnvironment": "jsdom"` を明示する必要がある（Jest 26以前はjsdomがデフォルトだったため、バージョンの思い込みで省略すると `ReferenceError: document is not defined` になる）。

## 7. CI/CD（README記載だが本リポジトリには未配置）

オリジナルテンプレートの README では GitHub Actions ワークフローでビルド・テスト・Chrome Web Store への自動公開を行う想定が説明されているが、**現在のこのプロジェクトには `.github/workflows` が存在しない**。CI/CDを使う場合は、オリジナルテンプレートの `.github/workflows` をコピーしてくる必要がある。

必要なリポジトリシークレット：

| シークレット名 | 用途 |
|---|---|
| `CHROME_REFRESH_TOKEN` | Chrome Web Store API 認証 |
| `CHROME_CLIENT_ID` | Google API クライアントID |
| `CHROME_CLIENT_SECRET` | Google API クライアントシークレット |
| `CHROME_APP_ID` | Chrome Web Store 上の拡張ID（開発者ダッシュボードで一度アップロードして取得） |

公開を有効にするには、ワークフロー内の `publish: false` を `publish: true` に変更する。

## 8. アイコン・デザイン素材

- `src/icons/icon{16,48,128}.png` はテンプレートのプレースホルダー。実際の拡張に合わせて差し替える。
- オリジナル作者が公開している [Figma テンプレート](https://www.figma.com/community/file/1127061326249481158) をベースにデザインを作成できる（README記載）。

## 9. このテンプレートで新しい拡張を作るときのチェックリスト

- [ ] `src/manifest.json` の `name` / `description` / `version` / `author` を変更
- [ ] 使わない機能（newtab / options / popup / content_scripts / commands / omnibox）のセクションを削除し、対応する `src/` フォルダと `webpack.config.js` の entry / CopyWebpackPlugin patterns を整理
- [ ] `src/common/settings.js` の `CHROME_SYNC_STORAGE_KEY` を拡張固有の値に変更
- [ ] `src/common/settings.js` の `PRESET_CONFIGURATION` を実際に必要な設定項目に置き換え
- [ ] `src/background/index.js` のデモ実装（外部サイトへのリダイレクト、SNS連携など）を実際のロジックに置き換え
- [ ] `content_scripts.matches` を対象サイトのURLパターンに変更
- [ ] `options.html` のフッターリンク（作者サイト・Buy me a coffeeなど）を自分のプロジェクトのリンクに変更
- [ ] `src/icons/` のアイコンを差し替え
- [ ] 必要な `permissions`（`storage` 以外に `tabs`, `activeTab`, `scripting` など）を要件に応じて追加
- [ ] CI/CDを使う場合は `.github/workflows` を用意し、4つのシークレットを設定
