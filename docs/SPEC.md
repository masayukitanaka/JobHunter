# JobHunter 拡張機能 設計書

## 1. 概要

### 1.1 目的
求人応募フォーム（ATSフォーム）の入力項目に、事前に登録したプロフィール・応募内容を自動入力することで、応募作業の手間を削減する Chrome 拡張機能。オプションで LLM（Claude）API キーを設定すると、求人の Job Description と自由記述の設問文を読み取り、回答文をその場で生成して入力支援する。

### 1.2 スコープ
- 対象フォーム: 下記3層のフォールバック戦略で検出する（詳細は4章）。
  1. 主要ATS（Workday, Greenhouse, Lever, iCIMS など）向けの専用セレクタ
  2. ユーザーが明示的に追加した特定サイト向けのカスタムマッピング
  3. 上記でマッチしない場合のヒューリスティックな汎用フォーム検出
- データ保存: `chrome.storage.local`（容量制限が緩く、外部送信しないため選択。[GUIDE.md](./GUIDE.md) の共通ストレージ層パターンを踏襲）。
- LLM: Anthropic Claude API のみを対象（マルチプロバイダ対応は将来拡張とし、インターフェースはプロバイダ非依存に設計しておく）。
- 自動入力の発火: ツールバーアイコン／popup の「このページに自動入力」ボタンによる**手動発火のみ**。フォーム検出時の自動実行は行わない。
- AI回答生成: 自由記述の設問欄ごとに表示される「AIで作成」ボタンをユーザーが押した時のみ、個別にAPIを呼び出す。一括生成は行わない。

### 1.3 非スコープ（将来拡張の可能性があるが、本設計では扱わない）
- 複数LLMプロバイダの切り替え
- 応募履行の自動送信（送信ボタンのクリックは絶対に行わない。入力まで）
- フォーム検出時の自動実行、設問一括AI生成
- サーバーサイド・クラウド同期（`chrome.storage.sync` は容量制限のため使わない）
- 複数プロフィール（職種別の応募パターン切り替えなど）は v1 では単一プロフィールのみ

## 2. 全体アーキテクチャ

[GUIDE.md](./GUIDE.md) で整理したテンプレートの構成に従い、以下のコンポーネントで構成する。

```
src/
├── manifest.json
├── background/
│   └── index.js                 # メッセージルーティング、LLM API呼び出しの中継
├── content_scripts/
│   ├── index.js                 # エントリポイント：フォーム検出＋自動入力実行
│   ├── detectors/
│   │   ├── index.js             # 検出戦略のディスパッチャ
│   │   ├── ats-adapters.js      # Workday/Greenhouse/Lever/iCIMS 等の専用セレクタ定義
│   │   ├── custom-site-map.js   # ユーザー定義のサイト別マッピングを読み込む
│   │   └── heuristic.js         # 汎用ヒューリスティック検出
│   ├── fillers/
│   │   ├── field-filler.js      # DOMへの値設定（input/select/textarea/contenteditable対応）
│   │   └── ai-assist-button.js  # 自由記述欄に「AIで作成」ボタンを注入するUI
│   └── overlay.js               # 実行結果（成功/未入力件数）を知らせるトースト表示
├── common/
│   ├── settings.js              # ストレージキー定義・デフォルト値
│   ├── storage.js                # chrome.storage.local ラッパー（get/set/remove）
│   ├── profile-schema.js        # プロフィール/応募内容データモデルの定義とバリデーション
│   ├── messaging.js             # background⇄content_script 間のメッセージ型定義
│   └── llm/
│       ├── client.js            # LLMクライアントの抽象インターフェース
│       └── anthropic-client.js  # Anthropic Messages API 実装
├── popup/                        # ツールバーアイコンのポップアップ：実行トリガーと簡易ステータス
├── options/                      # プロフィール編集・API Key設定・サイトマッピング管理
└── icons/
```

### 2.1 データフロー概要

