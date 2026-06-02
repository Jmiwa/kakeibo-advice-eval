'use strict';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw-8Lgyva3sEPQb8WWWpdiM5u6FMoe4T0UTi5XY_Hs54Z8J-pSDTecwR2KnRNTyR0LLvQ/exec';

const STORAGE_KEY = 'kakeibo_advice_eval_state_v1';
const STEPS = ['intro', 'presurvey', 'attributes', 'consultation', 'eval1', 'eval2', 'eval3', 'best_choice', 'complete'];
const STEP_TITLES = {
  intro: 'イントロ',
  presurvey: '事前アンケート',
  attributes: '属性選択',
  consultation: '相談文選択',
  eval1: 'アドバイス1評価',
  eval2: 'アドバイス2評価',
  eval3: 'アドバイス3評価',
  best_choice: '最良選択',
  complete: '完了'
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
  consultation: '',
  displayOrder: [],
  scores: {},
  best_slot: null,
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

  state = {
    ...state,
    ...stored,
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
  if (state.step === 'consultation') renderConsultation();
  if (state.step === 'eval1') renderEvalStep(1);
  if (state.step === 'eval2') renderEvalStep(2);
  if (state.step === 'eval3') renderEvalStep(3);
  if (state.step === 'best_choice') renderBestChoice();
  if (state.step === 'complete') renderComplete();

  backButton.disabled = state.step === 'intro' || state.step === 'complete';
  nextButton.textContent = state.step === 'best_choice' ? '完了して送信' : '次へ';
  nextButton.classList.toggle('hidden', state.step === 'complete');
}

function renderIntro() {
  // 正式な実験説明・同意文言は公開前に差し替える前提のプレースホルダ。
  app.append(
    createElement('h2', '研究協力のお願い'),
    createElement('p', 'このページでは、家計に関する相談文と3つのアドバイスを読み、それぞれを評価していただきます。所要時間は数分程度を想定しています。', 'section-text'),
    createElement('p', 'ここに正式な実験説明、同意文言、謝礼、問い合わせ先を記載してください。この文面は公開前に編集する前提のプレースホルダです。', 'section-text'),
    createElement('p', '属性選択では、実際のご家庭と異なる条件を選んでも構いません。想定の家計として回答してください。', 'note')
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
    } else {
      group.append(createRadioGrid(`presurvey-${item.id}`, item.options, state.presurvey[item.id], (value) => {
        state.presurvey[item.id] = value;
        saveState();
      }));
    }
    form.append(group);
  });
  app.append(createElement('h2', '事前アンケート'), form);
}

