# 家計相談アドバイス評価Webアプリ

クラウドワークス参加者に、3件の家計相談アドバイスをブラインド評価してもらうための静的Webアプリです。

## ファイル構成

- `index.html`: 単一ページアプリ本体
- `app.js`: 依存なしのバニラJavaScript
- `style.css`: レスポンシブ表示用CSS
- `gas/Code.gs`: Google Apps Scriptの記録用 `doPost`
- `data/patterns.json`: 公開用メタデータ。`build_web_data.py` で生成
- `data/advice.json`: 公開用アドバイス本文。手法名は含めない。`build_web_data.py` で生成
- `../private/method_keymap.json`: 解析用の非公開対応表。`build_web_data.py` で生成

## 公開前の手順

1. リポジトリルートで `user_evaluation/build_web_data.py` を実行し、公開JSONを `user_evaluation/web/data/` に、非公開対応表を `user_evaluation/private/` に生成する。
2. Googleスプレッドシートを作成し、シートIDを控える。
3. GASプロジェクトを作成し、`gas/Code.gs` の内容を貼り付ける。
4. `Code.gs` 冒頭の `SHEET_ID = 'REPLACE_ME'` を実際のスプレッドシートIDに置き換える。
5. GASをウェブアプリとしてデプロイする。実行ユーザーは自分、アクセス権は全員にする。
6. 発行されたGAS WebアプリURLを `app.js` 冒頭の `GAS_URL = 'REPLACE_ME'` に設定する。
7. `user_evaluation/web/` の内容をGitHub Pagesで公開する。

## 重要な注意

`method_keymap.json` は `user_evaluation/private/` に生成され、公開対象の `user_evaluation/web/` から構造的に分離されています。`web/` をそのまま公開しても `method_keymap.json` は含まれません。参加者に見せる公開データは `patterns.json` と `advice.json` のみです。

`advice.json` は本文配列だけを持ち、手法名を含めない設計です。画面上でも参加者には「アドバイス1/2/3」だけを表示します。

## 動作確認

公開後、以下を確認してください。

- `data/patterns.json` と `data/advice.json` が取得できる。
- イントロ、事前アンケート、属性選択、相談文選択、評価、完了の順に進める。
- 未回答のまま次へ進めない。
- 完了画面に参加者IDが表示され、コピーできる。
- スプレッドシートに1参加者あたり3行で追記される。
- URLに `?wid=TEST001` を付けた場合、送信データと完了画面に `wid` が反映される。
