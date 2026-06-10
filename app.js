'use strict';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwlOij0E2TFcwNOVuSWYZKshe106S1MztFKgoLaKw3_kswh4qUyQ000CxosqnZ0akRDeg/exec';

const STORAGE_KEY = 'kakeibo_advice_eval_state_v2';
const STEPS = ['intro', 'presurvey', 'attributes', 'intro_A', 'evalA1', 'evalA2', 'evalA3', 'best_A', 'intro_B', 'evalB1', 'evalB2', 'evalB3', 'best_B', 'intro_C', 'evalC1', 'evalC2', 'evalC3', 'best_C', 'complete', 'thankyou'];
const STEP_TITLES = {
  intro: 'イントロ',
  presurvey: '事前アンケート',
  attributes: '属性選択',
  intro_A: '相談A 案内',
  evalA1: '相談A アドバイス1',
  evalA2: '相談A アドバイス2',
  evalA3: '相談A アドバイス3',
  best_A: '相談A 最良選択',
  intro_B: '相談B 案内',
  evalB1: '相談B アドバイス1',
  evalB2: '相談B アドバイス2',
  evalB3: '相談B アドバイス3',
  best_B: '相談B 最良選択',
  intro_C: '相談C 案内',
  evalC1: '相談C アドバイス1',
  evalC2: '相談C アドバイス2',
  evalC3: '相談C アドバイス3',
  best_C: '相談C 最良選択',
  complete: '完了',
  thankyou: '終了'
};
const SCORE_IDS = ['relevance', 'usefulness', 'specificity', 'trust', 'intention'];

const app = document.getElementById('app');
const messageArea = document.getElementById('messageArea');
const backButton = document.getElementById('backButton');
const nextButton = document.getElementById('nextButton');
const stepLabel = document.getElementById('stepLabel');
const progressBar = document.getElementById('progressBar');
const participantMiniId = document.getElementById('participantMiniId');

let patterns = null;
let advice = null;

let state = {
  participant_id: '',
  wid: '',
  step: 'intro',
  presurvey: {},
  attributes: {},
  displayOrderA: [],
  displayOrderB: [],
  displayOrderC: [],
  scoresA: {},
  scoresB: {},
  scoresC: {},
  best_slot_A: null,
  best_slot_B: null,
  best_slot_C: null,
  submitted: false,
  submitError: '',
  lastPayload: null
};

document.addEventListener('DOMContentLoaded', init);
backButton.addEventListener('click', goBack);
nextButton.addEventListener('click', goNext);

async function init() {
  const stored = loadState();
  const params = new URLSearchParams(window.location.search);
  const wid = params.get('wid') || '';
  const familyParam = params.get('family') || '';
  const urlFamily = /^[1-4]$/.test(familyParam) ? `f${familyParam}` : '';
  const storedAttributes = { ...(stored.attributes || {}) };
  if (!storedAttributes.family && urlFamily) {
    storedAttributes.family = urlFamily;
  }

  state = {
    ...state,
    ...stored,
    attributes: {
      ...state.attributes,
      ...storedAttributes
    },
    participant_id: stored.participant_id || createParticipantId(),
    wid: wid || stored.wid || ''
  };
  participantMiniId.textContent = state.participant_id;

  try {
    const responses = await Promise.all([
      fetch('data/patterns.json', { cache: 'no-store' }),
      fetch('data/advice.json', { cache: 'no-store' })
    ]);
    if (!responses[0].ok || !responses[1].ok) {
      throw new Error('公開JSONの取得に失敗しました。');
    }
    patterns = await responses[0].json();
    advice = await responses[1].json();
    ensureValidStep();
    saveState();
    render();
  } catch (error) {
    showMessage('error', 'データを読み込めませんでした。公開用JSONが配置されているか確認してください。');
    renderShellOnly();
  }
}

function createParticipantId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  if (window.crypto && crypto.randomUUID) {
    suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  }
  return `P-${yy}${mm}${dd}-${suffix}`;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureValidStep() {
  if (!STEPS.includes(state.step)) {
    state.step = 'intro';
  }
}