```
┌─────────────┐  1. ボタン押下  ┌──────────────────┐
│ popup/action │ ───────────────▶│ content_scripts  │
└─────────────┘                  │ (対象タブに実行)  │
                                  └────────┬──────────┘
                                           │ 2. フォーム検出
                                           ▼
                                  ┌──────────────────┐
                                  │ detectors/*       │  ATS→custom→heuristic
                                  └────────┬──────────┘
                                           │ 3. フィールド⇄プロフィール項目マッピング
                                           ▼
                                  ┌──────────────────┐      4. 値取得
                                  │ common/storage.js │◀────────────────┐
                                  └────────┬──────────┘                 │
                                           │ 5. DOM入力                  │
                                           ▼                            │
                                  ┌──────────────────┐                 │
                                  │ field-filler.js    │                 │
                                  └────────────────────┘                 │
                                                                          │
  自由記述欄の「AIで作成」クリック時 ─────────────────────────────────────┘
       │
       ▼
┌──────────────────┐  sendMessage  ┌──────────────────┐  fetch   ┌───────────────┐
│ ai-assist-button  │──────────────▶│ background/index  │─────────▶│ Anthropic API  │
└──────────────────┘               └──────────────────┘          └───────────────┘
       ▲                                     │ レスポンス
       └─────────────────────────────────────┘
```

**設計上の重要な制約:** content script は `manifest.json` の `host_permissions` で許可されたオリジンでしか動作せず、かつ Content Security Policy の関係で外部APIへの `fetch` は **background（Service Worker）側で行う**。content script は background にメッセージを送り、結果を受け取るだけにする。API キーも content script には渡さず、background 内（storageから読み出し）に閉じる。

## 3. データモデル

### 3.1 ストレージキー構成（`chrome.storage.local`）

`common/settings.js` に以下を定義する。

```js
export const STORAGE_KEYS = {
  PROFILE: "jobhunter.profile",            // プロフィール本体
  LLM_CONFIG: "jobhunter.llmConfig",       // APIキー・モデル設定
  SITE_MAP: "jobhunter.customSiteMap",     // ユーザー定義サイトマッピング
  RUN_LOG: "jobhunter.lastRunLog",         // 直近の自動入力実行結果（デバッグ・UI表示用）
};
```

### 3.2 プロフィールスキーマ（`common/profile-schema.js`）

ATSフォームでよく要求される項目を中心に、キー・値のフラットな構造＋繰り返し項目（経歴・学歴）を持つ。

```js
export const DEFAULT_PROFILE = {
  personal: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    region: "",       // 都道府県/州
    postalCode: "",
    country: "",
    linkedinUrl: "",
    portfolioUrl: "",
    githubUrl: "",
  },
  workAuthorization: {
    isAuthorizedToWork: null,     // true/false/null(未設定)
    requiresSponsorship: null,
  },
  experiences: [
    // { company, title, startDate, endDate, isCurrent, description }
  ],
  education: [
    // { school, degree, fieldOfStudy, startDate, endDate }
  ],
  skills: [], // string[]
  resumeFileRef: null,       // 7.4節参照：File System Access経由の参照情報（Blobは保存しない）
  coverLetterTemplate: "",   // 自由記述のデフォルト文面（AI未使用時のフォールバック）
  essayAnswers: {
    // 過去に使った設問文と回答のキャッシュ（キー=設問文のハッシュ、再利用・学習用）
    // [questionHash]: { question, answer, updatedAt }
  },
};
```

- バリデーションは「保存をブロックする」ものではなく、未入力項目をオプションページ上に警告表示する程度に留める（応募フォームによって必須項目が異なるため）。
- `essayAnswers` は、同一または類似の設問に過去の回答を再利用できるようにするための軽量キャッシュ。完全一致のみをまず対象とする（類似度マッチは将来拡張）。

### 3.3 LLM設定スキーマ

```js
export const DEFAULT_LLM_CONFIG = {
  enabled: false,         // APIキー未設定時は機能自体を非表示にする
  provider: "anthropic",  // 将来の多プロバイダ化に備え固定値として保持
  apiKey: "",             // storage.local にのみ保存。他コンポーネントに平文で渡さない
  model: "claude-sonnet-5",
  maxOutputTokens: 1024,
};
```

