(function () {
'use strict';
var SP = window.SP, cfg = window.SP_CONFIG || {}, e = SP.escape;
var root = document.getElementById('post-root');
if (!root) return;
var site = (cfg.siteUrl || location.origin).replace(/\/$/, '');
function icon(n) { return '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#' + n + '"></use></svg>'; }
function clean(html) {
if (window.DOMPurify) return window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input'] });
var d = document.createElement('div'); d.textContent = html; return d.innerHTML;
}
function render(p, tags) {
var cat = p.category;
var url = site + SP.postUrl(p.slug);
var updated = p.updated_at && p.published_at && (new Date(p.updated_at) - new Date(p.published_at) > 864e5);
var crumbs = '<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li>' +
(cat ? '<li><a href="/blog?category=' + e(cat.slug) + '">' + e(cat.name) + '</a></li>' : '') + '<li aria-current="page">' + e(p.title) + '</li></ol></nav>';
var html = '<section class="article-head"><div class="container">' + crumbs +
(cat ? '<p class="eyebrow">' + e(cat.name) + '</p>' : '') +
'<h1>' + e(p.title) + '</h1>' + (p.excerpt ? '<p class="excerpt">' + e(p.excerpt) + '</p>' : '') +
'<div class="post-meta"><span>' + icon('calendar') + 'Published <time datetime="' + e(p.published_at) + '">' + SP.formatDate(p.published_at) + '</time></span>' +
(updated ? '<span>' + icon('refresh') + 'Updated <time datetime="' + e(p.updated_at) + '">' + SP.formatDate(p.updated_at) + '</time></span>' : '') +
'<span>' + icon('clock') + (p.reading_time || 3) + ' min read</span>' + (p.author ? '<span>' + icon('user') + e(p.author) + '</span>' : '') + '</div>' +
(p.featured_image ? '<figure class="article-cover"><img src="' + e(SP.imgSrc(p.featured_image, 1600)) + '" alt="' + e(p.image_alt || p.title) + '" width="1600" height="800" fetchpriority="high"></figure>' : '<div style="height:56px"></div>') +
'</div></section>' +
'<section class="section-sm"><div class="container article-wrap"><article>' +
'<div class="prose">' + clean(p.content || '') + '</div>' +
(tags && tags.length ? '<div class="article-tags">' + tags.map(function (t) { return '<span>#' + e(t.name) + '</span>'; }).join('') + '</div>' : '') +
'<div class="author-box"><span class="avatar">' + e((p.author || 'S').charAt(0).toUpperCase()) + '</span><div><strong>' + e(p.author || 'Shiftingpartner Team') + '</strong><span>Household relocation insights from the Shiftingpartner team.</span></div></div>' +
shareBar(url, p.title) + '</article>' + aside() + '</div></section>';
root.innerHTML = html;
root.dataset.slug = p.slug;
}
function shareBar(url, title) {
var u = encodeURIComponent(url), t = encodeURIComponent(title);
return '<div class="share"><strong>Share this article</strong>' +
'<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener" aria-label="Share on WhatsApp">' + icon('whatsapp') + '</a>' +
'<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener" aria-label="Share on Facebook">' + icon('facebook') + '</a>' +
'<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + u + '" target="_blank" rel="noopener" aria-label="Share on LinkedIn">' + icon('linkedin') + '</a>' +
'<a href="mailto:?subject=' + t + '&amp;body=' + u + '" aria-label="Share by email">' + icon('mail') + '</a>' +
'<button type="button" data-copy="' + e(url) + '" aria-label="Copy link">' + icon('link') + '</button></div>';
}
function aside() {
return '<aside class="article-aside"><div class="side-card dark"><p class="eyebrow eyebrow-light">Free consultation</p><h3>Planning a household move?</h3>' +
'<p>Share your pickup and drop locations and our team will help you plan your relocation.</p>' +
'<a class="btn btn-primary btn-block" href="/consultation">Get Free Consultation ' + icon('arrow') + '</a></div>' +
'<div class="side-card"><h3>Talk to our team</h3><p style="color:var(--muted);font-size:15px">Questions about packing, timelines or routes?</p>' +
'<a class="link-arrow" href="tel:' + e(cfg.phone || '') + '">' + icon('phone') + ' ' + e(cfg.phoneDisplay || '') + '</a></div></aside>';
}
function setSeo(p) {
var title = (p.seo_title || p.title) + ' | Shiftingpartner';
var desc = p.meta_description || p.excerpt || '';
var url = p.canonical_url || (site + SP.postUrl(p.slug));
document.title = title;
function meta(sel, attr, val) { var m = document.head.querySelector(sel); if (m) m.setAttribute(attr, val); }
meta('meta[name="description"]', 'content', desc);
meta('link[rel="canonical"]', 'href', url);
meta('meta[property="og:title"]', 'content', title); meta('meta[name="twitter:title"]', 'content', title);
meta('meta[property="og:description"]', 'content', desc); meta('meta[name="twitter:description"]', 'content', desc);
meta('meta[property="og:url"]', 'content', url); meta('meta[property="og:type"]', 'content', 'article');
var img = p.og_image || p.featured_image;
if (img) { meta('meta[property="og:image"]', 'content', img); meta('meta[name="twitter:image"]', 'content', img); }
var ld = document.createElement('script'); ld.type = 'application/ld+json';
ld.textContent = JSON.stringify({
'@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: desc,
image: img ? [img] : undefined, datePublished: p.published_at, dateModified: p.updated_at || p.published_at,
author: { '@type': p.author ? 'Person' : 'Organization', name: p.author || 'Shiftingpartner' },
publisher: { '@type': 'Organization', name: 'Shiftingpartner', logo: { '@type': 'ImageObject', url: site + '/assets/logo/logo.png' } },
mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: p.category ? p.category.name : undefined, keywords: p.focus_keyword || undefined
});
document.head.appendChild(ld);
}
function related(p) {
var box = document.getElementById('related-posts'); if (!box || !SP.db.configured()) return;
var base = 'blog_posts?select=title,slug,excerpt,featured_image,image_alt,published_at,reading_time,author,category:blog_categories(name,slug)&' + SP.db.publishedFilter() + '&slug=neq.' + encodeURIComponent(p.slug) + '&order=published_at.desc&limit=3';
var q = p.category_id ? SP.db.get(base + '&category_id=eq.' + p.category_id) : Promise.resolve({ rows: [] });
q.then(function (r) {
if (r.rows.length >= 2) return r;
return SP.db.get(base);
}).then(function (r) {
if (!r.rows.length) return;
box.querySelector('.posts-grid').innerHTML = r.rows.map(function (x) {
return '<article class="post-card"><a class="post-thumb" href="' + SP.postUrl(x.slug) + '" tabindex="-1" aria-hidden="true">' +
(x.featured_image ? '<img src="' + e(SP.imgSrc(x.featured_image, 800)) + '" alt="' + e(x.image_alt || x.title) + '" loading="lazy" width="800" height="500">' : '') +
(x.category ? '<span class="post-cat">' + e(x.category.name) + '</span>' : '') + '</a><div class="post-body"><h3><a href="' + SP.postUrl(x.slug) + '">' + e(x.title) + '</a></h3>' +
'<div class="post-meta"><span>' + icon('calendar') + SP.formatDate(x.published_at) + '</span><span>' + icon('clock') + (x.reading_time || 3) + ' min read</span></div></div></article>';
}).join('');
box.hidden = false;
}).catch(function () {});
}
function wire() {
root.addEventListener('click', function (ev) {
var b = ev.target.closest('[data-copy]'); if (!b) return;
var url = b.getAttribute('data-copy');
if (navigator.share && /Mobi/i.test(navigator.userAgent)) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
(navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
b.innerHTML = icon('check'); setTimeout(function () { b.innerHTML = icon('link'); }, 1800);
}).catch(function () { window.prompt('Copy this link:', url); });
});
}
function notFound(msg) {
root.innerHTML = '<section class="article-head"><div class="container" style="padding-bottom:80px"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li></ol></nav>' +
'<h1>' + e(msg || 'Article not found') + '</h1><p class="excerpt">The article you are looking for may have moved or is not published yet.</p><a class="btn btn-primary" href="/blog">Browse all articles ' + icon('arrow') + '</a></div></section>';
var m = document.querySelector('meta[name="robots"]'); if (m) m.setAttribute('content', 'noindex, follow');
}
wire();
if (root.dataset.ssr === '1') {
try { related(JSON.parse(document.getElementById('post-data').textContent)); } catch (err) {}
return;
}
var qs = new URLSearchParams(location.search);
if (qs.get('preview')) {
try {
var d = JSON.parse(localStorage.getItem('sp_preview') || 'null');
if (!d) throw 0;
var banner = document.createElement('div'); banner.className = 'preview-banner'; banner.textContent = 'Preview — not visible to the public until published';
document.body.appendChild(banner);
document.querySelector('meta[name="robots"]').setAttribute('content', 'noindex, nofollow');
d.published_at = d.published_at || new Date().toISOString();
render(d, (d.tags || []).map(function (n) { return { name: n }; }));
document.title = 'Preview: ' + d.title;
} catch (err) { notFound('Nothing to preview'); }
return;
}
var m = location.pathname.match(/^\/blog\/([a-z0-9-]+?)(?:\.html)?\/?$/);
var slug = (m && m[1]) || qs.get('slug');
if (!slug) { location.replace('/blog'); return; }
if (!SP.db.configured()) { console.info('[Shiftingpartner] Configure Supabase in /assets/js/config.js to load articles.'); notFound('Article unavailable'); return; }
SP.db.get('blog_posts?select=*,category:blog_categories(name,slug),tags:blog_post_tags(tag:blog_tags(name,slug))&slug=eq.' + encodeURIComponent(slug) + '&' + SP.db.publishedFilter() + '&limit=1')
.then(function (r) {
var p = r.rows[0]; if (!p) { notFound(); return; }
render(p, (p.tags || []).map(function (t) { return t.tag; }).filter(Boolean));
setSeo(p); related(p);
}).catch(function () { notFound('Could not load this article'); });
})();