function parseEvalStep(step) {
  const match = step.match(/^eval([ABC])(\d)$/);
  if (!match) return null;
  return { consultation: match[1], slot: Number(match[2]) };
}

function ensureDisplayOrderFor(consultation) {
  const key = `displayOrder${consultation}`;
  if (!Array.isArray(state[key]) || state[key].length !== 3) {
    state[key] = shuffle([0, 1, 2]);
  }
}

function getFamilyGroup() {
  return (state.attributes.family === 'f3' || state.attributes.family === 'f4') ? 'large' : 'small';
}

function renderShellOnly() {
  stepLabel.textContent = '読み込みエラー';
  progressBar.style.width = '0%';
  app.replaceChildren();
  const title = createElement('h2', 'データを読み込めませんでした');
  const text = createElement('p', 'GitHub Pagesなどの公開環境で、data/patterns.json と data/advice.json が配置されているか確認してください。', 'section-text');
  app.append(title, text);
  backButton.disabled = true;
  nextButton.disabled = true;
}

function render() {
  clearMessage();
  const stepIndex = STEPS.indexOf(state.step);
  stepLabel.textContent = `${stepIndex + 1} / ${STEPS.length} ${STEP_TITLES[state.step]}`;
  progressBar.style.width = `${((stepIndex + 1) / STEPS.length) * 100}%`;
  participantMiniId.textContent = state.participant_id;
  app.replaceChildren();

  if (state.step === 'intro') renderIntro();
  if (state.step === 'presurvey') renderPresurvey();
  if (state.step === 'attributes') renderAttributes();
  if (state.step === 'intro_A') renderConsultationIntro('A');
  if (state.step === 'intro_B') renderConsultationIntro('B');
  if (state.step === 'intro_C') renderConsultationIntro('C');
  const parsedEvalStep = parseEvalStep(state.step);
  if (parsedEvalStep) renderEvalStep(parsedEvalStep.consultation, parsedEvalStep.slot);
  if (state.step === 'best_A') renderBestFor('A');
  if (state.step === 'best_B') renderBestFor('B');
  if (state.step === 'best_C') renderBestFor('C');
  if (state.step === 'complete') renderComplete();
  if (state.step === 'thankyou') renderThankyou();

  backButton.disabled = state.step === 'complete' || state.step === 'thankyou';
  backButton.classList.toggle('hidden', state.step === 'intro' || state.step === 'thankyou');
  nextButton.textContent = state.step === 'complete' ? '終了する' : state.step === 'best_C' ? '完了して送信' : '次へ';
  nextButton.classList.toggle('hidden', state.step === 'thankyou');
}

function renderIntro() {
  app.append(
    createElement('h2', '研究協力のお願い'),
    createElement('p', '家計に関する相談文3つと、それぞれに対する3種類のアドバイス（計9件）を読み、各アドバイスの内容を評価していただきます。所要時間は15分程度です。'),
    createElement('p', 'ご自身が現在生活している家計に基づいて回答してください。同居している家族全員の収支を対象とします。単身赴任など別居している家族は含めません。', 'note')
  );
}

function renderPresurvey() {
  const form = createElement('div', '', 'form-grid');
  patterns.presurvey.forEach((item) => {
    const group = createFieldset(item.label);
    if (item.type === 'likert5') {
      group.append(createRadioGrid(`presurvey-${item.id}`, item.scale, state.presurvey[item.id], (value) => {
        state.presurvey[item.id] = value;
        saveState();
      }));
    } else if (item.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.className = 'free-text';
      textarea.placeholder = '自由にお書きください';
      textarea.value = state.presurvey[item.id] || '';
      textarea.addEventListener('input', () => {
        state.presurvey[item.id] = textarea.value;
        saveState();
      });
      group.append(textarea);
    } else {
      group.append(createRadioGrid(`presurvey-${item.id}`, item.options, state.presurvey[item.id], (value) => {
        state.presurvey[item.id] = value;
        saveState();
      }));
    }
    form.append(group);
  });
  app.append(createElement('h2', '事前アンケート'), createElement('p', '以下はご自身のことについてお答えください。', 'note'), form);
}