function renderAttributes() {
  const form = createElement('div', '', 'form-grid');

  const familyGroup = createFieldset('家族人数');
  familyGroup.append(createOptionCards('family', patterns.family, state.attributes.family, (value) => {
    state.attributes.family = value;
    updatePatternKey();
    resetEvaluationState();
    saveState();
  }));
  form.append(familyGroup);

  patterns.expenses.forEach((expense) => {
    const group = createFieldset(expense.label);
    const options = [
      { key: 'L', label: expense.low },
      { key: 'H', label: expense.high }
    ];
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
    createElement('p', 'ご自身の実態と違っても構いません。想定の家計条件として、各項目を選んでください。', 'note'),
    form
  );
}

function renderConsultation() {
  const list = createElement('div', '', 'consultation-list');
  patterns.consultations.forEach((item) => {
    const label = createElement('label', '', 'choice-card');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'consultation';
    input.value = item.key;
    input.checked = state.consultation === item.key;
    input.addEventListener('change', () => {
      state.consultation = item.key;
      resetEvaluationState();
      saveState();
      render();
    });

    const body = document.createElement('span');
    body.append(
      createElement('span', `${item.key}: ${item.title}`, 'choice-title'),
      createElement('span', item.text, 'consultation-text')
    );
    label.append(input, body);
    list.append(label);
  });

  app.append(
    createElement('h2', '相談文選択'),
    createElement('p', '評価したい相談文を1つ選んでください。', 'section-text'),
    list
  );
}

function renderEvalStep(slot) {
  const patternKey = state.attributes.patternKey;
  const adviceSet = advice[patternKey] && advice[patternKey][state.consultation];
  if (!Array.isArray(adviceSet) || adviceSet.length !== 3) {
    app.append(
      createElement('h2', `アドバイス${slot}評価`),
      createElement('p', '選択条件に対応するアドバイスが見つかりません。前の画面に戻って選択内容を確認してください。', 'section-text')
    );
    return;
  }

  if (!Array.isArray(state.displayOrder) || state.displayOrder.length !== 3) {
    state.displayOrder = shuffle([0, 1, 2]);
    saveState();
  }

  const consultation = patterns.consultations.find((item) => item.key === state.consultation);
  const summary = createElement('div', '', 'summary-box');
  summary.append(
    createElement('p', `相談文: ${state.consultation} ${consultation ? consultation.title : ''}`),
    createElement('p', `属性: ${formatAttributes()}`)
  );

  const arrayIndex = state.displayOrder[slot - 1];
  app.append(createElement('h2', `アドバイス${slot}評価`), summary, createAdviceCard(slot, arrayIndex, adviceSet[arrayIndex]));
}

function renderBestChoice() {
  const best = createFieldset('3つのうち、最も良いと思ったアドバイスを1つ選んでください。');
  best.classList.add('best-choice');
  best.append(createRadioGrid('best-slot', ['アドバイス1', 'アドバイス2', 'アドバイス3'], state.best_slot ? `アドバイス${state.best_slot}` : '', (value) => {
    state.best_slot = Number(value.replace('アドバイス', ''));
    saveState();
  }));
  app.append(createElement('h2', '最良選択'), best);
}

function createAdviceCard(displaySlot, arrayIndex, text) {
  const card = createElement('article', '', 'advice-card');
  const header = createElement('div', '', 'advice-header');
  header.append(createElement('span', `アドバイス${displaySlot}`, 'advice-label'));

  const body = createElement('div', '', 'advice-body');
  body.append(renderAdviceText(text || ''));

  const ratings = createElement('div', '', 'ratings');
  patterns.eval_items.forEach((item) => {
    const row = createElement('div', '', 'rating-row');
    row.append(createElement('p', `${item.label}: ${item.question}`, 'rating-question'));
    row.append(createLikert(displaySlot, item));
    ratings.append(row);
  });

  card.append(header, body, ratings);
  return card;
}

function createLikert(displaySlot, item) {
  const wrap = createElement('div', '', 'likert');
  const saved = state.scores[String(displaySlot)] && state.scores[String(displaySlot)][item.id];
  patterns.likert5.forEach((label, index) => {
    const option = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `score-${displaySlot}-${item.id}`;
    input.value = String(index + 1);
    input.checked = Number(saved) === index + 1;
    input.addEventListener('change', () => {
      const key = String(displaySlot);
      state.scores[key] = state.scores[key] || {};
      state.scores[key][item.id] = index + 1;
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

  const restartButton = createElement('button', 'もう一度最初から回答する', 'secondary');
  restartButton.type = 'button';
  restartButton.addEventListener('click', () => {
    if (confirm('最初からやり直しますか？\n新しい参加者IDが発行されます。提出済みの回答はそのまま残ります。')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
  row.append(restartButton);

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
  labels.forEach((label) => {
    const item = { key: label, label };
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
}

async function goNext() {
  if (!validateStep()) return;

  if (state.step === 'best_choice') {
    state.step = 'complete';
    state.lastPayload = buildPayload();
    saveState();
    render();
    await submitPayload();
    return;
  }

  const index = STEPS.indexOf(state.step);
  state.step = STEPS[index + 1];
  if (state.step === 'eval1') {
    ensureDisplayOrder();
  }
  saveState();
  render();
}

function validateStep() {
  if (state.step === 'intro') return true;

  if (state.step === 'presurvey') {
    const missing = patterns.presurvey.some((item) => !state.presurvey[item.id]);
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

  if (state.step === 'consultation') {
    if (!state.consultation) {
      showMessage('error', '相談文を1つ選んでください。');
      return false;
    }
    const patternKey = state.attributes.patternKey;
    if (!advice[patternKey] || !advice[patternKey][state.consultation]) {
      showMessage('error', '選択した相談文に対応するアドバイスが見つかりません。');
      return false;
    }
  }

  if (state.step === 'eval1' || state.step === 'eval2' || state.step === 'eval3') {
    const slot = Number(state.step.replace('eval', ''));
    const slotScores = state.scores[String(slot)] || {};
    const missing = SCORE_IDS.some((id) => !slotScores[id]);
    if (missing) {
      showMessage('error', `アドバイス${slot}の未回答項目があります。`);
      return false;
    }
  }

  if (state.step === 'best_choice') {
    if (!state.best_slot) {
      showMessage('error', '最も良いと思ったアドバイスを1つ選んでください。');
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
  state.displayOrder = [];
  state.scores = {};
  state.best_slot = null;
  state.submitted = false;
  state.submitError = '';
  state.lastPayload = null;
}

function ensureDisplayOrder() {
  if (!Array.isArray(state.displayOrder) || state.displayOrder.length !== 3) {
    state.displayOrder = shuffle([0, 1, 2]);
  }
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
  ensureDisplayOrder();
  const bestArrayIndex = state.displayOrder[state.best_slot - 1];
  return {
    participant_id: state.participant_id,
    wid: state.wid,
    timestamp: new Date().toISOString(),
    presurvey: {
      fp_experience: state.presurvey.fp_experience,
      fp_trust: state.presurvey.fp_trust,
      manages_finance: state.presurvey.manages_finance
    },
    attributes: {
      family: state.attributes.family,
      ins: state.attributes.ins,
      com: state.attributes.com,
      fod: state.attributes.fod,
      patternKey: state.attributes.patternKey
    },
    consultation: state.consultation,
    items: state.displayOrder.map((arrayIndex, displayIndex) => {
      const displaySlot = displayIndex + 1;
      return {
        display_slot: displaySlot,
        array_index: arrayIndex,
        scores: state.scores[String(displaySlot)]
      };
    }),
    best_slot: state.best_slot,
    best_array_index: bestArrayIndex
  };
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
  const family = patterns.family.find((item) => item.key === state.attributes.family);
  const familyLabel = family ? family.label : state.attributes.family;
  const labels = patterns.expenses.map((expense) => {
    const value = state.attributes[expense.id];
    return `${expense.label} ${value === 'H' ? expense.high : expense.low}`;
  });
  return [familyLabel, ...labels].join(' / ');
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
