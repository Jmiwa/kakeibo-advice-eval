# ユーザー評価Webアプリ 設計書（実装指示書）

最終更新：2026-06-01 / 対象：`user_evaluation/web/`

提案手法・ベースライン2手法（計3手法）の家計相談アドバイスを、クラウドワークス参加者に
ブラインド評価してもらうための静的Webアプリと、その付随スクリプトの仕様。
**この設計に基づく実装は codex で作成し、実行（python / clasp など）はユーザーが行う。**

---

> # ⚠️ 重要な訂正（2026-06-12 追記）— 本書の「手法ランダム順＋keymap」記述は現行実装と異なる（廃止）
>
> 最終実装は手法の並びを **固定** した：`web/data/advice.json` は全96セルで
> **`array_index 0 = vanilla_rag / 1 = reranking_rag / 2 = proposed`**。
> `private/method_keymap.json`（旧ランダム順の名残／**現 `method_keymap_STALE_DO_NOT_USE.json` にリネーム済み**）は最終 advice.json と **288中190か所ズレており、使うと解析結果が反転する。絶対に使わない。**
>
> - 本書で**もう正しくない箇所**：§0表「中立コード方式」、§4 手順3（ランダム順＋keymap記録）、§5 `method_keymap.json`、§9 末尾「keymapと突合して復元」。
>   （※§6 の「参加者ごとに表示順をシャッフル」自体は正しい＝`display_slot`。誤りは「keymapで復元」の部分だけ。）
> - **正しい固定対応は `expense_patterns.md`**（末尾「アドバイス手法と array_index の対応」）。**分析手順・結果は `web/ANALYSIS.md`**。
> - 提示順（参加者の画面）は `display_slot` で別途シャッフルされ、ブラインドは保たれている（array_index は配列位置で、手法と固定対応）。

## 0. 確定事項サマリ

| 要素 | 確定内容 |
|------|---------|
| 手法 | 3手法：`proposed` / `reranking_rag` / `vanilla_rag`（各96件・計288件、ファイル名集合は完全一致を確認済み） |
| アドバイス | **既存生成物をそのまま使用**（再生成しない） |
| 属性選択 | 参加者がアプリ内で選択：家族人数(1/2/3/4以上) ＋ 保険料・通信費・食費の低/高。「実態と違っても可」と明記 |
| 相談文 | A/B/C から **1つだけ選択** |
| 提示 | 選んだ属性×相談文の3手法を「アドバイス1/2/3」でラベルなし・順序ランダム提示 |
| 評価 | 各アドバイスに **5項目×5段階リッカート** ＋ 3つで最良を1つ選択 |
| 事前アンケート | アプリに統合（FP相談経験／FP信頼度5段階／家計管理の有無） |
| 紐付け | アプリがID発番→完了コード表示→クラウドワークスへ貼付。全データを1シートにID紐付け |
| ホスティング | GitHub Pages（静的）＋ GAS Web App（記録のみ）。Googleログイン不要 |
| ブラインド | 公開バンドルに手法名を含めない（中立コード方式、§5・§6） |
| 自動割当 | Phase 1では作らない。Phase 2で不足セルを埋める専用モードを別途（§11） |

---

## 1. 表示金額・ラベル（アドバイス本文と一致させること）

実アドバイスは下記バンドで生成されている（`inputs/*.json` の `amount_yen` が正）。
**表示はこのラベルに統一**し、四分位数（1.2万/4.5万等）には**しない**（本文と矛盾するため）。

| 項目 | 低 | 高 |
|------|----|----|
| 保険料 | 3万円未満 | 3万円以上 |
| 通信費 | 1.5万円未満 | 1.5万円以上 |
| 食費 | 5万円未満 | 5万円以上 |

家族人数ラベル：`1人 / 2人 / 3人 / 4人以上`。

> 既知の注意：`proposed` は「3万円未満／以上」を一律 30,000 円・「高すぎる」と書く傾向があり、
> 低支出ペルソナでも保険等を「高い」と指摘する本文が残る。**そのまま使う方針を承知の上で進める**。