**セキュリティ上の注意**: APIキーは `chrome.storage.local` に保存する。Chromeのストレージ自体は平文だが、拡張外からはアクセスできない。オプション画面では入力欄を `type="password"` にし、マスク表示＋「表示」トグルを用意する。APIキーをログ（`console.log`）に出力しない。

### 3.4 サイトマッピングスキーマ（カスタムサイト対応）

```js
// customSiteMap: { [hostname]: SiteMapping }
// SiteMapping = {
//   fieldMappings: [
//     { selector: "#firstName", profilePath: "personal.firstName" },
//     { selector: "textarea[name='coverLetter']", profilePath: "coverLetterTemplate", aiAssist: true }
//   ]
// }
```
ユーザーがオプション画面で「このサイト用のセレクタを追加」した内容を保存する（7.3節のUIで作成）。

## 4. フォーム検出戦略（3層フォールバック）

`content_scripts/detectors/index.js` が以下の順でディスパッチする。

```js
export async function detectFields(document, hostname) {
  const atsResult = detectViaAtsAdapter(document, hostname);
  if (atsResult.length) return { strategy: "ats", fields: atsResult };

  const customResult = await detectViaCustomSiteMap(document, hostname);
  if (customResult.length) return { strategy: "custom", fields: customResult };

  const heuristicResult = detectViaHeuristic(document);
  return { strategy: "heuristic", fields: heuristicResult };
}
```

各検出関数は共通の `FieldMatch` 形式を返す。

```ts
type FieldMatch = {
  element: HTMLElement;         // 入力対象のDOM要素
  profilePath: string | null;   // "personal.email" のようなドット区切りパス。不明ならnull
  fieldKind: "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "contenteditable";
  isFreeTextEssay: boolean;     // AIアシストボタンを出すかどうかの判定に使う
  confidence: "high" | "medium" | "low"; // heuristic検出の信頼度。lowはUIで強調しユーザー確認を促す
};
```

### 4.1 ATSアダプタ（`ats-adapters.js`）

既知のATSをホスト名で判定し、既知のDOM構造・`name`/`autocomplete`属性・`data-automation-id`（Workday）などの専用セレクタ辞書を適用する。

```js
export const ATS_ADAPTERS = {
  "myworkdayjobs.com": {
    matcher: (hostname) => hostname.includes("myworkdayjobs.com"),
    fieldMap: [
      { selector: '[data-automation-id="legalNameSection_firstName"] input', profilePath: "personal.firstName" },
      { selector: '[data-automation-id="email"] input', profilePath: "personal.email" },
      // ...
    ],
  },
  "greenhouse.io": {
    matcher: (hostname) => hostname.includes("greenhouse.io") || hostname.includes("boards.greenhouse.io"),
    fieldMap: [
      { selector: '#first_name', profilePath: "personal.firstName" },
      { selector: '#last_name', profilePath: "personal.lastName" },
      { selector: '#email', profilePath: "personal.email" },
      // ...
    ],
  },
  "lever.co": { /* 同様 */ },
  "icims.com": { /* 同様 */ },
};
```

> 実装時の注意: ATSベンダーはA/Bテストや画面リニューアルでDOM構造を変更することがある。アダプタは「セレクタが見つからなければ静かにスキップし、heuristicにフォールバック」はしない（ATS判定されたら専用マップのみを使い、見つからない項目は「未入力」として報告する）。これにより誤爆（違う項目に値を入れる）を防ぐ。

### 4.2 カスタムサイトマッピング（`custom-site-map.js`）

`STORAGE_KEYS.SITE_MAP` から現在の `hostname` に対応する設定を読み込み、セレクタに一致する要素へ `profilePath` を割り当てる。ユーザーがオプション画面で「このサイトの入力欄を記録する」操作（7.3節）をした結果がここに保存される。

### 4.3 ヒューリスティック検出（`heuristic.js`）

ATS判定もカスタムマッピングも無い場合のフォールバック。以下の優先順位で `<input>`, `<textarea>`, `<select>` を走査し `profilePath` を推測する。

