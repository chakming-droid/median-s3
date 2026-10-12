/**
 * 中位數作答收集。這是範本，密碼只是佔位，讀取會被拒絕，直到你改掉它。
 *
 * 1. 開一個新的 Google 試算表。
 * 2. 擴充功能 → Apps Script，把這份貼上，刪去原本的空白函式。
 * 3. 把 REVIEW_PASSWORD 改成和這部電腦 teacher-config.js 裡 reviewPassword 一樣的一句。
 * 4. 部署 → 新增部署 → 類型選「網路應用程式」。
 *    執行身分選你自己，存取權選「任何人」。
 * 5. 複製以 /exec 結尾的網址，貼進 teacher-config.js 的 collectUrl，儲存後重新整理。
 *
 * 學生頁只會 POST，不會帶密碼。讀取要密碼。
 * 不要把改過密碼的這份檔上傳到公開的 GitHub。
 */
var REVIEW_PASSWORD = "請在這裡改成你的密碼";
var PLACEHOLDER_PASSWORD = "請在這裡改成你的密碼";

function doPost(e) {
  try {
    var raw = "";
    if (e.parameter && e.parameter.payload) raw = e.parameter.payload;
    else if (e.postData && e.postData.contents) raw = e.postData.contents;
    appendRow_(JSON.parse(raw));
    return ContentService.createTextOutput("ok");
  } catch (error) {
    return ContentService.createTextOutput("bad");
  }
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var callback = String(params.callback || "callback").replace(/[^\w]/g, "");
  if (!callback) callback = "callback";
  var allowed = REVIEW_PASSWORD && REVIEW_PASSWORD !== PLACEHOLDER_PASSWORD && params.password === REVIEW_PASSWORD;
  var payload = { ok: false };
  if (allowed && params.action === "delete") {
    clearRows_();
    payload = { ok: true, deleted: true, rows: [] };
  } else if (allowed) {
    payload = { ok: true, rows: readRows_() };
  }
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(payload) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("作答");
  if (!sheet) sheet = ss.insertSheet("作答");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["時間", "編號", "來源", "題目", "步驟", "輸入", "對錯", "難點"]);
  }
  return sheet;
}

function clearRows_() {
  var sheet = sheet_();
  var last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
}

function appendRow_(row) {
  var ok = row.ok === true || row.ok === "對";
  var source = row.source === "試用" ? "試用" : "課堂";
  var values = [[
    String(row.at || new Date().toISOString()),
    String(row.device || "").slice(0, 16),
    source,
    String(row.lesson || "").slice(0, 40),
    String(row.step || "").slice(0, 20),
    String(row.input == null ? "" : row.input).slice(0, 80),
    ok ? "對" : "錯",
    ok ? "" : String(row.gap || "其他").slice(0, 40)
  ]];
  var sheet = sheet_();
  var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, 8);
  range.setNumberFormat("@");
  range.setValues(values);
}

function readRows_() {
  var values = sheet_().getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i += 1) {
    var line = values[i];
    if (!line[0]) continue;
    var ok = line[6] === "對" || line[6] === true;
    rows.push({
      at: cellText_(line[0]),
      device: cellText_(line[1]),
      source: cellText_(line[2]) === "試用" ? "試用" : "課堂",
      lesson: cellText_(line[3]),
      step: cellText_(line[4]),
      input: cellText_(line[5]),
      ok: ok,
      gap: ok ? "" : cellText_(line[7] || "其他")
    });
  }
  if (rows.length > 500) rows = rows.slice(rows.length - 500);
  return rows;
}

function cellText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Hong_Kong", "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(value == null ? "" : value);
}
