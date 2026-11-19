/**
 * Shiftingpartner — Google Sheets lead receiver (Google Apps Script web app)
 * ===========================================================================
 * Website form  ──►  this script  ──►  your Google Sheet   (instant, no Supabase)
 *   • "Consultation Leads"  ← Get Free Consultation form
 *   • "Contact Enquiries"   ← Contact Us form
 * Every submission gets a unique reference number generated here:
 *   SP-20261119-00125  (consultation)      SPE-20261119-00007  (contact)
 *
 * SETUP
 *  1. Open the Google Sheet  →  Extensions  →  Apps Script.
 *  2. Delete the sample code, paste this whole file, click Save.
 *  3. Select function "setup" in the toolbar → Run → allow the permissions.
 *  4. Deploy → New deployment → type "Web app"
 *       Execute as: Me      Who has access: Anyone
 *     → Deploy → copy the Web app URL (ends with /exec).
 *  5. Paste that URL into public_html/assets/js/config.js → appsScriptUrl.
 *  Optional: Project Settings → Script properties → NOTIFY_EMAIL = your email
 *            (an email alert for every lead; adds about 1 second per submission).
 *  After editing this code later: Deploy → Manage deployments → Edit →
 *  Version: New version → Deploy  (the URL stays the same).
 */

// Your sheet: https://docs.google.com/spreadsheets/d/1v3vaTWo_pKCDMeYrRfDkusf3XQMVwIuwNkRRuumYGh0/edit
var SPREADSHEET_ID = '1v3vaTWo_pKCDMeYrRfDkusf3XQMVwIuwNkRRuumYGh0';
var TZ = 'Asia/Kolkata';