1. `autocomplete` 属性（`given-name`, `family-name`, `email`, `tel`, `street-address` など） — HTML標準に基づくため最も信頼度が高い（`confidence: "high"`）。
2. `name` / `id` 属性の文字列マッチ（正規化して `firstname`, `first_name`, `fname` などの表記ゆれを吸収）。
3. 関連する `<label>` のテキスト内容（`for`属性または包含関係で紐付け）をキーワード辞書と照合。
4. `placeholder` 属性のキーワード照合（最も信頼度が低い `confidence: "low"`）。

自由記述の設問（`isFreeTextEssay: true`）の判定は、`<textarea>` または `contenteditable` 要素で、かつ上記のどのプロフィールフィールドにもマッチしなかった場合に true とする。これが「AIで作成」ボタンの表示対象になる。

キーワード辞書は `heuristic.js` 内に日英対応で保持する（対象ユーザーが日本語・英語のATS両方を使う前提）。

```js
const FIELD_KEYWORDS = {
  "personal.firstName": ["first name", "given name", "名", "姓名"],
  "personal.lastName": ["last name", "family name", "surname", "姓"],
  "personal.email": ["email", "e-mail", "メール"],
  "personal.phone": ["phone", "mobile", "電話"],
  // ...
};
```

## 5. フィールド入力ロジック（`fillers/field-filler.js`)

### 5.1 入力実行

```js
export function fillField(fieldMatch, value) {
  const { element, fieldKind } = fieldMatch;
  switch (fieldKind) {
    case "text":
    case "textarea":
      setNativeInputValue(element, value);  // Reactなどのcontrolled componentに対応
      break;
    case "select":
      selectOptionByText(element, value);
      break;
    case "radio":
    case "checkbox":
      setCheckedByLabelText(element, value);
      break;
    case "contenteditable":
      element.innerText = value;
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
      break;
    case "file":
      // 7.4節: ファイル入力はセキュリティ上JSから直接セットできないため、
      // ハイライト表示してユーザーに手動アップロードを促すのみ
      highlightForManualAction(element, "レジュメファイルを選択してください");
      break;
  }
}
```

**重要な実装ポイント**: Greenhouse や Workday など多くのATSは React/Vue ベースの SPA で、`element.value = x` だけでは内部の状態管理に反映されない。`Object.getOwnPropertyDescriptor` でネイティブの value setter を取得してから `input`/`change` イベントを発火させる、以下のような定石パターンを使う。

```js
function setNativeInputValue(element, value) {
  const proto = element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
  nativeSetter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
```

### 5.2 実行結果の報告（`overlay.js`）

自動入力完了後、画面右下にトースト通知を表示する。

- 「◯件自動入力しました（ATS: Greenhouse）」
- 「△件は確認が必要です（信頼度low、または未マッチ）」— 該当フィールドに黄色の枠線をCSSで付与し、ユーザーが目視確認しやすくする。
- ファイルアップロード欄がある場合は「レジュメは手動でアップロードしてください」を常に表示（5.1節の制約）。

結果は `STORAGE_KEYS.RUN_LOG` に保存し、popup を開いた際に直近の実行結果を表示できるようにする。

## 6. LLM入力支援機能

### 6.1 トリガーとUI注入（`ai-assist-button.js`)

`detectFields` の結果で `isFreeTextEssay: true` と判定された要素ごとに、直後に小さな「✨ AIで作成」ボタンをDOM注入する。LLM設定（`LLM_CONFIG.enabled`）が false の場合はボタン自体を注入しない。

```js
function injectAiAssistButton(fieldMatch) {
  const button = document.createElement("button");
  button.textContent = "✨ AIで作成";
  button.className = "jobhunter-ai-assist-btn";
  button.type = "button";
  button.addEventListener("click", () => handleAiAssistClick(fieldMatch, button));
  fieldMatch.element.insertAdjacentElement("afterend", button);
}
```

ボタンはページのCSSに影響されないよう、インラインスタイルまたは `all: initial` を起点にしたスコープ付きクラスで最低限の視認性を確保する。