---

## 2. データソースと整合性の原則

- アドバイス本文：`user_evaluation/outputs/advice/{proposed,reranking_rag,vanilla_rag}/<stem>.txt`
- 属性・相談文メタ：`user_evaluation/inputs/<stem>.json`（`amount_yen`・`household_size`・`consultation_text`）
- 相談文の原文：`user_evaluation/consultation_texts/consultation_{A,B,C}.md` の `## 相談文` セクション
  - **C は「借金・ローンの返済」版**（`consultation_C.md`）。`mtg/experiment_status.md` の旧記述（「毎月の支出が多い」）とは異なるが、生成に使われたのは `consultation_C.md`。表示も C=借金・ローンに合わせる。
- ファイル名規則：`p{NN}c{A|B|C}_{f1..f4}_{insL|insH}_{comL|comH}_{fodL|fodH}.txt`
- **表示用ラベルは inputs/consultation_texts から導出**し、ハードコードしない（＝本文と必ず一致）。

---

## 3. 参加者フロー

1. **募集**：クラウドワークスで募集（家族別の枠分けは不要）。1本のアプリURLを案内。
2. **イントロ**：実験説明・所要時間・「想定の家計で構わない（実態と違っても可）」を明記。
3. **事前アンケート**（§7-A）。
4. **属性選択**：家族人数(1/2/3/4以上) ＋ 保険料・通信費・食費の低/高 → 32パターンの1つに確定。
5. **相談文選択**：A/B/C から1つ選ぶ（タイトル＋本文を見せて選ばせる）。
6. **アドバイス提示＋評価**：選んだ属性×相談文の3手法を「アドバイス1/2/3」で**順序ランダム・ラベルなし**提示。
   各アドバイスに5項目×5段階（§7-B）→ 3つの中で最良を1つ選択（§7-C）。
7. **完了**：参加者ID（＝完了コード）を表示し「クラウドワークスの完了報告に貼ってください」と案内。
8. **送信**：全回答を GAS にPOST（§9）。送信失敗時は再試行＋コード退避表示。

> Phase 1は属性・相談文とも自己選択。網羅は運用で監視し、不足は Phase 2 で補完（§11）。

---

## 4. ビルドスクリプト仕様：`user_evaluation/build_web_data.py`

目的：288件のtxtと96件のinputsから、Webが参照する **公開JSON** と **非公開keymap** を生成。

入力：`outputs/advice/<method>/*.txt`, `inputs/*.json`, `consultation_texts/*.md`
出力：
- `web/data/advice.json`（公開・手法名を含めない）
- `web/data/patterns.json`（公開・ラベル/相談文/評価設定）
- `private/method_keymap.json`（**非公開・`web/` の外に出力**。GitHub Pagesに置かない。解析時のみ使用）

処理：
1. 3手法×96 stem を走査し、`stem` から family/ins/com/fod/consult を解析。
2. 属性キー `patternKey = f{N}_ins{L|H}_com{L|H}_fod{L|H}`、相談キー `A|B|C` でグルーピング。
3. 各 `(patternKey, consult)` について3手法を **ランダム順に並べた配列** にして本文を格納（index 0/1/2）。
   同時に `method_keymap[patternKey][consult] = [<index0の真手法>, <index1>, <index2>]` を記録。
   > ⚠️ **廃止**：最終実装は固定順 `0=vanilla_rag / 1=reranking_rag / 2=proposed`（冒頭の訂正参照）。keymap は生成・使用しない。
4. `advice.json` には**本文配列のみ**（手法名なし）。`patterns.json` にラベル等。
5. バリデーション：3手法×96の全 stem が揃うこと（不足・余剰があれば異常終了）。
   - 期待：32 patternKey × 3 consult × 3手法 = 288。
6. 文字コードUTF-8、`ensure_ascii=False`。

---

## 5. 公開データ構造