function renderAttributes() {
  const form = createElement('div', '', 'form-grid');

  if (!state.attributes.family) {
    const familyGroup = createFieldset('家族人数');
    familyGroup.append(createElement('p', '同居中・同一家計の人数を選んでください', 'field-hint'));
    familyGroup.append(createOptionCards('family', patterns.family, state.attributes.family, (value) => {
      state.attributes.family = value;
      updatePatternKey();
      resetEvaluationState();
      saveState();
      render();
    }));
    form.append(familyGroup);
  }

  const familyGroup = getFamilyGroup();
  patterns.expenses.forEach((expense) => {
    const group = createFieldset(expense.label);
    const opts = expense[`options_${familyGroup}`] || {};
    const options = [
      { key: 'L', label: opts.low },
      { key: 'H', label: opts.high }
    ];
    if (expense.hint) {
      group.append(createElement('p', expense.hint, 'field-hint'));
    }
    group.append(createOptionCards(`expense-${expense.id}`, options, state.attributes[expense.id], (value) => {
      state.attributes[expense.id] = value;
      updatePatternKey();
      resetEvaluationState();
      saveState();
    }));
    form.append(group);
  });

  app.append(
    createElement('h2', '属性選択'),
    createElement('p', 'ご自身の家計になるべく近いものを選択し、その家計に基づいて生活しているものとして回答してください。', 'note'),
    form
  );
}

function renderConsultationIntro(consultation) {
  const item = patterns.consultations.find((candidate) => candidate.key === consultation);
  app.append(
    createElement('h2', `相談${consultation}`),
    createElement('p', 'あなたが以下のような相談をしたとき、あなたが選択した家計に基づいてFP（ファイナンシャルプランナー）がアドバイス（計3つ）をしてきます。以下の相談文を読んだ後、次ページ以降で、それぞれのアドバイスをお読みいただき、相談内容に対するアドバイスとしての妥当性・有用性・具体性・信頼性および改善意向をそれぞれ5段階で評価してください。', 'note'),
    createElement('blockquote', item ? item.text : '', 'consultation-quote')
  );
}

function renderEvalStep(consultation, slot) {
  const patternKey = state.attributes.patternKey;
  const adviceSet = advice[patternKey] && advice[patternKey][consultation];
  if (!Array.isArray(adviceSet) || adviceSet.length !== 3) {
    app.append(
      createElement('h2', `相談${consultation} アドバイス${slot}評価`),
      createElement('p', '選択条件に対応するアドバイスが見つかりません。前の画面に戻って選択内容を確認してください。', 'section-text')
    );
    return;
  }

  ensureDisplayOrderFor(consultation);
  saveState();

  const consultationItem = patterns.consultations.find((item) => item.key === consultation);
  const summary = createElement('div', '', 'summary-box');
  summary.append(
    createElement('p', consultationItem ? consultationItem.text : '', 'summary-consultation-text'),
    createElement('p', `あなたが選択した家計属性: ${formatAttributes()}`, 'summary-attr')
  );

  const orderKey = `displayOrder${consultation}`;
  const arrayIndex = state[orderKey][slot - 1];
  app.append(createElement('h2', `相談${consultation} アドバイス${slot}評価`), summary, createAdviceCard(consultation, slot, arrayIndex, adviceSet[arrayIndex]));
}

function renderBestFor(consultation) {
  const item = patterns.consultations.find((c) => c.key === consultation);
  const slotKey = `best_slot_${consultation}`;
  const group = createFieldset('先ほどの評価を踏まえて、3つのアドバイスの中で最も満足のいくものを1つ選んでください。');
  group.classList.add('best-choice');
  const hr = document.createElement('hr');
  group.append(
    hr,
    createRadioGrid(`best-slot-${consultation}`, ['アドバイス1', 'アドバイス2', 'アドバイス3'], state[slotKey] ? `アドバイス${state[slotKey]}` : '', (value) => {
      state[slotKey] = Number(value.replace('アドバイス', ''));
      saveState();
    })
  );
  app.append(group);
}

