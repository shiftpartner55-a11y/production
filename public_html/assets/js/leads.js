(function () {
'use strict';
var cfg = window.SP_CONFIG || {};
var SP = window.SP = window.SP || {};
SP.validators = {
name: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 80 && /^[\p{L} .'-]+$/u.test(v); },
email: function (v) { return /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) && v.length <= 120; },
phone: function (v, code) {
var d = String(v).replace(/[\s-]/g, '');
if ((code || '+91') === '+91') { d = d.replace(/^(\+?91|0)(?=\d{10}$)/, ''); return /^[6-9]\d{9}$/.test(d); }
return /^\d{6,14}$/.test(d);
},
text: function (v, min, max) { v = v.trim(); return v.length >= (min || 1) && v.length <= (max || 2000); }
};
SP.cleanPhone = function (v, code) {
var d = String(v).replace(/[\s-]/g, '');
if ((code || '+91') === '+91') d = d.replace(/^(\+?91|0)(?=\d{10}$)/, '');
return d;
};
SP.setFieldError = function (field, message) {
var wrap = field.closest('.field');
if (!wrap) return;
var err = wrap.querySelector('.field-error');
if (message) {
wrap.classList.add('has-error');
field.setAttribute('aria-invalid', 'true');
if (err) { var sp = err.querySelector('span') || err; sp.textContent = message; }
} else {
wrap.classList.remove('has-error');
field.removeAttribute('aria-invalid');
}
};
function uuid() {
if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
}
SP.newIdempotencyKey = uuid;
SP.leadEndpoint = function () { return cfg.appsScriptUrl || ''; };
SP.turnstile = function () { return Promise.resolve(null); };
SP.turnstileToken = function () { return ''; };
SP.submitLead = function (type, data, meta) {
var url = SP.leadEndpoint();
if (!url) {
return Promise.reject({ code: 'not_configured', message: 'Online submissions are not configured yet. Please call or WhatsApp us on ' + (cfg.phoneDisplay || '+91 78921 15167') + '.' });
}
var body = JSON.stringify({
type: type, data: data,
idempotencyKey: meta.idempotencyKey, elapsedMs: Date.now() - (meta.startedAt || Date.now()),
website: meta.honeypot || '', page: location.pathname
});
var headers = { 'Content-Type': 'text/plain;charset=utf-8' };
function attempt(n) {
var ctrl = 'AbortController' in window ? new AbortController() : null;
var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
return fetch(url, { method: 'POST', headers: headers, body: body, signal: ctrl ? ctrl.signal : undefined })
.then(function (res) {
clearTimeout(timer);
return res.json().catch(function () { return {}; }).then(function (json) {
if (res.ok && json.ok && json.id) return json;
var err = { code: json.error || ('http_' + res.status), message: json.message || 'We could not submit your request right now. Please try again.', fields: json.fields };
if ((res.status >= 500 || json.error === 'server_error') && n < 1) return wait(1200).then(function () { return attempt(n + 1); });
throw err;
});
}, function (e) {
clearTimeout(timer);
if (n < 1) return wait(1200).then(function () { return attempt(n + 1); });
throw { code: 'network', message: 'Network problem — please check your connection and try again.' };
});
}
return attempt(0);
};
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
SP.trackAndGo = function (evt, url) {
var done = false;
function go() { if (!done) { done = true; window.location.href = url; } }
var dl = window.dataLayer = window.dataLayer || [];
evt.eventCallback = go; evt.eventTimeout = 700;
dl.push(evt);
setTimeout(go, window.google_tag_manager ? 750 : 0);
};
})();