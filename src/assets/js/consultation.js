// Shiftingpartner — multi-step Free Consultation form
// Used on /consultation and inside the site-wide popup (same markup: partials/consult-form.html).
(function () {
  'use strict';
  var SP = window.SP, cfg = window.SP_CONFIG || {};
  var STORE = 'sp_consult_draft';

  function init(widget) {
    var form = widget.querySelector('[data-consult-form]');
    if (!form || form.dataset.ready) return;
    form.dataset.ready = '1';
    var steps = form.querySelectorAll('.form-step');
    var indicators = widget.querySelectorAll('.stepper li');
    var alertBox = form.querySelector('.form-alert');
    var submitBtn = form.querySelector('[data-submit]');
    var startedAt = Date.now();
    var idemKey = null, submitting = false, current = 1;

    function $(name) { return form.elements[name]; }
    function radioVal(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }

    // ---- persistence (keeps data on reload or a failed submission)
    function save() {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({
          pickup: $('pickup').value, drop: $('drop').value, move_type: radioVal('move_type'), lift: $('lift').value,
          full_name: $('full_name').value, country_code: $('country_code').value, phone: $('phone').value, email: $('email').value
        }));
      } catch (e) {}
    }
    function restore() {
      try {
        var d = JSON.parse(sessionStorage.getItem(STORE) || 'null'); if (!d) return;
        ['pickup', 'drop', 'full_name', 'phone', 'email', 'lift', 'country_code'].forEach(function (k) { if (d[k]) $(k).value = d[k]; });
        var r = form.querySelector('input[name="move_type"][value="' + String(d.move_type || '').replace(/"/g, '') + '"]'); if (r) r.checked = true;
      } catch (e) {}
    }
    restore();
    form.addEventListener('input', save);
    form.addEventListener('change', save);

    // ---- steps
    function go(n) {
      current = n;
      steps.forEach(function (s) { s.classList.toggle('is-active', +s.dataset.step === n); });
      indicators.forEach(function (li) {
        var i = +li.dataset.stepInd;
        li.classList.toggle('is-active', i === n);
        li.classList.toggle('is-done', i < n);
        if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (n === 2) renderSummary();
      var scroller = widget.closest('.popup-dialog');
      if (scroller) scroller.scrollTop = 0;
      else {
        var top = widget.getBoundingClientRect().top + window.scrollY - 100;
        if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
      }
      if (n === 2) setTimeout(function () { var f = $('full_name'); if (f && !f.value) f.focus({ preventScroll: true }); }, 350);
    }

    function groupError(name, msg) {
      var wrap = form.querySelector('[data-group="' + name + '"]'); if (!wrap) return;
      wrap.classList.toggle('has-error', !!msg);
      var e = wrap.querySelector('.field-error span'); if (e && msg) e.textContent = msg;
    }
    function validateStep1() {
      var ok = true, p = $('pickup'), d = $('drop'), l = $('lift');
      if (!SP.validators.text(p.value, 3, 200)) { SP.setFieldError(p, 'Please enter your pickup location.'); ok = false; } else SP.setFieldError(p);
      if (!SP.validators.text(d.value, 3, 200)) { SP.setFieldError(d, 'Please enter your drop location.'); ok = false; } else SP.setFieldError(d);
      if (!radioVal('move_type')) { groupError('move_type', 'Please choose a move type.'); ok = false; } else groupError('move_type');
      if (!l.value) { SP.setFieldError(l, 'Please tell us about lift availability.'); ok = false; } else SP.setFieldError(l);
      return ok;
    }
    function validateStep2() {
      var ok = true, n = $('full_name'), ph = $('phone'), em = $('email'), cc = $('country_code').value;
      if (!SP.validators.name(n.value)) { SP.setFieldError(n, 'Please enter your full name (letters only).'); ok = false; } else SP.setFieldError(n);
      if (!SP.validators.phone(ph.value, cc)) { SP.setFieldError(ph, cc === '+91' ? 'Enter a valid 10-digit Indian mobile number.' : 'Enter a valid phone number.'); ok = false; } else SP.setFieldError(ph);
      if (!SP.validators.email(em.value)) { SP.setFieldError(em, 'Enter a valid email address.'); ok = false; } else SP.setFieldError(em);
      return ok;
    }
    function focusFirstError() { var f = form.querySelector('.has-error input, .has-error select'); if (f) f.focus(); }

    form.querySelector('[data-next]').addEventListener('click', function () { if (validateStep1()) go(2); else focusFirstError(); });
    form.querySelector('[data-back]').addEventListener('click', function () { hideAlert(); go(1); });
    form.addEventListener('change', function (e) { if (e.target.name === 'move_type') groupError('move_type'); });
    form.addEventListener('blur', function (e) {
      var t = e.target; if (!t.closest || !t.closest('.field.has-error')) return;
      if (current === 1) validateStep1(); else validateStep2();
    }, true);

    function renderSummary() {
      var box = form.querySelector('[data-summary]'); if (!box) return;
      var e = SP.escape;
      box.innerHTML = '<div><span>From</span><strong>' + e($('pickup').value) + '</strong></div>' +
        '<div><span>To</span><strong>' + e($('drop').value) + '</strong></div>' +
        '<div><span>Move type</span><strong>' + e(radioVal('move_type')) + '</strong></div>';
    }
    function showAlert(msg, retry) {
      alertBox.className = 'form-alert error is-visible';
      alertBox.innerHTML = '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#alert"></use></svg><div><strong>Your request was not sent.</strong> ' +
        SP.escape(msg) + ' Your details are saved.' + (retry ? '<br><button type="button" class="btn btn-dark" data-retry>Try again</button>' : '') + '</div>';
      alertBox.focus();
      var r = alertBox.querySelector('[data-retry]'); if (r) r.addEventListener('click', submit);
    }
    function hideAlert() { alertBox.className = 'form-alert'; alertBox.innerHTML = ''; }

    function submit() {
      if (submitting) return;
      if (!validateStep1()) { go(1); focusFirstError(); return; }
      if (!validateStep2()) { focusFirstError(); return; }
      hideAlert();
      submitting = true;
      submitBtn.disabled = true; submitBtn.classList.add('is-loading');
      submitBtn.querySelector('span').textContent = 'Submitting…';
      if (!idemKey) idemKey = SP.newIdempotencyKey();
      var cc = $('country_code').value;
      var data = {
        full_name: $('full_name').value.trim(),
        phone: cc + ' ' + SP.cleanPhone($('phone').value, cc),
        email: $('email').value.trim(),
        pickup: $('pickup').value.trim(),
        drop: $('drop').value.trim(),
        move_type: radioVal('move_type'),
        lift: $('lift').value
      };
      SP.submitLead('consultation', data, { idempotencyKey: idemKey, startedAt: startedAt, honeypot: $('website').value })
        .then(function (res) {
          try {
            sessionStorage.setItem('sp_lead', JSON.stringify({ id: res.id, name: data.full_name, pickup: data.pickup, drop: data.drop, move_type: data.move_type, at: Date.now() }));
            sessionStorage.removeItem(STORE);
            localStorage.setItem('sp_lead_done', String(Date.now()));
          } catch (e) {}
          SP.trackAndGo({ event: 'generate_lead', form_type: 'consultation', form_location: widget.closest('.popup') ? 'popup' : 'consultation_page', move_type: data.move_type, lead_id: res.id },
            '/thank-you?ref=' + encodeURIComponent(res.id));
        })
        .catch(function (err) {
          submitting = false;
          submitBtn.disabled = false; submitBtn.classList.remove('is-loading');
          submitBtn.querySelector('span').textContent = 'Submit Request';
          if (err && err.fields) Object.keys(err.fields).forEach(function (k) { if ($(k)) SP.setFieldError($(k), err.fields[k]); });
          if (err && (err.code === 'validation' || err.code === 'spam')) idemKey = null;
          showAlert((err && err.message) || 'Something went wrong.', err && err.code !== 'validation');
        });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

    // Prefill from ?from=&to= (city pages)
    var qs = new URLSearchParams(location.search);
    if (qs.get('from') && !$('pickup').value) $('pickup').value = qs.get('from').slice(0, 120);
    if (qs.get('to') && !$('drop').value) $('drop').value = qs.get('to').slice(0, 120);

    initPlaces(form);
  }

  // ---- Google Places Autocomplete (optional, only when an API key is configured)
  var placesQueue = [], placesLoading = false;
  function initPlaces(form) {
    if (!cfg.googleMapsApiKey) return;
    placesQueue.push(form);
    if (window.google && google.maps && google.maps.places) return window.spInitPlaces();
    if (placesLoading) return;
    placesLoading = true;
    window.spInitPlaces = function () {
      placesQueue.splice(0).forEach(function (f) {
        ['pickup', 'drop'].forEach(function (name) {
          try {
            var input = f.elements[name];
            var ac = new google.maps.places.Autocomplete(input, { componentRestrictions: { country: 'in' }, fields: ['formatted_address', 'name'] });
            ac.addListener('place_changed', function () { var p = ac.getPlace(); if (p && (p.formatted_address || p.name)) { input.value = p.formatted_address || p.name; SP.setFieldError(input); } });
          } catch (e) { console.info('Places autocomplete unavailable', e); }
        });
      });
    };
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(cfg.googleMapsApiKey) + '&libraries=places&loading=async&callback=spInitPlaces';
    s.async = true; document.head.appendChild(s);
  }

  SP.initConsultForms = function (root) { (root || document).querySelectorAll('[data-consult-widget]').forEach(init); };
  SP.initConsultForms();

  // =====================================================================
  // Site-wide popup: opens once after 8 seconds (not again for 7 days, never after a lead)
  // =====================================================================
  var popup = document.getElementById('consult-popup');
  if (!popup) return;
  var KEY = 'sp_popup_seen', WEEK = 7 * 864e5, lastFocus = null;
  function seenRecently() {
    try {
      if (localStorage.getItem('sp_lead_done')) return true;
      var t = +localStorage.getItem(KEY) || 0; return Date.now() - t < WEEK;
    } catch (e) { return false; }
  }
  function open(auto) {
    if (!popup.hidden) return;
    lastFocus = document.activeElement;
    popup.hidden = false;
    requestAnimationFrame(function () { popup.classList.add('is-open'); });
    document.body.classList.add('popup-open');
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: 'consultation_popup_open', popup_trigger: auto ? 'timer_8s' : 'click' });
    setTimeout(function () { var c = popup.querySelector('[data-popup-close]'); if (c) c.focus(); }, 300);
  }
  function close() {
    popup.classList.remove('is-open');
    document.body.classList.remove('popup-open');
    setTimeout(function () { popup.hidden = true; }, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  popup.addEventListener('click', function (e) { if (e.target === popup || e.target.closest('[data-popup-close]')) close(); });
  document.addEventListener('keydown', function (e) {
    if (popup.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside the dialog
      var f = popup.querySelectorAll('button, [href], input, select, textarea');
      var vis = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
      if (!vis.length) return;
      var first = vis[0], last = vis[vis.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  if (!seenRecently()) setTimeout(function () {
    // don't interrupt someone typing in another form or with the mobile menu open
    var a = document.activeElement;
    if (document.body.classList.contains('nav-open') || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return;
    open(true);
  }, 8000);
  SP.openConsultPopup = function () { open(false); };
})();