function createAdviceCard(consultation, displaySlot, arrayIndex, text) {
  const card = createElement('article', '', 'advice-card');
  const header = createElement('div', '', 'advice-header');
  header.append(createElement('span', `アドバイス${displaySlot}`, 'advice-label'));

  const body = createElement('div', '', 'advice-body');
  body.append(renderAdviceText(text || ''));

  const ratings = createElement('div', '', 'ratings');
  patterns.eval_items.forEach((item) => {
    const row = createElement('div', '', 'rating-row');
    row.append(createElement('p', `${item.label}: ${item.question}`, 'rating-question'));
    row.append(createLikert(consultation, displaySlot, item));
    ratings.append(row);
  });

  card.append(header, body, ratings);
  return card;
}

function createLikert(consultation, displaySlot, item) {
  const wrap = createElement('div', '', 'likert');
  const scoresKey = `scores${consultation}`;
  const saved = state[scoresKey][String(displaySlot)] && state[scoresKey][String(displaySlot)][item.id];
  patterns.likert5.forEach((label, index) => {
    const option = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `score-${consultation}-${displaySlot}-${item.id}`;
    input.value = String(index + 1);
    input.checked = Number(saved) === index + 1;
    input.addEventListener('change', () => {
      const key = String(displaySlot);
      state[scoresKey][key] = state[scoresKey][key] || {};
      state[scoresKey][key][item.id] = index + 1;
      saveState();
    });
    option.append(input, document.createTextNode(label));
    wrap.append(option);
  });
  return wrap;
}

function renderComplete() {
  const title = createElement('h2', '完了しました');
  const text = createElement('p', '以下の参加者IDをクラウドワークスの完了報告に貼り付けてください。', 'section-text');
  const code = createElement('strong', state.participant_id, 'completion-code');
  const row = createElement('div', '', 'button-row');

  const copyButton = createElement('button', '参加者IDをコピー', 'primary');
  copyButton.type = 'button';
  copyButton.addEventListener('click', copyParticipantId);
  row.append(copyButton);

  if (!state.submitted) {
    const retryButton = createElement('button', '送信を再試行', 'secondary');
    retryButton.type = 'button';
    retryButton.addEventListener('click', submitPayload);
    row.append(retryButton);
  }

  app.append(title, text, code, row);

  if (state.wid) {
    app.append(createElement('p', `クラウドワークスID: ${state.wid}`, 'section-text'));
  }

  if (state.submitted) {
    app.append(createElement('p', '回答データの送信は完了しています。', 'note'));
  } else {
    app.append(createElement('p', '送信が完了するまで、この画面を閉じずに再試行できます。送信できない場合に備えて、下の退避用データを保存してください。', 'note'));
    const fallback = document.createElement('textarea');
    fallback.className = 'fallback-box';
    fallback.readOnly = true;
    fallback.value = JSON.stringify(state.lastPayload || buildPayload(), null, 2);
    app.append(fallback);
  }
}

function renderThankyou() {
  app.append(
    createElement('h2', 'ご協力ありがとうございました'),
    createElement('p', '回答が完了しました。このタブを閉じて終了してください。', 'section-text')
  );
}

function createFieldset(legendText) {
  const group = document.createElement('fieldset');
  group.className = 'field-group';
  const legend = document.createElement('legend');
  legend.textContent = legendText;
  group.append(legend);
  return group;
}

function createRadioGrid(name, labels, selected, onChange) {
  const grid = createElement('div', '', 'choice-grid');
  labels.forEach((raw) => {
    const item = typeof raw === 'object' ? raw : { key: raw, label: raw };
    const option = createChoiceLabel(name, item, selected === item.key, onChange);
    grid.append(option);
  });
  return grid;
}

function createOptionCards(name, options, selected, onChange) {
  const grid = createElement('div', '', 'choice-grid');
  options.forEach((item) => {
    grid.append(createChoiceLabel(name, item, selected === item.key, onChange));
  });
  return grid;
}