### 6.2 コンテキスト収集

ボタン押下時、以下の情報を収集してプロンプトを組み立てる。

1. **設問文**: 対象 `<textarea>` に紐付く `<label>` テキスト、または直前の見出し・説明文（DOM上の近傍テキストを抽出）。
2. **Job Description**: ページ内でJD本文らしきブロックを抽出するヒューリスティック（`detectors/heuristic.js` と同様の優先順位：`[data-automation-id="jobPostingDescription"]` 等ATS既知セレクタ → `<meta name="description">` → 本文中の最大テキストブロック）。JD取得は自動入力実行時に一度だけ行い、`content_scripts` 内のメモリに保持してボタンごとの再抽出を避ける。
3. **プロフィール**: `experiences` / `skills` / `coverLetterTemplate` など関連しそうな情報をプロフィールから抜粋。

```js
async function handleAiAssistClick(fieldMatch, button) {
  button.disabled = true;
  button.textContent = "生成中…";
  try {
    const context = {
      question: extractQuestionText(fieldMatch.element),
      jobDescription: getCachedJobDescription(),
      profile: await getStorage(STORAGE_KEYS.PROFILE),
    };
    const answer = await requestAiAnswer(context); // background へメッセージ送信
    fillField(fieldMatch, answer);
  } catch (err) {
    showInlineError(button, err);
  } finally {
    button.disabled = false;
    button.textContent = "✨ AIで作成";
  }
}
```

### 6.3 background側のLLM呼び出し（`common/llm/anthropic-client.js`)

```js
export async function generateAnswer({ question, jobDescription, profile }, llmConfig) {
  const systemPrompt = buildSystemPrompt(profile);
  const userPrompt = buildUserPrompt({ question, jobDescription });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": llmConfig.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: llmConfig.model,
      max_tokens: llmConfig.maxOutputTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new LlmApiError(response.status, await response.text());
  }
  const data = await response.json();
  return data.content[0].text;
}
```

`buildSystemPrompt` はプロフィールの経歴・スキルを要約し「あなたは応募者本人として、一次情報に基づいて誠実に回答する」旨を指示する。事実と異なる誇張をしないよう、プロフィールに無い情報は推測せず「〜については経験があります」など一般化せず曖昧にしないトーンを指示する（ハルシネーション対策として、プロンプトに「profile に記載のない実績は創作しない」旨を明記）。

### 6.4 メッセージング（`common/messaging.js`)

content script は直接 `fetch` せず、`chrome.runtime.sendMessage` で background に依頼する。

```js
export const MESSAGE_TYPES = {
  GENERATE_AI_ANSWER: "GENERATE_AI_ANSWER",
};

// content_scripts側
export function requestAiAnswer(context) {
  return chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GENERATE_AI_ANSWER, payload: context });
}
```

```js
// background/index.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.GENERATE_AI_ANSWER) {
    handleGenerateAiAnswer(message.payload).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true; // 非同期応答を待つ
  }
});
```

### 6.5 エラーハンドリングとコスト対策

- APIキー未設定時: ボタン自体を表示しない（6.1節）。
- APIエラー（401/429/5xx）: ボタン直下に小さく赤文字でエラー内容を表示し、再試行可能にする。429（レート制限）の場合は一定時間ボタンを無効化。
- 生成結果は即座にフィールドへ反映するが、**上書き前に既存入力があれば確認ダイアログは出さず、生成前の値を一時変数に保持し「元に戻す」リンクをトーストに添える**（LLM誤生成からのリカバリ）。
- コスト管理のため、1回のクリック＝1回のAPI呼び出しに限定し、自動リトライは行わない。

## 7. 画面構成

### 7.1 Popup（`popup/`）

アクションアイコンクリックで開く軽量UI。

