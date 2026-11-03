# JobHunter

求人応募フォームへプロフィール・応募内容を自動入力し、オプションでLLM（Claude）による自由記述の入力支援を行う Chrome 拡張機能。

- テンプレートの構造・各機能とソースの対応関係: [docs/GUIDE.md](./docs/GUIDE.md)
- 本拡張の設計書: [docs/SPEC.md](./docs/SPEC.md)

## 開発

```bash
npm install
npm run build        # 開発用（watch）
npm run build:prod   # 本番ビルド（dist/ に出力）
npm test
```

`dist/` フォルダを `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で読み込む。