function createChoiceLabel(name, item, checked, onChange) {
  const label = createElement('label', '', 'choice-card');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = item.key;
  input.checked = checked;
  input.addEventListener('change', () => onChange(item.key));

  const text = document.createElement('span');
  text.append(createElement('span', item.label, 'choice-title'));
  if (item.detail) {
    text.append(createElement('span', item.detail, 'choice-detail'));
  }
  label.append(input, text);
  return label;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyInlineBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderAdviceText(markdown) {
  const root = createElement('div', '', 'markdown-content');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph = [];
  let list = null;
  let listType = '';

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const p = document.createElement('p');
    p.innerHTML = applyInlineBold(escapeHtml(paragraph.join('\n')));
    root.append(p);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    root.append(list);
    list = null;
    listType = '';
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      root.append(createElement('h3', trimmed.slice(4).trim()));
      return;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      if (!list || listType !== type) {
        flushList();
        list = document.createElement(type);
        listType = type;
      }
      const li = document.createElement('li');
      li.innerHTML = applyInlineBold(escapeHtml((unordered ? unordered[1] : ordered[1]).trim()));
      list.append(li);
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return root;
}

function goBack() {
  const index = STEPS.indexOf(state.step);
  if (index <= 0 || state.step === 'complete') return;
  state.step = STEPS[index - 1];
  saveState();
  render();
  window.scrollTo(0, 0);
}

async function goNext() {
  if (state.step === 'complete') {
    state.step = 'thankyou';
    saveState();
    render();
    window.scrollTo(0, 0);
    return;
  }

  if (!validateStep()) return;

  if (state.step === 'best_C') {
    state.step = 'complete';
    state.lastPayload = buildPayload();
    saveState();
    render();
    window.scrollTo(0, 0);
    await submitPayload();
    return;
  }

  const index = STEPS.indexOf(state.step);
  state.step = STEPS[index + 1];
  if (state.step === 'evalA1') {
    ensureDisplayOrderFor('A');
  }
  if (state.step === 'evalB1') {
    ensureDisplayOrderFor('B');
  }
  if (state.step === 'evalC1') {
    ensureDisplayOrderFor('C');
  }
  saveState();
  render();
  window.scrollTo(0, 0);
}

function validateStep() {
  if (state.step === 'intro') return true;

  if (state.step === 'presurvey') {
    const missing = patterns.presurvey.some((item) => !item.optional && !state.presurvey[item.id]);
    if (missing) {
      showMessage('error', '事前アンケートの未回答項目があります。');
      return false;
    }
  }

  if (state.step === 'attributes') {
    updatePatternKey();
    if (!state.attributes.family || !state.attributes.ins || !state.attributes.com || !state.attributes.fod) {
      showMessage('error', '属性の未選択項目があります。');
      return false;
    }
    if (!advice[state.attributes.patternKey]) {
      showMessage('error', '選択した属性に対応するデータが見つかりません。');
      return false;
    }
  }

  const parsedEvalStep = parseEvalStep(state.step);
  if (parsedEvalStep) {
    const scoresKey = `scores${parsedEvalStep.consultation}`;
    const slotScores = state[scoresKey][String(parsedEvalStep.slot)] || {};
    const missing = SCORE_IDS.some((id) => !slotScores[id]);
    if (missing) {
      showMessage('error', `相談${parsedEvalStep.consultation} アドバイス${parsedEvalStep.slot}の未回答項目があります。`);
      return false;
    }
  }

  if (state.step === 'best_A' || state.step === 'best_B' || state.step === 'best_C') {
    const c = state.step.replace('best_', '');
    if (!state[`best_slot_${c}`]) {
      showMessage('error', '最も良かったアドバイスを1つ選んでください。');
      return false;
    }
  }

  return true;
}

function updatePatternKey() {
  const family = state.attributes.family;
  const ins = state.attributes.ins;
  const com = state.attributes.com;
  const fod = state.attributes.fod;
  if (family && ins && com && fod) {
    state.attributes.patternKey = `${family}_ins${ins}_com${com}_fod${fod}`;
  }
}

function resetEvaluationState() {
  state.displayOrderA = [];
  state.displayOrderB = [];
  state.displayOrderC = [];
  state.scoresA = {};
  state.scoresB = {};
  state.scoresC = {};
  state.best_slot_A = null;
  state.best_slot_B = null;
  state.best_slot_C = null;
  state.submitted = false;
  state.submitError = '';
  state.lastPayload = null;
}

function shuffle(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPayload() {
  ['A', 'B', 'C'].forEach((c) => ensureDisplayOrderFor(c));
  return {
    participant_id: state.participant_id,
    wid: state.wid,
    timestamp: new Date().toISOString(),
    presurvey: {
      fp_experience: state.presurvey.fp_experience,
      fp_trust: state.presurvey.fp_trust,
      fp_trust_reason: state.presurvey.fp_trust_reason,
      manages_finance: state.presurvey.manages_finance
    },
    attributes: {
      family: state.attributes.family,
      ins: state.attributes.ins,
      com: state.attributes.com,
      fod: state.attributes.fod,
      patternKey: state.attributes.patternKey
    },
    items: {
      A: buildItemsFor('A'),
      B: buildItemsFor('B'),
      C: buildItemsFor('C')
    },
    best: {
      A: {
        slot: state.best_slot_A,
        array_index: state.displayOrderA[state.best_slot_A - 1]
      },
      B: {
        slot: state.best_slot_B,
        array_index: state.displayOrderB[state.best_slot_B - 1]
      },
      C: {
        slot: state.best_slot_C,
        array_index: state.displayOrderC[state.best_slot_C - 1]
      }
    }
  };
}

function buildItemsFor(consultation) {
  const order = state[`displayOrder${consultation}`];
  const scores = state[`scores${consultation}`];
  return order.map((arrayIndex, displayIndex) => ({
    display_slot: displayIndex + 1,
    array_index: arrayIndex,
    scores: scores[String(displayIndex + 1)]
  }));
}

async function submitPayload() {
  if (GAS_URL === 'REPLACE_ME') {
    state.submitted = false;
    state.submitError = 'GAS_URLが未設定です。';
    state.lastPayload = state.lastPayload || buildPayload();
    saveState();
    render();
    showMessage('info', 'GAS_URLが未設定のため、回答データは送信されていません。退避用データを画面に表示しています。');
    return;
  }

  const payload = state.lastPayload || buildPayload();
  state.lastPayload = payload;
  saveState();

  try {
    await postWithRetry(payload, 2);
    state.submitted = true;
    state.submitError = '';
    saveState();
    render();
  } catch (error) {
    state.submitted = false;
    state.submitError = error.message || '送信に失敗しました。';
    saveState();
    render();
    showMessage('error', '送信に失敗しました。画面の「送信を再試行」を押すか、退避用データを控えてください。');
  }
}

async function postWithRetry(payload, retries) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      if (!result || result.status !== 'ok') {
        throw new Error(result && result.message ? result.message : 'GAS returned error');
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(700 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyParticipantId() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(state.participant_id).then(() => {
      showMessage('info', '参加者IDをコピーしました。');
    }).catch(() => {
      showMessage('error', 'コピーできませんでした。参加者IDを選択してコピーしてください。');
    });
  } else {
    showMessage('error', 'このブラウザではコピー機能を使用できません。参加者IDを選択してコピーしてください。');
  }
}

function formatAttributes() {
  const familyItem = patterns.family.find((item) => item.key === state.attributes.family);
  const familyLabel = familyItem ? familyItem.label : (state.attributes.family || '');
  const familyGroup = getFamilyGroup();
  const labels = patterns.expenses.map((expense) => {
    const value = state.attributes[expense.id];
    const opts = expense[`options_${familyGroup}`] || {};
    const amountLabel = value === 'H' ? opts.high : (value === 'L' ? opts.low : '未選択');
    return `${expense.label.replace('（月額）', '')} ${amountLabel}`;
  });
  const parts = familyLabel ? [familyLabel, ...labels] : labels;
  return parts.join(' ・ ');
}

function showMessage(type, text) {
  messageArea.replaceChildren();
  const message = createElement('p', text, `message ${type}`);
  messageArea.append(message);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearMessage() {
  messageArea.replaceChildren();
}

function createElement(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