```
┌───────────────────────────────┐
│ JobHunter                      │
├───────────────────────────────┤
│ [このページに自動入力]          │  ← アクティブタブへメッセージ送信
│                                 │
│ 直近の実行結果:                 │
│  ✓ 8件入力 / ⚠ 2件要確認        │
│  (Workday として検出)           │
│                                 │
│ プロフィール: 設定済み ✓        │
│ LLM連携: 有効 ✓ (または 未設定) │
│                                 │
│ [プロフィールを編集]            │ → options.html を開く
└───────────────────────────────┘
```

ロジック: `chrome.tabs.query({ active: true, currentWindow: true })` で現在タブを取得し、`chrome.tabs.sendMessage(tabId, { type: "RUN_AUTOFILL" })` を送信。content script 側はこのメッセージを受けて 4〜5章の処理を実行する。

### 7.2 Options — プロフィール編集

タブ切り替え構成（SPA的にJSでセクション切り替え、ビルドは単一 `options.html` のまま）。

1. **基本情報タブ**: `personal.*` の入力フォーム。
2. **経歴・学歴タブ**: `experiences[]` / `education[]` の動的追加・削除UI（「+ 経歴を追加」ボタンで行を増やす）。
3. **スキル・自由記述タブ**: `skills[]`（タグ入力）、`coverLetterTemplate`。
4. **保存/読込**: JSON形式でのエクスポート・インポートボタン（他PCへの移行、バックアップ用途。storage.localはプロファイル同期されないため重要）。

### 7.3 Options — サイトマッピング管理

ヒューリスティック検出で精度が低かったサイトについて、ユーザーが手動でセレクタとプロフィール項目を紐付けられる簡易UI。

- 「現在開いているタブからフィールドを選択」方式: options ページから対象タブに一時的な「要素ピッカー」content scriptを注入し、ユーザーがクリックした要素のセレクタを自動生成（`id` > `name` > `data-*属性` > 構造的セレクタの優先順位で生成）。
- 選択した要素に対し、プロフィール項目をドロップダウンで割り当てて保存 → `STORAGE_KEYS.SITE_MAP` に追記。

> v1では最小実装として、この要素ピッカーUIは「あれば望ましい」機能とし、無い場合はJSONを直接編集するテキストエリアでの代替も許容する（実装コスト対効果で判断）。

### 7.4 Options — LLM設定

- プロバイダ: Anthropic固定（表示のみ、将来のための項目として残す）。
- APIキー入力欄（`type="password"`、表示トグル付き）。
- モデル選択（デフォルト `claude-sonnet-5`、ドロップダウンで変更可）。
- 「接続テスト」ボタン: 軽量なプロンプトで1回APIを呼び、成功/失敗を表示（キーの有効性確認、誤入力の早期検出）。

### 7.5 レジュメファイルの扱い（補足）

ブラウザのセキュリティ制約上、JavaScriptから `<input type="file">` に任意のファイルをプログラム的にセットすることはできない（ユーザー操作によるファイル選択が必須）。そのため本拡張では:

- プロフィールに「レジュメファイル名」などの参照メモ（`resumeFileRef`）のみを保持し、自動入力時はファイル欄を黄色くハイライトして「このファイルを選択してください: resume_2024.pdf」とガイダンスを出す。
- ファイルの中身自体を拡張が保持・送信することはない（LLMにもレジュメ全文は送らず、プロフィールの構造化データのみを渡す。6.3節）。

## 8. manifest.json 差分（GUIDE.mdのテンプレートからの変更点）

```json
{
  "manifest_version": 3,
  "name": "JobHunter",
  "description": "求人応募フォームへの自動入力とAI入力支援",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://*.myworkdayjobs.com/*",
    "https://boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://*.icims.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "JobHunter: このページに自動入力"
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
  "background": {
    "service_worker": "background.js"
  }
}
```

