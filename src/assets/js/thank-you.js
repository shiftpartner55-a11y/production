// Shiftingpartner — Thank-you page: shows the backend-generated Lead Reference Number and request summary
(function () {
  'use strict';
  var SP = window.SP;
  var box = document.getElementById('thanks-details');
  if (!box) return;
  var lead = null;
  try { lead = JSON.parse(sessionStorage.getItem('sp_lead') || 'null'); } catch (e) {}
  var ref = new URLSearchParams(location.search).get('ref');
  // Only trust the stored lead when it matches the reference in the URL (and is recent)
  if (lead && ref && lead.id === ref && Date.now() - (lead.at || 0) < 6 * 3600e3) {
    document.querySelector('[data-ref]').textContent = lead.id;
    document.querySelector('[data-first-name]').textContent = (lead.name || '').split(' ')[0];
    var rows;
    if (lead.type === 'contact') {
      document.querySelector('[data-eyebrow]').textContent = 'Message received';
      document.querySelector('[data-message]').textContent = 'Your message has been successfully received. Our team will get back to you shortly.';
      document.querySelector('[data-ref-label]').textContent = 'Enquiry Reference Number';
      document.title = 'Thank You – Message Received | Shiftingpartner';
      rows = [['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone], ['Subject', lead.subject], ['Enquiry Reference Number', lead.id]];
    } else {
      rows = [['Customer Name', lead.name], ['Pickup Location', lead.pickup], ['Drop Location', lead.drop], ['Move Type', lead.move_type], ['Lead Reference Number', lead.id]];
    }
    box.innerHTML = rows.map(function (r) { return '<div><span>' + r[0] + '</span><strong>' + SP.escape(r[1] || '—') + '</strong></div>'; }).join('');
    document.getElementById('thanks-found').hidden = false;
    var copy = document.querySelector('[data-copy-ref]');
    if (copy) copy.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(lead.id).then(function () { copy.lastChild.textContent = ' Copied'; setTimeout(function () { copy.lastChild.textContent = ' Copy'; }, 1800); });
    });
  } else {
    document.getElementById('thanks-generic').hidden = false;
  }
})();
