# FediDeck - GitHub Copilot Instructions

## プロジェクト概要

FediDeckはReact、TypeScript、Vite、Zustandで構築されたマルチカラムMastodon/Fediverseクライアント。TweetDeckスタイルのインターフェースを提供し、複数のアカウントとインスタンスにわたる複数のタイムラインを監視できる。

## レビューに関して

レビューする際には、以下のprefix(接頭辞)を付けましょう。  
また、レビューコメントは日本語で書いてください。

<!-- for GitHub Copilot review rule -->

[must] → かならず変更  
[imo] → 自分の意見だとこうだけど修正必須ではない(in my opinion)  
[nits] → ささいな指摘(nitpick)  
[ask] → 質問  
[fyi] → 参考情報

<!-- for GitHub Copilot review rule-->

## 開発コマンド

```bash
# 開発
npm run dev           # Vite開発サーバー起動（HMR付き）

# ビルド
npm run build         # TypeScript コンパイル + Viteビルド

# テスト
npm run test          # Vitest ウォッチモード
npm run test:run      # テスト1回実行（CIモード）
npm run test:ui       # Vitest UI付きテスト

# Lint
npm run lint          # ESLintチェック

# フォーマット
npm run format        # Prettierでフォーマット
npm run format:check  # フォーマットチェックのみ

# Git Hooks
npm run prepare       # Husky git hooksセットアップ（インストール時自動実行）
```

## コードスタイル

### Auto-Formatting

Prettier + Husky + lint-stagedによる自動フォーマット:

- Pre-commitフックがステージングされたTypeScript/TSX/JS/JSXファイルを自動フォーマット
- 手動フォーマット: `npm run format`
- チェックのみ: `npm run format:check`

### スタイル規定（`.prettierrc`参照）

- **インデント**: 4スペース
- **クォート**: シングルクォート
- **セミコロン**: 必須
- **トレーリングカンマ**: ES5互換
- **行幅**: 100文字

## アーキテクチャ

### ステート管理（Zustand）

`src/store/`に3つのコアストア:

- **`accounts.ts`** - ログインアカウントのセッション管理。セッションID形式: `${accountId}@${instanceUrl.hostname}`。localStorageに永続化。
- **`columns.ts`** - カラム設定（タイプ、アカウント、パラメータ）。各カラムはアカウントセッションを参照。localStorageに永続化。
- **`streams.ts`** - ランタイムタイムライン/通知データ。ストリームキー形式: `accountId:streamType` または `accountId:streamType:param`。永続化なし。

### マルチアカウントアーキテクチャ

各アカウントセッションは独自のアクセストークンとインスタンスURLを持つ。カラムは`accountId`経由で特定アカウントにバインドされる。サイドバーに表示されるアクティブアカウントはカラム所有権とは別 - カラム内の操作はそのカラムのアカウントを使用。

### Mastodon APIレイヤー（`src/api/`）

- **`mastoClient.ts`** - `masto`ライブラリを使用したREST APIラッパー。`instanceUrl:accountId`でクライアントをキャッシュ。タイムライン取得、ステータスアクション（お気に入り/ブースト）、メディアアップロードを処理。
- **`streamingClient.ts`** - リアルタイム更新用のカスタムWebSocketクライアント。React互換性のためイベントコールバックを使用（masto.jsの非同期イテレータではなく）。指数バックオフで自動再接続。

### ストリーミングアーキテクチャ（`src/streaming/`）

**`streamManager.ts`** はアカウントごとに1つのWebSocket接続を維持:

- ユーザーストリーム購読はホームタイムラインと通知の両方をカバー
- リスト/ハッシュタグストリームは別の購読
- ページ表示変更時に再接続
- ストリームストアを呼び出して新しいステータス/通知を先頭に追加

### UIコンポーネント階層

```
App.tsx
├── Sidebar (アカウントリスト、投稿ボタン)
├── ColumnContainer
│   └── Column[] (320px固定幅、水平スクロール)
│       ├── StatusCard[] / NotificationCard[]
│       └── IntersectionObserverによる無限スクロール
├── LoginModal (OAuth OOBフロー)
├── AddColumnModal (アカウント + ストリームタイプ選択)
└── ComposeModal (新規投稿用アカウントセレクタ、返信時はロック)
```

### 認証フロー

`src/auth/`でのOAuth 2.0 Out-of-Band (OOB)フロー:

1. `registerApp()` - インスタンスにアプリを作成（ドメインごとにlocalStorageにキャッシュ）
2. ユーザーがOAuth URLを訪問、認証コードをコピー
3. `exchangeCodeForToken()` - アクセストークン取得
4. `verifyCredentials()` - アカウント情報取得
5. `createSession()`でセッション保存

### 主なユーティリティ

- `src/utils/snakeToCamel.ts` - MastodonストリーミングAPIのsnake_caseレスポンスをTypeScript型用のcamelCaseに変換

### ストリームタイプ

サポートされるカラムタイプ: `home`, `public`, `public:local`, `list`, `hashtag`, `notifications`

ストリームキー例:

- `123@mastodon.social:home`
- `123@mastodon.social:list:456`
- `123@mastodon.social:hashtag:typescript`

### StatusCard Optimistic UI

StatusCardはお気に入り/ブーストカウントのローカルステートを維持。APIコールは楽観的に更新し、サーバーレスポンスが信頼できるソース。並行更新を処理するためにrefsを使用。

## Gitポリシー

### ブランチ戦略

- `master` - 常に動作する状態を維持。直接プッシュ禁止。
- `develop` - 通常の作業ブランチのマージ先。
- `feature/*` - 機能追加（例: `feature/streaming-home`）
- `fix/*` - バグ修正
- `chore/*` - 依存関係更新、設定変更

**常にfeature/fixブランチで作業すること。**

### コミットルール

- 小さく、意味のあるコミット単位
- 1コミット = 1意図
- 破壊的変更は禁止（別途合意がある場合を除く）

推奨フォーマット:

- `feat: add home timeline streaming`
- `fix: handle reconnect on ws close`
- `refactor: extract stream manager`
- `test: add oauth oob tests`
- `chore: update deps`

## テストポリシー

### 必須

- **ロジックは常にテスト可能な単位に分離する**
- UIとAPIロジックを密結合させない

推奨ツール:

- Vitest
- Testing Library (UI)

### テストルール

- 新しいロジックを追加する際、**少なくとも1つのテストを書く**
- 修正時: **再現テスト → 修正**
- テスト不可能な設計は禁止

## CI期待値

CIが存在することを前提にコードを書く。

最小要件:

- `npm run build` が通る
- `npm run test` が通る
- `npm run format:check` が通る
- `npm run lint` が通る
- 型エラーなし
