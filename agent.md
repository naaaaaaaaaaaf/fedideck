# AGENTS.md — Mastodon Web Client

React + Vite / masto.js / Tailwind CSS / Streaming API

## Purpose

このリポジトリは **Mastodon の Web クライアント**を開発するためのものです。
UI は **Mastodon Deck（TweetDeck 風のマルチカラム UI）** を採用し、
**複数アカウントの同時ログイン・切り替え**および
**Streaming API を用いたリアルタイム更新**に対応します。

認証は **OAuth Authorization Code（OOB）** を使用し、
callback / redirect URL は使用しません。

---

## Tech Stack

* React
* Vite
* TypeScript
* masto.js（REST / Streaming 両方）
* Tailwind CSS
* WebSocket

---

## Streaming API Overview

### Supported Streams

以下のストリームを **第一級機能**として扱う。

* home
* notifications
* public
* public:local
* list
* hashtag

Streaming API は **初期ロード後の差分更新**として使用し、
初期データ取得は REST API を用いる。

---

## Streaming Policy

### Basic Rules

* Streaming API は **WebSocket** を使用
* アカウントごとに接続を管理する
* カラム単位で購読する stream を切り替え可能にする

### REST + Streaming の役割分担

* 初回ロード: REST API
* 新着・削除・更新通知: Streaming API
* 再接続時: REST API で差分補完

---

## masto.js Streaming Usage Rules

* Streaming 接続は **masto.js の streaming client を使用**
* WebSocket を直接扱わない（例外を除く）

Streaming client は **アカウント単位で生成**する。

* instanceUrl
* accessToken

---

## Multi-Account × Streaming

### Required Design

* アカウントごとに Streaming Client を保持
* アクティブでないアカウントの stream は停止 or 最小化
* 同一アカウントで複数ストリームを同時購読可能

例：

* account A

  * home
  * notifications
* account B

  * home

---

## Column × Stream Mapping

各 Deck カラムは、以下のいずれかの更新方式を持つ。

* REST only（静的）
* Streaming only（特殊用途）
* REST + Streaming（標準）

カラムは以下の情報を持つ：

* accountId
* streamType
* streamParams（listId / hashtag 等）

---

## Streaming Event Handling

### Event Types

処理対象とするイベント：

* update（新規ステータス）
* delete（削除）
* notification
* status.update（編集）

イベントは **カラム単位でフィルタ**して反映する。

---

## Reconnect Strategy

### Required Behavior

* WebSocket 切断時は自動再接続
* 再接続は指数バックオフ
* 再接続後は REST API で最新状態を再同期

以下の場合は再接続を試みる：

* ネットワーク切断
* サーバー切断
* ブラウザ復帰（visibilitychange）

---

## Resource Management

### Performance Rules

* 表示されていないカラムの stream は停止可能
* タブ非アクティブ時は stream を一時停止可
* 不要な stream の多重接続を禁止

---

## Project Structure (Updated Suggestion)

src/
api/
mastoClient.ts
streamingClient.ts
auth/
appRegistration.ts
oauthOob.ts
sessions.ts
streaming/
streamManager.ts      # 接続管理・再接続
streamTypes.ts        # home / notifications etc
deck/
Column.tsx
ColumnContainer.tsx
columns/
store/
accounts.ts
streams.ts            # column ↔ stream mapping
components/

---

## Coding Rules (for Agents)

### DO

* Streaming と REST を明確に分離
* ストリームは必ず管理レイヤー経由で扱う
* 再接続・破棄を必ず実装
* 複数アカウント前提で設計

### DON'T

* WebSocket 直叩き
* カラムごとに無秩序な stream 接続
* REST を使わず Streaming のみで初期表示
* 単一アカウント前提の設計

---

## Required Features (Streaming)

* Home timeline のリアルタイム更新
* Notifications のリアルタイム更新
* ステータス削除イベント反映
* 再接続時の整合性維持