### `web/data/advice.json`（手法名を含めない）
```json
{
  "f1_insL_comL_fodL": {
    "A": ["<アドバイス本文・idx0>", "<idx1>", "<idx2>"],
    "B": ["...", "...", "..."],
    "C": ["...", "...", "..."]
  },
  "f1_insL_comL_fodH": { "A": [...], "B": [...], "C": [...] }
  /* …32 patternKey… */
}
```

### `web/data/patterns.json`
```json
{
  "family":   [{"key":"f1","label":"1人"},{"key":"f2","label":"2人"},{"key":"f3","label":"3人"},{"key":"f4","label":"4人以上"}],
  "expenses": [
    {"id":"ins","label":"保険料","low":"3万円未満","high":"3万円以上"},
    {"id":"com","label":"通信費","low":"1.5万円未満","high":"1.5万円以上"},
    {"id":"fod","label":"食費","low":"5万円未満","high":"5万円以上"}
  ],
  "consultations": [
    {"key":"A","title":"老後の不安","text":"毎月の収支はなんとか…"},
    {"key":"B","title":"貯蓄が増えない","text":"収入はあるのですが…"},
    {"key":"C","title":"借金・ローンの返済","text":"現在いくつかのローンの…"}
  ],
  "presurvey": [
    {"id":"fp_experience","label":"FPに相談したことがありますか？","type":"choice","options":["ある","ない"]},
    {"id":"fp_trust","label":"FP（ファイナンシャルプランナー）をどれくらい信頼していますか？","type":"likert5",
     "scale":["全く信頼しない","あまり信頼しない","どちらともいえない","やや信頼する","非常に信頼する"]},
    {"id":"manages_finance","label":"普段、自分で家計を管理していますか？","type":"choice","options":["している","していない"]}
  ],
  "eval_items": [
    {"id":"relevance","label":"妥当性","question":"このアドバイスは相談内容に合っていると思いますか？"},
    {"id":"usefulness","label":"有用性","question":"このアドバイスは役に立つと思いますか？"},
    {"id":"specificity","label":"具体性","question":"このアドバイスは具体的だと思いますか？"},
    {"id":"trust","label":"信頼性","question":"このアドバイスは信頼できると思いますか？"},
    {"id":"intention","label":"改善意向","question":"このアドバイスを参考に、家計を改善したい／取り入れたいと思いましたか？"}
  ],
  "likert5": ["全くそう思わない","あまりそう思わない","どちらともいえない","ややそう思う","とてもそう思う"]
}
```

### ⛔ ~~`private/method_keymap.json`（非公開・`web/` 外に出力）~~ 廃止・使用禁止（冒頭の訂正参照。実装は固定順）
```json
{ "f1_insL_comL_fodL": { "A": ["reranking_rag","proposed","vanilla_rag"], "B": [...], "C": [...] } }
```

---

## 6. HTMLアプリ挙動（`index.html` / `app.js` / `style.css`）

- 画面遷移：イントロ → 事前アンケート → 属性選択 → 相談文選択 → 評価 → 完了。各ステップでバリデーション（未回答で次へ進めない）。
- データ取得：起動時に `patterns.json` と `advice.json` を `fetch`。
- ブラインド：参加者には「アドバイス1/2/3」のみ表示。手法名は一切出さない。
- **表示順ランダム化**：`advice.json` の index 0/1/2 を参加者ごとにシャッフルして提示。
  「表示スロット(1/2/3) → 配列index」の対応をログに残す（解析で keymap と突合し真手法を復元）。
- 最良選択：表示スロット単位で1つ選ばせ、そのスロット→indexをログ。
- 中断対策：進行状態を `localStorage` に保持（リロード復帰）。送信成功までコードを退避表示。
- レスポンシブ（スマホ可）。アドバイス本文は改行・見出し（Markdown見出し `###`）を読みやすく整形表示。

---

## 7. アンケート/評価（確定）

