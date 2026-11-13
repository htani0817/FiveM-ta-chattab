---
title: ta-chattab（チャットの Tab 補完）
date: 2026-11-13
tags:
  - コーディング/fivem
status: 実装済み（FiveM 実機で動作確認済み）
aliases:
  - ta-chattab
  - tani-chattab
related:
  - "[[FiveM-Script/README|FiveM-Script 目次]]"
---

# ta-chattab（チャットの Tab 補完）

T キーで開くチャットで `/` コマンドを打っている途中に Tab を押すと、コマンド名を補完する。

旧名は `tani-chattab`（2026-11-13 に `ta-chattab` へ変えた）。旧名のまま入れているサーバーは、古いフォルダを消してから入れ直す。設定やデータは持っていないので、引き継ぐものは無い。

> [!NOTE]
> **動作確認済み**
>
> FiveM の実機で動作を確認した。FXServer に同梱の chat の画面（`dist/ui.html`）をそのまま開いたテストも通っている（下の「テスト」）。

## 使い方

| 操作 | 動き |
| --- | --- |
| `/m` で Tab | 合う候補が1つなら、`/me ` のように空白まで入れる |
| `/c` で Tab | 候補が複数なら、共通の頭（`/car`）まで伸ばす |
| もう一度 Tab | それ以上伸ばせない時は、候補を名前順に1つずつ入れる。最後まで行くと最初に戻る |
| Shift+Tab | 候補を逆順に入れる |
| 文字を打つ | 巡回をやめ、次の Tab からまた絞り直す |

- 補完するのはコマンド名だけ。空白の後（引数）では何もしない。
- 候補は chat が下に出しているのと同じ一覧で、権限（ACE）で使えないコマンドは入らない。管理者には管理者用のコマンドも出る。
- 大文字と小文字は区別しない。
- `/` で始まらない時は何もせず、chat の元の Tab（チャットのモード切り替え）が動く。このサーバーではモードを足しているリソースが無いので、元の Tab は実質なにもしない。
- 日本語の変換中の Tab には触らない。

## 作り方を選んだ理由

チャットは FXServer に同梱の `chat`（`server/citizen/system_resources/chat`）で、見た目は qbx_chat_theme が変えている。どちらも書き換えず、独立したリソースにした。

| 案 | 判断 |
| --- | --- |
| chat 本体（`dist/chat.js`）を直す | FXServer を更新すると消える。中身は圧縮済みのビルドで、元のソースはサーバーに無い |
| chat を resources に写して作り直す | 同梱の chat と名前がぶつかる。上流の直しも取り込めなくなる |
| qbx_chat_theme の `theme/app.js` に足す | Qbox の配布物なので、更新で消える |
| **chat のテーマとして JS を読ませる（採用）** | chat は全リソースの `chat_theme` を読み、その `script` をチャット画面に足す。テーマは複数を同時に使えるので、qbx_chat_theme の見た目はそのまま |

chat が持つ候補は、Vue の `#app._vnode.component.proxy.suggestions` から読む。本番ビルドでも残る値だが、chat の作りが変わって読めなくなった時は、画面に出ている候補（最大5件）で補完する。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `fxmanifest.lua` | `chat_theme 'ta_chattab' { script = 'html/tab.js' }` |
| `html/tab.js` | Tab を window の capture で受け、chat の Tab 処理より先に補完する |
| `tests/tab-test.js` | 本物の chat の画面を開いて試すテスト |

## 導入

1. このフォルダから `tests/` と `README.md` を除いて、サーバーの `resources` の下に `ta-chattab` という名前で置く（例: `resources/[standalone]/ta-chattab`）。`ensure ta-chattab`（またはフォルダごと `ensure [standalone]`）で起動する。
2. 設定、データベース、権限の追加は要らない。

## テスト

```
node tests/tab-test.js <FXServer のフォルダ>/citizen/system_resources/chat [スクリーンショットの出力フォルダ]
```

ヘッドレス Chromium（Playwright が入れたもの）で chat の `dist/ui.html` を開き、chat が受け取る形のまま候補・テーマ・入力欄を開くメッセージを送ってから、実際に Tab を押す。2026-11-13 に 18 件すべて通った（テーマを2回読み直しても二重に動かないこと、元のモード切り替えが残ることも含む）。

## 実機での確認

FiveM の実機で、次の点を確かめた。

- T キーで `/` から打って Tab を押すと補完されること。
- 補完した後に Enter でそのコマンドが実行できること。
- 管理者とそうでない人で、補完される候補が違うこと。

## ライセンス

MIT License（`LICENSE`）
