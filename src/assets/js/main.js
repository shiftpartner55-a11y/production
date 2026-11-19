// Shiftingpartner — global UI behaviour (header, mobile nav, reveal, WhatsApp links)
(function () {
  'use strict';
  var cfg = window.SP_CONFIG || {};
  var doc = document.documentElement;
  doc.classList.remove('no-js');

  // Sticky header background transition
  var header = document.getElementById('site-header');
  function onScroll() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 24); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('mobile-nav');
  var closeBtn = panel ? panel.querySelector('.nav-close') : null;
  function openNav() {
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    if (closeBtn) closeBtn.focus();
  }
  function closeNav() {
    panel.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    setTimeout(function () { panel.hidden = true; }, 280);
    toggle.focus();
  }
  if (toggle && panel) {
    toggle.addEventListener('click', openNav);
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closeNav(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100 && !panel.hidden) closeNav(); });
  }

  // WhatsApp links with the pre-filled message
  var waUrl = 'https://wa.me/' + (cfg.whatsapp || '917892115167') + '?text=' + encodeURIComponent(cfg.whatsappMessage || '');
  document.querySelectorAll('[data-wa]').forEach(function (a) { a.href = waUrl; });

  // Reveal on scroll (subtle)
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('is-visible'); }); }

  // Footer year
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Small shared helpers
  window.SP = window.SP || {};
  window.SP.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  window.SP.formatDate = function (iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
  };
})();
