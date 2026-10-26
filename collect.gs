var REVIEW_PASSWORD = "請在這裡改成你的密碼"; // 只改這一行引號裡的句子，寫回原本的密碼
var PLACEHOLDER_PASSWORD = "請在這裡改成你的密碼"; // 這一行不要改

/**
 * 用法：全選這份，貼去 Apps Script，覆蓋原本全部內容。
 * 貼上之前，先抄下舊程式裡 REVIEW_PASSWORD 引號中的密碼。
 * 貼上之後，只把第 1 行引號裡的句子改回該密碼。第 2 行不要動。
 * 然後選「部署」→「管理部署」→ 鉛筆 → 版本選「新版本」→「部署」。
 * 不要按「新增部署」。不要把改過密碼的這份檔上傳到 GitHub。
 *
 * 學生頁可讀 action=release，只拿到已解鎖的活動編號，沒有作答。
 * 改解鎖要用密碼，action=set-release。讀取作答仍要密碼。
 */

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

function releaseIds_() {
  var raw = "[]";
  try { raw = PropertiesService.getScriptProperties().getProperty("lesson-release") || "[]"; }
  catch (error) { raw = "[]"; }
  return cleanRelease_(raw);
}

function cleanRelease_(raw) {
  var ids = [];
  try { ids = JSON.parse(raw); } catch (error) { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  var allow = { bridge: true, bridge2: true, pens: true, freq: true, sheet: true };
  var clean = [];
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i] || "");
    if (allow[id] && clean.indexOf(id) < 0) clean.push(id);
  }
  return clean;
}

function writeRelease_(raw) {
  var clean = cleanRelease_(typeof raw === "string" ? raw : JSON.stringify(raw || []));
  PropertiesService.getScriptProperties().setProperty("lesson-release", JSON.stringify(clean));
  return clean;
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var callback = String(params.callback || "callback").replace(/[^\w]/g, "");
  if (!callback) callback = "callback";
  var allowed = REVIEW_PASSWORD && REVIEW_PASSWORD !== PLACEHOLDER_PASSWORD && params.password === REVIEW_PASSWORD;
  var payload = { ok: false };
  if (params.action === "release") {
    payload = { ok: true, ids: releaseIds_() };
  } else if (allowed && params.action === "set-release") {
    payload = { ok: true, ids: writeRelease_(params.ids || "[]") };
  } else if (allowed && params.action === "delete") {
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