var SHEETS = {
  consultation: {
    name: 'Consultation Leads',
    prefix: 'SP',
    source: 'Website – Free Consultation',
    headers: ['Lead ID', 'Date', 'Name', 'Phone', 'Email', 'Pickup Location', 'Drop Location', 'Move Type', 'Lift Availability', 'Lead Source', 'Status']
  },
  contact: {
    name: 'Contact Enquiries',
    prefix: 'SPE',
    source: 'Website – Contact Form',
    headers: ['Enquiry ID', 'Date', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Lead Source']
  }
};

var MOVE_TYPES = ['Local Shifting (Within City)', 'Intercity Shifting (Between Cities)'];
var LIFT_OPTIONS = ['Yes, at both locations', 'Yes, at pickup only', 'Yes, at drop location only', 'No, at neither location'];

// ---------------------------------------------------------------------------
function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function setup() {
  var ss = ss_();
  Object.keys(SHEETS).forEach(function (k) {
    var cfg = SHEETS[k];
    var sh = ss.getSheetByName(cfg.name) || ss.insertSheet(cfg.name);
    if (sh.getLastRow() === 0) sh.appendRow(cfg.headers);
    sh.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers])
      .setFontWeight('bold').setBackground('#101B2D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, cfg.headers.length, 170);
    if (k === 'consultation') {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Lost'], true).build();
      sh.getRange(2, 11, sh.getMaxRows() - 1, 1).setDataValidation(rule);
    } else {
      sh.setColumnWidth(7, 380);
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(def);
}

// Health check: open the /exec URL in a browser → {"ok":true,...}
function doGet() {
  return out({ ok: true, service: 'Shiftingpartner lead receiver' });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var type = body.type === 'contact' ? 'contact' : body.type === 'consultation' ? 'consultation' : '';
    if (!type) return out({ ok: false, error: 'bad_type' });
    var cfg = SHEETS[type];

    // Spam protection
    if (String(body.website || '').trim() !== '') return out({ ok: false, error: 'spam', message: 'Your submission could not be verified.' });
    var elapsed = Number(body.elapsedMs || 0);
    if (elapsed > 0 && elapsed < 2500) return out({ ok: false, error: 'spam', message: 'Please take a moment to review your details and try again.' });
    if (globalRateLimited_()) return out({ ok: false, error: 'rate_limited', message: 'We are receiving many requests right now. Please try again in a few minutes or call us.' });

    var v = validate_(type, body.data || {});
    if (v.errors) return out({ ok: false, error: 'validation', message: 'Please correct the highlighted fields.', fields: v.errors });
    var d = v.data;

    var idem = String(body.idempotencyKey || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
    if (idem.length < 8) return out({ ok: false, error: 'bad_request' });

    var cache = CacheService.getScriptCache();
    var seen = cache.get('idem:' + idem);                       // same request retried / double click
    if (seen) return out({ ok: true, id: seen, duplicate: true });
    var fp = fingerprint_(type, d);                             // same details again within 10 min
    var seenFp = cache.get('fp:' + fp);
    if (seenFp) { cache.put('idem:' + idem, seenFp, 21600); return out({ ok: true, id: seenFp, duplicate: true }); }
    if (phoneRateLimited_(type, d.phone)) {
      return out({ ok: false, error: 'rate_limited', message: 'You have already sent several requests. Our team will contact you shortly.' });
    }

    var lock = LockService.getScriptLock(), id;
    lock.waitLock(20000);
    try {
      seen = cache.get('idem:' + idem);
      if (seen) return out({ ok: true, id: seen, duplicate: true });
      var ss = ss_();
      var sh = ss.getSheetByName(cfg.name);
      if (!sh) { setup(); sh = ss.getSheetByName(cfg.name); }
      var now = new Date();
      id = nextId_(cfg.prefix, now);
      var date = Utilities.formatDate(now, TZ, 'dd-MM-yyyy HH:mm:ss');
      var row = type === 'consultation'
        ? [id, date, d.full_name, d.phone, d.email, d.pickup, d.drop, d.move_type, d.lift, cfg.source, 'New']
        : [id, date, d.full_name, d.email, d.phone, d.subject, d.message, cfg.source];
      sh.appendRow(row.map(safeCell_));
      cache.put('idem:' + idem, id, 21600);
      cache.put('fp:' + fp, id, 600);
    } finally {
      lock.releaseLock();   // released before the optional email so other visitors aren't kept waiting
    }
    notify_(type, id, d);
    return out({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return out({ ok: false, error: 'server_error', message: 'We could not save your request right now. Please try again.' });
  }
}

// ---------------------------------------------------------------------------
// Validation (mirrors the website's checks)
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function validate_(type, raw) {
  var e = {}, d = {
    full_name: clean_(raw.full_name, 80),
    email: clean_(raw.email, 120).toLowerCase(),
    phone: clean_(raw.phone, 24)
  };
  if (!/^[\p{L} .'-]{2,80}$/u.test(d.full_name)) e.full_name = 'Please enter a valid full name.';
  if (!/^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i.test(d.email)) e.email = 'Please enter a valid email address.';
  var m = d.phone.match(/^(\+\d{1,4})\s?(\d{6,14})$/);
  if (!m || (m[1] === '+91' && !/^[6-9]\d{9}$/.test(m[2]))) e.phone = 'Please enter a valid phone number.';
  if (type === 'consultation') {
    d.pickup = clean_(raw.pickup, 200);
    d.drop = clean_(raw.drop, 200);
    d.move_type = clean_(raw.move_type, 60);
    d.lift = clean_(raw.lift, 60);
    if (d.pickup.length < 3) e.pickup = 'Please enter your pickup location.';
    if (d.drop.length < 3) e.drop = 'Please enter your drop location.';
    if (MOVE_TYPES.indexOf(d.move_type) < 0) e.move_type = 'Please choose a move type.';
    if (LIFT_OPTIONS.indexOf(d.lift) < 0) e.lift = 'Please choose lift availability.';
  } else {
    d.subject = clean_(raw.subject, 150);
    d.message = String(raw.message == null ? '' : raw.message).replace(/[\u0000-\u0009\u000B-\u001F\u007F<>]/g, ' ').trim().slice(0, 2000);
    if (d.subject.length < 3) e.subject = 'Please add a subject.';
    if (d.message.length < 10) e.message = 'Please write a message of at least 10 characters.';
  }
  return Object.keys(e).length ? { errors: e } : { data: d };
}

// Unique, sequential per day: SP-20261119-00125 / SPE-20261119-00007
function nextId_(prefix, now) {
  var day = Utilities.formatDate(now, TZ, 'yyyyMMdd');
  var props = PropertiesService.getScriptProperties();
  var key = 'seq_' + prefix + '_' + day;
  var n = Number(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(n));
  if (Math.random() < 0.05) {
    var all = props.getProperties();
    Object.keys(all).forEach(function (k) { var mm = k.match(/^seq_[A-Z]+_(\d{8})$/); if (mm && mm[1] < day) props.deleteProperty(k); });
  }
  return prefix + '-' + day + '-' + ('00000' + n).slice(-5);
}

// Max 40 direct submissions per 10 minutes across the whole site (anti-flood)
function globalRateLimited_() {
  var c = CacheService.getScriptCache(), k = 'rl:global:' + Math.floor(Date.now() / 600000);
  var n = Number(c.get(k) || '0') + 1; c.put(k, String(n), 700);
  return n > 40;
}
// Max 4 submissions per phone number per type per hour
function phoneRateLimited_(type, phone) {
  var c = CacheService.getScriptCache(), k = 'rl:' + type + ':' + phone.replace(/\D/g, '');
  var n = Number(c.get(k) || '0') + 1; c.put(k, String(n), 3600);
  return n > 4;
}

function fingerprint_(type, d) {
  var s = [type, d.phone, d.email, d.pickup || d.subject || '', d.drop || d.message || ''].join('|').toLowerCase();
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).slice(0, 40);
}

// Prevent spreadsheet formula injection (=, +, -, @ at the start of a cell)
function safeCell_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function notify_(type, id, d) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  try {
    var subject = (type === 'consultation' ? 'New consultation lead ' : 'New contact enquiry ') + id;
    var lines = Object.keys(d).map(function (k) { return k + ': ' + d[k]; });
    MailApp.sendEmail(to, subject, lines.join('\n') + '\n\nSheet: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
  } catch (err) { console.warn('notify failed', err); }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
