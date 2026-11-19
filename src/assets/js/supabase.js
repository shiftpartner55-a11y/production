// Shiftingpartner — lightweight read-only Supabase REST client for the public site.
// Uses the public anon key; Row Level Security only exposes published posts.
(function () {
  'use strict';
  var cfg = window.SP_CONFIG || {};
  var SP = window.SP = window.SP || {};
  SP.db = {
    configured: function () { return !!(cfg.supabaseUrl && cfg.supabaseAnonKey); },
    // path e.g. 'blog_posts?select=*&slug=eq.x'
    get: function (path, opts) {
      opts = opts || {};
      if (!SP.db.configured()) return Promise.reject({ code: 'not_configured' });
      var headers = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, Accept: 'application/json' };
      if (opts.count) headers.Prefer = 'count=exact';
      return fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, { headers: headers }).then(function (res) {
        if (!res.ok) throw { code: 'http_' + res.status };
        var total = null, cr = res.headers.get('content-range');
        if (cr && cr.indexOf('/') > -1) total = parseInt(cr.split('/')[1], 10);
        return res.json().then(function (rows) { return { rows: rows, total: total }; });
      });
    },
    nowIso: function () { return new Date().toISOString(); },
    // public visibility filter (mirrors the RLS policy)
    publishedFilter: function () { return 'status=in.(published,scheduled)&published_at=lte.' + encodeURIComponent(new Date().toISOString()); }
  };
  SP.postUrl = function (slug) { return '/blog/' + encodeURIComponent(slug); };
  SP.imgSrc = function (url, w) {
    if (!url) return '';
    if (/images\.unsplash\.com/.test(url)) return url.split('?')[0] + '?auto=format&fit=crop&q=72&w=' + (w || 900);
    if (/\/storage\/v1\/object\/public\//.test(url) && w) {
      // Supabase image transformations (Pro plan). Falls back gracefully if not enabled: we keep the original URL.
      return url;
    }
    return url;
  };
})();
