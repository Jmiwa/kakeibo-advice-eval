const SHEET_ID = '1ge6Q3SPY0s37PrFwwfa79BX1ofn83UxXHrZ8qaNF5YE';
const SHEET_NAME = 'responses';

const HEADERS = [
  'timestamp',
  'participant_id',
  'wid',
  'fp_experience',
  'fp_trust',
  'manages_finance',
  'family',
  'ins',
  'com',
  'fod',
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

    const rows = payload.items.map(function(item) {
      const scores = item.scores || {};
      return [
        payload.timestamp,
        payload.participant_id,
        payload.wid || '',
        payload.presurvey.fp_experience,
        payload.presurvey.fp_trust,
        payload.presurvey.manages_finance,
        payload.attributes.family,
        payload.attributes.ins,
        payload.attributes.com,
        payload.attributes.fod,
        payload.consultation,
        item.display_slot,
        item.array_index,
        scores.relevance,
        scores.usefulness,
        scores.specificity,
        scores.trust,
        scores.intention,
        payload.best_slot === item.display_slot
      ];
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