- **A. 事前**：FP相談経験（ある/ない）／FP信頼度（5段階）／家計管理（している/していない）。
- **B. 各アドバイス**：5項目×5段階リッカート（妥当性・有用性・具体性・信頼性・改善意向）。
- **C. 比較**：3つのうち最良を1つ選択（主分析に使わなくても収集）。
- 任意で1問の注意チェック（例：「この設問では『ややそう思う』を選んでください」）を入れ、低品質回答の検出に使う。← 採否は要確認。

---

## 8. 参加者IDと紐付け

- アプリ起動時にクライアントで一意ID発番（例 `P-<yyMMdd>-<base36乱数6桁>`、衝突回避に `crypto.randomUUID()` 併用可）。
- 完了画面でIDを大きく表示＋「コピー」ボタン → クラウドワークス完了報告に貼付。
- 任意：URLパラメータ `?wid=` でクラウドワークス側IDを受け取れる場合は併記ログ。
- これにより「どのIDがどの回答をしたか」「支払い対象者との照合」が後から完全に可能。

---

## 9. GAS Web App とスプレッドシート

- `web/gas/Code.gs`：`doPost(e)` で `JSON.parse(e.postData.contents)` → 行追記 → `ContentService` でJSON返却。`LockService` で同時書込制御。
- デプロイ：ウェブアプリ（実行＝自分、アクセス＝全員）。発行URLをアプリの送信先に設定。
- CORS回避：アプリ側 `fetch` は `Content-Type: text/plain;charset=utf-8`（プリフライト回避）。
- **スプレッドシート（ロング形式・1アドバイス＝1行＝1参加者あたり3行）**：

| 列 | 内容 |
|----|------|
| timestamp | 送信時刻 |
| participant_id | 参加者ID（＝完了コード） |
| fp_experience / fp_trust / manages_finance | 事前アンケート（各行に複製） |
| family / ins / com / fod | 選択属性 |
| consultation | 選んだ相談文 A/B/C |
| display_slot | 提示スロット 1/2/3 |
| array_index | advice配列のindex（keymap突合用） |
| relevance / usefulness / specificity / trust / intention | 5段階評価 |
| is_best | この行が最良選択か（true/false） |

※⚠️ **この記述は廃止**。真の手法は **固定対応**（`array_index 0=vanilla_rag / 1=reranking_rag / 2=proposed`）で復元する。keymap は使わない（冒頭の訂正・`expense_patterns.md` 参照）。

---

## 10. ホスティング（GitHub Pages の注意）

- GitHub Pages 無料運用は**公開リポジトリ**が前提。研究リポジトリ全体を公開したくない場合：
  - (推奨) **web/ だけを別の公開リポジトリ**に置いて Pages 公開、または
  - **Netlify / Cloudflare Pages**（非公開リポジトリでも無料でPages可）。
- 公開されるのは `advice.json`（手法名なし）と `patterns.json` のみ。`method_keymap.json` は `user_evaluation/private/` に出力され `web/` の外なので、`web/` を公開しても含まれない。
- 合成アドバイスのためPIIなし。中立コード方式により手法の正体も露出しない。

---

## 11. Phase 2（今は作らない・設計だけ）

- 自己選択で埋まらない (属性×相談文) セルが出たら、`?assign=f2_insH_comL_fodH&c=B` 等のパラメータで
  特定セルを指定提示する「割当モード」を追加。クラウドワークスで不足分だけ追加募集に使う。
- GASに簡易カバレッジ集計（セル別件数）を返すエンドポイントを足すと運用が楽。

---

## 12. 要確認・未決（実装前にユーザー確認）

- [ ] 評価5項目の**文面**（§5 eval_items）これで良いか。
- [ ] 注意チェック設問（§7-C）を入れるか。
- [ ] スプレッドシートのロング形式でよいか（解析しやすい想定）。
- [ ] ホスティング：別公開リポジトリ / Netlify / Cloudflare のどれにするか。
- [ ] イントロ文・同意文言・謝礼額・クラウドワークス募集文（別途）。
