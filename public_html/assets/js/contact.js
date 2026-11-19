(function () {
'use strict';
var SP = window.SP;
var form = document.getElementById('contact-form');
if (form) {
var btn = form.querySelector('[type="submit"]');
var alertBox = form.querySelector('.form-alert');
var startedAt = Date.now(), idemKey = null, busy = false;
var tsBox = form.querySelector('.ts-box');
SP.turnstile(tsBox);
var f = form.elements;
var rules = {
full_name: function () { return SP.validators.name(f.full_name.value) ? '' : 'Please enter your full name.'; },
email: function () { return SP.validators.email(f.email.value) ? '' : 'Enter a valid email address.'; },
phone: function () { return SP.validators.phone(f.phone.value, f.country_code.value) ? '' : 'Enter a valid 10-digit mobile number.'; },
subject: function () { return SP.validators.text(f.subject.value, 3, 150) ? '' : 'Please add a subject (3–150 characters).'; },
message: function () { return SP.validators.text(f.message.value, 10, 2000) ? '' : 'Please write a message of at least 10 characters.'; }
};
function validate(name) {
var names = name ? [name] : Object.keys(rules), ok = true;
names.forEach(function (n) { var msg = rules[n](); SP.setFieldError(f[n], msg); if (msg) ok = false; });
return ok;
}
form.addEventListener('blur', function (e) { if (rules[e.target.name] && e.target.closest('.has-error')) validate(e.target.name); }, true);
form.addEventListener('input', function () { if (alertBox.classList.contains('success')) alertBox.className = 'form-alert'; });
function setBusy(on) {
busy = on; btn.disabled = on; btn.classList.toggle('is-loading', on);
btn.querySelector('span').textContent = on ? 'Sending…' : 'Send Message';
}
function alert(type, html) { alertBox.className = 'form-alert ' + type + ' is-visible'; alertBox.innerHTML = html; }
form.addEventListener('submit', function (e) {
e.preventDefault();
if (busy) return;
if (!validate()) { var x = form.querySelector('.has-error input, .has-error textarea'); if (x) x.focus(); return; }
setBusy(true);
if (!idemKey) idemKey = SP.newIdempotencyKey();
var cc = f.country_code.value;
var data = {
full_name: f.full_name.value.trim(), email: f.email.value.trim(),
phone: cc + ' ' + SP.cleanPhone(f.phone.value, cc),
subject: f.subject.value.trim(), message: f.message.value.trim()
};
SP.submitLead('contact', data, { idempotencyKey: idemKey, startedAt: startedAt, honeypot: f.website.value, turnstileToken: SP.turnstileToken(tsBox) })
.then(function (res) {
try {
sessionStorage.setItem('sp_lead', JSON.stringify({ type: 'contact', id: res.id, name: data.full_name, email: data.email, phone: data.phone, subject: data.subject, at: Date.now() }));
} catch (e) {}
SP.trackAndGo({ event: 'generate_lead', form_type: 'contact', form_location: 'contact_page', lead_id: res.id }, '/thank-you?ref=' + encodeURIComponent(res.id));
})
.catch(function (err) {
setBusy(false);
if (err && err.fields) Object.keys(err.fields).forEach(function (k) { if (f[k]) SP.setFieldError(f[k], err.fields[k]); });
if (err && (err.code === 'validation' || err.code === 'spam')) idemKey = null;
alert('error', '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#alert"></use></svg><div><strong>Message not sent.</strong> ' +
SP.escape((err && err.message) || 'Please try again.') + '<br><button type="submit" class="btn btn-dark">Try again</button></div>');
});
});
var again = document.querySelector('[data-send-another]');
if (again) again.addEventListener('click', function () {
document.getElementById('contact-success').hidden = true; form.hidden = false; alertBox.className = 'form-alert';
});
}
var mapFrame = document.querySelector('[data-map]');
if (mapFrame) {
var tabs = document.querySelectorAll('[data-map-city]');
function load(city) {
var src = 'https://www.google.com/maps?q=' + encodeURIComponent(city + ', India') + '&z=11&output=embed';
var ifr = mapFrame.querySelector('iframe');
if (!ifr) {
ifr = document.createElement('iframe');
ifr.loading = 'lazy'; ifr.referrerPolicy = 'no-referrer-when-downgrade'; ifr.allowFullscreen = true;
mapFrame.appendChild(ifr);
var ph = mapFrame.querySelector('.map-placeholder'); if (ph) ph.remove();
}
ifr.title = 'Map of ' + city;
ifr.src = src;
}
tabs.forEach(function (t) {
t.addEventListener('click', function () {
tabs.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
t.setAttribute('aria-pressed', 'true');
load(t.dataset.mapCity);
});
});
if ('IntersectionObserver' in window) {
var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load('Bengaluru'); io.disconnect(); } }, { rootMargin: '200px' });
io.observe(mapFrame);
} else load('Bengaluru');
}
})();