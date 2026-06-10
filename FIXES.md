# demo2 フィードバック対応方針

先生のコメント（demo2.txt）とユーザーの判断に基づく修正方針。

---

## 1. イントロ（renderIntro）

**対応: そのまま**

現状の表現で問題なし。先生から表現が難しいと指摘があったが、代替案を検討しても改善が難しいため現状維持。

---

## 2. 事前アンケート（renderPresurvey）

**対応: noteを追加**

事前アンケートが事実ベースの回答であることをユーザーに明示する。

**変更箇所: app.js `renderPresurvey()` 最終行**

```js
// 変更前
app.append(createElement('h2', '事前アンケート'), form);

// 変更後
app.append(
  createElement('h2', '事前アンケート'),
  createElement('p', '以下はご自身のことについてお答えください。', 'note'),
  form
);
```

---

## 3. 属性選択の説明文（renderAttributes）

**対応: 説明文を短縮・変更**

「同居している家族全員分を対象とします」は保険料・食費の個別hintsで説明済みのため、上部の説明から削除する。

**変更箇所: app.js `renderAttributes()` の `app.append` 内**

```js
// 変更前
createElement('p', 'できる限りご自身の実際の家計に基づいて選んでください。同居している家族全員分を対象とします。', 'note'),

// 変更後
createElement('p', 'ご自身の実際の家計になるべく近いものを選択してください。', 'note'),
```

---

## 4. 保険料のhint（patterns.json）

**対応: 案1「生命保険・損害保険など」に変更**

「医療保険」は人に関する保険に偏っている。「損害保険」にすることで火災・自動車保険なども自然に含意できる。

**変更箇所: data/patterns.json `expenses[0].hint`**

```json
// 変更前
"hint": "同一家計から支出しているすべての保険料（生命保険・医療保険など）が対象です"

// 変更後
"hint": "同一家計から支出しているすべての保険料（生命保険・損害保険など）が対象です"
```

---

## 5. 相談A/B/C案内（renderConsultationIntro）

**対応: 先生の提案文に書き換え**

相談文は架空であり、選択した家計に基づいてFPがアドバイスする設定であることを明示する。

**変更箇所: app.js `renderConsultationIntro()` の note テキスト**

```js
// 変更前
createElement('p', `${orderLabel[consultation]}の相談文です。次のページから、この相談文に対する3種類のアドバイスを1つずつお読みいただき、それぞれ評価してください。`, 'note'),

// 変更後
createElement('p', 'あなたが以下のような相談をしたとき、あなたが選択した家計に基づいてFP（ファイナンシャルプランナー）がアドバイス（計3つ）をしてきます。以下の相談文を読んだ後、次ページ以降で、それぞれのアドバイスをお読みいただき、相談内容に対するアドバイスとしての妥当性・有用性・具体性・信頼性および改善意向をそれぞれ5段階で評価してください。', 'note'),
```

---

## 6. アドバイス評価ページの属性ラベル（renderEvalStep）

**対応: ラベルを「あなたが選択した家計属性:」に変更**

**変更箇所: app.js `renderEvalStep()` の summary-attr 要素**

```js
// 変更前
createElement('p', `属性: ${formatAttributes()}`, 'summary-attr')

// 変更後
createElement('p', `あなたが選択した家計属性: ${formatAttributes()}`, 'summary-attr')
```

---

## 7. 最良選択（renderBestFor）

**対応: 評価基準を明示する説明文を追加**

「最も良かったもの」の基準が不明瞭なため、5つの評価観点を総合して選ぶよう明示する。

**変更箇所: app.js `renderBestFor()` の fieldset legend と内部**

```js
// 変更前
const group = createFieldset(`相談${consultation}「${item ? item.title : ''}」— 3つのアドバイスのうち最も良かったものを1つ選んでください`);
group.classList.add('best-choice');
group.append(
  createElement('p', item ? item.text : '', 'summary-consultation-text'),
  createRadioGrid(...)
);

// 変更後
const group = createFieldset(`相談${consultation}「${item ? item.title : ''}」`);
group.classList.add('best-choice');
group.append(
  createElement('p', item ? item.text : '', 'summary-consultation-text'),
  createElement('p', '妥当性・有用性・具体性・信頼性・改善意向の観点を総合的に見て、最も満足のいくアドバイスを1つ選んでください。', 'field-hint'),
  createRadioGrid(...)
);
```
