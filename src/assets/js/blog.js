// Shiftingpartner — Blog listing (dynamic from Supabase): search, category filters, featured post, pagination
(function () {
  'use strict';
  var SP = window.SP, cfg = window.SP_CONFIG || {}, e = SP.escape;
  var grid = document.getElementById('posts-grid');
  if (!grid) return;
  var featuredBox = document.getElementById('post-featured');
  var chipsBox = document.getElementById('category-chips');
  var pager = document.getElementById('pagination');
  var countEl = document.getElementById('results-count');
  var searchInputs = document.querySelectorAll('[data-blog-search]');
  var PAGE = cfg.blogPageSize || 9;
  var qs = new URLSearchParams(location.search);
  var state = { q: qs.get('q') || '', cat: qs.get('category') || '', page: Math.max(1, parseInt(qs.get('page') || '1', 10)) };
  searchInputs.forEach(function (i) { i.value = state.q; });

  var FIELDS = 'id,title,slug,excerpt,featured_image,image_alt,author,published_at,updated_at,reading_time,category:blog_categories(name,slug)';

  function card(p) {
    var cat = p.category ? '<span class="post-cat">' + e(p.category.name) + '</span>' : '';
    var img = p.featured_image ? '<img src="' + e(SP.imgSrc(p.featured_image, 800)) + '" alt="' + e(p.image_alt || p.title) + '" loading="lazy" decoding="async" width="800" height="500">' : '';
    return '<article class="post-card reveal is-visible">' +
      '<a class="post-thumb" href="' + SP.postUrl(p.slug) + '" tabindex="-1" aria-hidden="true">' + img + cat + '</a>' +
      '<div class="post-body"><h3><a href="' + SP.postUrl(p.slug) + '">' + e(p.title) + '</a></h3>' +
      (p.excerpt ? '<p>' + e(p.excerpt) + '</p>' : '') + meta(p) + '</div></article>';
  }
  function meta(p) {
    return '<div class="post-meta"><span>' + icon('calendar') + '<time datetime="' + e(p.published_at) + '">' + SP.formatDate(p.published_at) + '</time></span>' +
      '<span>' + icon('clock') + (p.reading_time || 3) + ' min read</span>' +
      (p.author ? '<span>' + icon('user') + e(p.author) + '</span>' : '') + '</div>';
  }
  function icon(n) { return '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#' + n + '"></use></svg>'; }
  function featured(p) {
    var img = p.featured_image ? '<img src="' + e(SP.imgSrc(p.featured_image, 1200)) + '" alt="' + e(p.image_alt || p.title) + '" decoding="async" width="1200" height="750">' : '';
    return '<a class="post-thumb" href="' + SP.postUrl(p.slug) + '" tabindex="-1" aria-hidden="true">' + img + '<span class="post-cat">Featured</span></a>' +
      '<div class="post-body"><p class="eyebrow">' + e(p.category ? p.category.name : 'Latest article') + '</p>' +
      '<h2><a href="' + SP.postUrl(p.slug) + '">' + e(p.title) + '</a></h2>' + (p.excerpt ? '<p>' + e(p.excerpt) + '</p>' : '') +
      meta(p) + '<p style="margin:22px 0 0"><a class="link-arrow" href="' + SP.postUrl(p.slug) + '">Read article ' + icon('arrow') + '</a></p></div>';
  }
  function stateBox(title, text) {
    return '<div class="state-box" style="grid-column:1/-1"><span class="icon-badge">' + icon('news') + '</span><h3>' + title + '</h3><p>' + text + '</p></div>';
  }
  function skeleton() { var s = ''; for (var i = 0; i < 3; i++) s += '<div class="skeleton sk-card"></div>'; grid.innerHTML = s; }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q); if (state.cat) p.set('category', state.cat); if (state.page > 1) p.set('page', state.page);
    var s = p.toString(); history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  function loadCategories() {
    return SP.db.get('blog_categories?select=name,slug&order=name.asc').then(function (r) {
      var html = '<button type="button" class="chip" data-cat="" aria-pressed="' + (!state.cat) + '">All Articles</button>';
      r.rows.forEach(function (c) { html += '<button type="button" class="chip" data-cat="' + e(c.slug) + '" aria-pressed="' + (state.cat === c.slug) + '">' + e(c.name) + '</button>'; });
      chipsBox.innerHTML = html;
    });
  }

  function load() {
    skeleton(); syncUrl();
    var filters = SP.db.publishedFilter();
    var sel = FIELDS;
    if (state.cat) { sel = sel.replace('category:blog_categories(', 'category:blog_categories!inner('); filters += '&category.slug=eq.' + encodeURIComponent(state.cat); }
    if (state.q) {
      var term = state.q.replace(/[(),.*%]/g, ' ').trim();
      if (term) filters += '&or=(title.ilike.*' + encodeURIComponent(term) + '*,excerpt.ilike.*' + encodeURIComponent(term) + '*)';
    }
    var showFeatured = state.page === 1 && !state.q && !state.cat;
    // Unfiltered list: newest post is featured on page 1, grid pages continue from item #2.
    var filtered = !!(state.q || state.cat);
    var offset = filtered ? (state.page - 1) * PAGE : (showFeatured ? 0 : 1 + (state.page - 1) * PAGE);
    var limit = showFeatured ? PAGE + 1 : PAGE;
    var path = 'blog_posts?select=' + sel + '&' + filters + '&order=published_at.desc&limit=' + limit + '&offset=' + offset;
    return SP.db.get(path, { count: true }).then(function (r) {
      var rows = r.rows, total = r.total || rows.length;
      if (showFeatured && rows.length) { featuredBox.innerHTML = featured(rows[0]); featuredBox.hidden = false; rows = rows.slice(1); }
      else featuredBox.hidden = true;
      var listTotal = (!state.q && !state.cat) ? Math.max(0, total - 1) : total;
      if (countEl) countEl.textContent = (state.q || state.cat) ? total + ' article' + (total === 1 ? '' : 's') + ' found' : '';
      if (!rows.length && !(showFeatured && r.rows.length)) {
        grid.innerHTML = stateBox(state.q || state.cat ? 'No matching articles' : 'Articles are on their way', state.q || state.cat ? 'Try a different search term or category.' : 'Our relocation guides will appear here soon.');
      } else grid.innerHTML = rows.map(card).join('');
      renderPager(Math.max(1, Math.ceil(listTotal / PAGE)));
    });
  }

  function renderPager(pages) {
    if (pages <= 1) { pager.innerHTML = ''; return; }
    var h = '<button type="button" data-page="' + (state.page - 1) + '" ' + (state.page === 1 ? 'disabled' : '') + ' aria-label="Previous page">' + icon('chevron-left') + '</button>';
    for (var i = 1; i <= pages; i++) h += '<button type="button" data-page="' + i + '"' + (i === state.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
    h += '<button type="button" data-page="' + (state.page + 1) + '" ' + (state.page === pages ? 'disabled' : '') + ' aria-label="Next page">' + icon('chevron-right') + '</button>';
    pager.innerHTML = h;
  }

  function fail(err) {
    featuredBox.hidden = true; pager.innerHTML = '';
    if (err && err.code === 'not_configured') {
      console.info('[Shiftingpartner] Blog: add supabaseUrl and supabaseAnonKey in /assets/js/config.js to load articles.');
      grid.innerHTML = stateBox('Articles are on their way', 'Our moving guides and relocation tips will be published here soon.');
    } else grid.innerHTML = stateBox('Could not load articles', 'Please check your connection and refresh the page.');
  }

  chipsBox.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cat]'); if (!b) return;
    state.cat = b.dataset.cat; state.page = 1;
    chipsBox.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    load().catch(fail);
  });
  pager.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-page]'); if (!b || b.disabled) return;
    state.page = +b.dataset.page; load().then(function () { document.getElementById('articles').scrollIntoView({ behavior: 'smooth' }); }).catch(fail);
  });
  var t;
  searchInputs.forEach(function (inp) {
    inp.addEventListener('input', function () {
      clearTimeout(t); var v = inp.value;
      searchInputs.forEach(function (o) { if (o !== inp) o.value = v; });
      t = setTimeout(function () { state.q = v.trim().slice(0, 80); state.page = 1; load().catch(fail); }, 350);
    });
  });
  var heroForm = document.getElementById('hero-search');
  if (heroForm) heroForm.addEventListener('submit', function (ev) {
    ev.preventDefault(); state.q = heroForm.querySelector('input').value.trim().slice(0, 80); state.page = 1;
    load().catch(fail); document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
  });

  if (!SP.db.configured()) { fail({ code: 'not_configured' }); chipsBox.innerHTML = ''; return; }
  loadCategories().catch(function () { chipsBox.innerHTML = ''; });
  load().catch(fail);
})();