テンプレートからの変更点まとめ:
- `chrome_url_overrides`（newtab）、`omnibox`、`commands` は本拡張の要件に無いため削除。
- `content_scripts` の静的宣言は**使わず**、`activeTab` + `scripting.executeScript` によるオンデマンド注入に変更する（popup の「自動入力」ボタン押下時にだけ対象タブにスクリプトを注入する設計。4大ATS以外の汎用フォームにも対応するため、全URLに対して常時content scriptを走らせるのではなく、ユーザーが明示的に起動した時だけ動かすことで無駄なDOM走査・パフォーマンス影響を避ける）。
- `host_permissions` は既知ATSドメインに限定して宣言し、汎用ヒューリスティック検出のためにそれ以外のサイトで動かす場合は `activeTab` 権限（ユーザーがアクションを起動したタブに対してのみ一時的に許可される権限）で対応する。これにより、インストール時に要求する権限を最小化できる（Chrome Web Store審査・ユーザーの信頼性の観点で重要）。
- `permissions` に `scripting` を追加（`chrome.scripting.executeScript` 用）。

## 9. 共通コンポーネントの再利用・拡張（GUIDE.mdとの対応）

| GUIDE.mdのテンプレート機能 | 本拡張での扱い |
|---|---|
| `common/storage.js`（sync版） | `chrome.storage.local` 版に書き換え。関数シグネチャ（`getStorage`/`setStorage`）は維持し、呼び出し側の変更を最小化 |
| `common/settings.js` | `STORAGE_KEYS` と `DEFAULT_PROFILE` 等を本拡張用に全面差し替え |
| `background/index.js` のデモ実装 | 全削除。LLMメッセージハンドラ（6.4節）に置き換え |
| `content_scripts/index.js` のデモ実装 | 全削除。フォーム検出＋自動入力のエントリポイントに置き換え |
| `popup/` のデモ実装 | 自動入力トリガーUIに置き換え（7.1節） |
| `options/` のデモ実装 | プロフィール編集・サイトマッピング・LLM設定の3セクションに拡張（7.2〜7.4節） |
| `newtab/` | 本拡張では不要。フォルダ・manifestエントリ・webpack entryを削除 |
| SCSS構成（`_variables.scss`/`_page.scss`） | 構成パターンは維持。色・フォントなど変数を本拡張のブランドに合わせて変更 |

## 10. テスト方針

[GUIDE.md](./GUIDE.md) のJest構成を踏襲し、`common/` 配下は既存同様ユニットテスト対象とする。加えて以下を追加する。

- `common/profile-schema.js`: バリデーション関数のテスト。
- `common/llm/anthropic-client.js`: `fetch` をモックしたリクエスト/レスポンス整形のテスト。
- `content_scripts/detectors/heuristic.js`: jsdom上に典型的なフォームHTMLを構築し、`autocomplete`/`name`/`label`それぞれの検出パスを個別にテスト。
- `fillers/field-filler.js`: jsdomのネイティブsetter経由での値設定が、擬似Reactコンポーネント（valueをstateで上書きするモック）でも反映されるかを確認するテスト。
- ATSアダプタ（`ats-adapters.js`）は実際のATS DOM構造のスナップショット（HTML fixture）を用いた統合テストとし、ATS側のUI変更を検知できるようにする（fixtureは手動で定期更新が必要）。

E2E（実際のATSサイトでの動作確認）は自動化が難しいため、手動テストチェックリストをQA用に別途用意する（本設計書の範囲外）。

## 11. 既知のリスク・制約

- **ATS DOM変更への追従**: ベンダー側のUI変更でセレクタが失効するリスクが常にある。アダプタのセレクタは定期的なメンテナンスが必要（4.1節）。
- **誤情報生成（ハルシネーション）**: LLM生成文はプロフィールに基づく指示を入れても完全には防げない。ユーザーに生成結果を必ず目視確認する前提のUI（生成後も通常の編集可能なテキストフィールドのまま）とする。
- **APIコスト**: ユーザー自身のAPIキーを使うため拡張側の運営コストは無いが、誤って多数のフィールドでボタンを連打すると想定外の課金が発生し得る。popup上にAPI使用量の目安（トークン数ベースの概算）を表示する機能は将来拡張とする。
- **Chrome Web Store審査**: `host_permissions` でATSドメインを指定し、`activeTab` で汎用サイトに対応する設計のため、広範な`<all_urls>`権限は要求しない方針（審査通過率・ユーザー信頼性の観点で有利）。
