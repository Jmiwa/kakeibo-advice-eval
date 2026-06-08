const SHEET_ID = '1On9mAguATV_7wwsGVeKAKDWvvq1cE0QMiN2KpIyXsYI';
const SHEET_NAME = 'responses';

const HEADERS = [
  'timestamp',
  'participant_id',
  'wid',
  'fp_experience',
  'fp_trust',
  'fp_trust_reason',
  'manages_finance',
  'family',
  'ins',
  'com',
  'fod',
  'patternKey',
  'consultation',
  'display_slot',
  'array_index',
  'relevance',
  'usefulness',
  'specificity',
  'trust',
  'intention',
  'is_best'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateSheet_(spreadsheet);
    ensureHeader_(sheet);

    const rows = [];
    ['A', 'B', 'C'].forEach(function(c) {
      const items = (payload.items && payload.items[c]) || [];
      const best = (payload.best && payload.best[c]) || {};
      items.forEach(function(item) {
        const scores = item.scores || {};
        rows.push([
          payload.timestamp,
          payload.participant_id,
          payload.wid || '',
          payload.presurvey.fp_experience,
          payload.presurvey.fp_trust,
          payload.presurvey.fp_trust_reason || '',
          payload.presurvey.manages_finance,
          payload.attributes.family,
          payload.attributes.ins,
          payload.attributes.com,
          payload.attributes.fod,
          payload.attributes.patternKey || '',
          c,
          item.display_slot,
          item.array_index,
          scores.relevance,
          scores.usefulness,
          scores.specificity,
          scores.trust,
          scores.intention,
          best.slot === item.display_slot
        ]);
      });
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return json_({ status: 'ok' });
  } catch (error) {
    return json_({ status: 'error', message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const values = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeader = values.some(function(value) {
    return value !== '';
  });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
