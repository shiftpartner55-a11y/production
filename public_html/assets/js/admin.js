(function () {
'use strict';
var cfg = window.SP_CONFIG || {};
var SPA = window.SPA = {};
var page = document.body.getAttribute('data-admin-page') || '';
var isLogin = page === 'login';
SPA.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
SPA.icon = function (n) { return '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#' + n + '"></use></svg>'; };
SPA.slugify = function (s) {
return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 120);
};
SPA.date = function (iso, withTime) {
if (!iso) return '—';
var o = { day: 'numeric', month: 'short', year: 'numeric' };
if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
return new Date(iso).toLocaleString('en-IN', o);
};
SPA.toast = function (msg, type) {
var box = document.getElementById('toasts'); if (!box) return alert(msg);
var t = document.createElement('div'); t.className = 'toast ' + (type || '');
t.innerHTML = SPA.icon(type === 'error' ? 'alert' : 'check-circle') + '<span>' + SPA.esc(msg) + '</span>';
box.appendChild(t); setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 3800);
};
SPA.confirm = function (title, text, okLabel) {
var m = document.getElementById('modal');
m.querySelector('#modal-title').textContent = title; m.querySelector('#modal-text').textContent = text || '';
var ok = m.querySelector('[data-modal-ok]'), cancel = m.querySelector('[data-modal-cancel]');
ok.textContent = okLabel || 'Delete';
m.hidden = false; cancel.focus();
return new Promise(function (resolve) {
function done(v) { m.hidden = true; ok.onclick = cancel.onclick = null; document.removeEventListener('keydown', esc); resolve(v); }
function esc(e) { if (e.key === 'Escape') done(false); }
ok.onclick = function () { done(true); }; cancel.onclick = function () { done(false); };
document.addEventListener('keydown', esc);
});
};
SPA.busy = function (btn, on) { if (!btn) return; btn.disabled = on; btn.classList.toggle('is-loading', on); };
SPA.badge = function (p) {
var st = SPA.effectiveStatus(p);
return '<span class="badge badge-' + st + '">' + st.charAt(0).toUpperCase() + st.slice(1) + '</span>';
};
SPA.effectiveStatus = function (p) {
if (p.status === 'draft') return 'draft';
if (p.published_at && new Date(p.published_at) > new Date()) return 'scheduled';
return 'published';
};
SPA.errMsg = function (err) {
if (!err) return 'Something went wrong.';
if (err.code === '23505') return 'That URL slug is already used by another post or item.';
if (err.code === '42501' || /row-level security/i.test(err.message || '')) return 'Permission denied — your account is not an authorised admin.';
return err.message || 'Something went wrong.';
};
if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
var boot = document.getElementById('admin-boot');
var msg = '<div class="notice warn" style="max-width:520px">' + SPA.icon('alert') + '<div><strong>Supabase is not configured.</strong><br>Add <code>supabaseUrl</code> and <code>supabaseAnonKey</code> in <code>/assets/js/config.js</code>, then reload. See README → Supabase setup.</div></div>';
if (boot) boot.innerHTML = msg;
var lf = document.getElementById('login-alert'); if (lf) { lf.className = 'auth-alert error'; lf.hidden = false; lf.innerHTML = 'Supabase is not configured yet. Add your project URL and anon key in <code>/assets/js/config.js</code>.'; }
SPA.ready = Promise.reject(new Error('not_configured')); SPA.ready.catch(function () {});
return;
}
var sb = SPA.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
SPA.checkAdmin = function () {
return sb.rpc('is_admin').then(function (r) { return !r.error && r.data === true; });
};
if (!isLogin) {
SPA.ready = sb.auth.getSession().then(function (r) {
var session = r.data && r.data.session;
if (!session) { location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search)); return new Promise(function () {}); /* redirecting to login */ }
return SPA.checkAdmin().then(function (ok) {
if (!ok) { return sb.auth.signOut().then(function () { location.replace('/admin/login?denied=1'); return new Promise(function () {}); }); }
SPA.user = session.user;
document.getElementById('admin-email').textContent = session.user.email;
document.getElementById('admin-avatar').textContent = (session.user.email || 'A').charAt(0).toUpperCase();
document.getElementById('admin-boot').hidden = true;
document.getElementById('admin-shell').hidden = false;
return session;
});
});
SPA.ready.catch(function () {});
sb.auth.onAuthStateChange(function (evt) { if (evt === 'SIGNED_OUT') location.replace('/admin/login'); });
document.addEventListener('click', function (e) {
if (e.target.closest('[data-logout]')) { sb.auth.signOut().then(function () { location.replace('/admin/login?out=1'); }); }
if (e.target.closest('[data-side-toggle]')) document.body.classList.toggle('side-open');
});
}
if (page === 'dashboard') SPA.ready.then(function () {
Promise.all([
sb.from('blog_posts').select('id,title,slug,status,published_at,updated_at,featured_image').order('updated_at', { ascending: false }),
sb.from('blog_categories').select('id', { count: 'exact', head: true }),
sb.from('blog_tags').select('id', { count: 'exact', head: true })
]).then(function (res) {
if (res[0].error) throw res[0].error;
var posts = res[0].data || [];
var c = { published: 0, draft: 0, scheduled: 0 };
posts.forEach(function (p) { c[SPA.effectiveStatus(p)]++; });
setText('stat-published', c.published); setText('stat-draft', c.draft); setText('stat-scheduled', c.scheduled);
setText('stat-categories', res[1].count || 0); setText('stat-tags', res[2].count || 0); setText('stat-total', posts.length);
var tb = document.getElementById('recent-posts');
tb.innerHTML = posts.length ? posts.slice(0, 8).map(function (p) {
return '<tr><td class="t-title"><strong>' + SPA.esc(p.title) + '</strong><small>/blog/' + SPA.esc(p.slug) + '</small></td><td>' + SPA.badge(p) +
'</td><td class="hide-sm">' + SPA.date(p.updated_at, true) + '</td><td><div class="t-actions"><a class="icon-btn" href="/admin/edit-blog?id=' + p.id + '" title="Edit" aria-label="Edit">' + SPA.icon('pencil') + '</a></div></td></tr>';
}).join('') : '<tr><td colspan="4"><div class="empty">No blog posts yet. <a href="/admin/add-blog" style="color:var(--orange);font-weight:700">Write your first article</a>.</div></td></tr>';
}).catch(function (err) { SPA.toast(SPA.errMsg(err), 'error'); });
});
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
if (page === 'blogs') SPA.ready.then(function () {
var all = [], state = { status: 'all', q: '', cat: '' };
var tbody = document.getElementById('posts-body');
var catSel = document.getElementById('filter-cat');
function load() {
return Promise.all([
sb.from('blog_posts').select('id,title,slug,status,published_at,updated_at,featured_image,author,category_id,category:blog_categories(name)').order('updated_at', { ascending: false }).limit(1000),
sb.from('blog_categories').select('id,name').order('name')
]).then(function (r) {
if (r[0].error) throw r[0].error;
all = r[0].data || [];
if (catSel.options.length <= 1) (r[1].data || []).forEach(function (c) { catSel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + SPA.esc(c.name) + '</option>'); });
render();
}).catch(function (err) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty">' + SPA.esc(SPA.errMsg(err)) + '</div></td></tr>'; });
}
function render() {
var counts = { all: all.length, published: 0, draft: 0, scheduled: 0 };
all.forEach(function (p) { counts[SPA.effectiveStatus(p)]++; });
document.querySelectorAll('[data-status]').forEach(function (b) {
b.querySelector('.count').textContent = counts[b.dataset.status];
b.setAttribute('aria-pressed', String(b.dataset.status === state.status));
});
var q = state.q.toLowerCase();
var rows = all.filter(function (p) {
return (state.status === 'all' || SPA.effectiveStatus(p) === state.status) &&
(!state.cat || p.category_id === state.cat) &&
(!q || p.title.toLowerCase().indexOf(q) > -1 || p.slug.indexOf(q) > -1);
});
if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty">No posts match your filters.</div></td></tr>'; return; }
tbody.innerHTML = rows.map(function (p) {
var st = SPA.effectiveStatus(p);
var live = st === 'published';
return '<tr data-id="' + p.id + '">' +
'<td class="hide-sm">' + (p.featured_image ? '<img class="t-thumb" src="' + SPA.esc(p.featured_image) + '" alt="" loading="lazy">' : '<div class="t-thumb"></div>') + '</td>' +
'<td class="t-title"><strong>' + SPA.esc(p.title) + '</strong><small>/blog/' + SPA.esc(p.slug) + (p.author ? ' · ' + SPA.esc(p.author) : '') + '</small></td>' +
'<td class="hide-sm">' + SPA.esc(p.category ? p.category.name : '—') + '</td>' +
'<td>' + SPA.badge(p) + '</td>' +
'<td class="hide-sm">' + (p.status === 'draft' ? '<small style="color:var(--muted)">Updated ' + SPA.date(p.updated_at) + '</small>' : SPA.date(p.published_at, st === 'scheduled')) + '</td>' +
'<td><div class="t-actions">' +
(live ? '<a class="icon-btn" href="/blog/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener" title="View live" aria-label="View live">' + SPA.icon('external') + '</a>' : '') +
'<button class="icon-btn" data-act="toggle" title="' + (p.status === 'draft' ? 'Publish now' : 'Move to draft') + '" aria-label="' + (p.status === 'draft' ? 'Publish now' : 'Move to draft') + '">' + SPA.icon(p.status === 'draft' ? 'upload' : 'file') + '</button>' +
'<a class="icon-btn" href="/admin/edit-blog?id=' + p.id + '" title="Edit" aria-label="Edit">' + SPA.icon('pencil') + '</a>' +
'<button class="icon-btn" data-act="delete" title="Delete" aria-label="Delete">' + SPA.icon('trash') + '</button>' +
'</div></td></tr>';
}).join('');
}
document.querySelectorAll('[data-status]').forEach(function (b) { b.addEventListener('click', function () { state.status = b.dataset.status; render(); }); });
document.getElementById('filter-q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
catSel.addEventListener('change', function () { state.cat = catSel.value; render(); });
tbody.addEventListener('click', function (e) {
var b = e.target.closest('[data-act]'); if (!b) return;
var id = b.closest('tr').dataset.id;
var p = all.find(function (x) { return x.id === id; });
if (b.dataset.act === 'delete') {
SPA.confirm('Delete this post?', '"' + p.title + '" will be permanently deleted. This cannot be undone.').then(function (ok) {
if (!ok) return;
sb.from('blog_posts').delete().eq('id', id).then(function (r) {
if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
all = all.filter(function (x) { return x.id !== id; }); render(); SPA.toast('Post deleted', 'success');
});
});
}
if (b.dataset.act === 'toggle') {
var upd = p.status === 'draft' ? { status: 'published', published_at: p.published_at && new Date(p.published_at) <= new Date() ? p.published_at : new Date().toISOString() } : { status: 'draft' };
SPA.busy(b, true);
sb.from('blog_posts').update(upd).eq('id', id).select('id,status,published_at,updated_at').single().then(function (r) {
SPA.busy(b, false);
if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
Object.assign(p, r.data); render(); SPA.toast(r.data.status === 'draft' ? 'Moved to drafts' : 'Published', 'success');
});
}
});
load();
});
if (page === 'categories') SPA.ready.then(function () {
var catList = document.getElementById('cat-list'), tagList = document.getElementById('tag-list');
var form = document.getElementById('cat-form'), editingId = null;
function loadCats() {
return Promise.all([
sb.from('blog_categories').select('id,name,slug,description').order('name'),
sb.from('blog_posts').select('category_id')
]).then(function (r) {
if (r[0].error) throw r[0].error;
var counts = {}; (r[1].data || []).forEach(function (p) { if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
var cats = r[0].data || [];
catList.innerHTML = cats.length ? cats.map(function (c) {
return '<div class="list-row" data-id="' + c.id + '"><div><strong>' + SPA.esc(c.name) + '</strong><small>/' + SPA.esc(c.slug) + (c.description ? ' · ' + SPA.esc(c.description) : '') + '</small></div>' +
'<span class="pill-count">' + (counts[c.id] || 0) + ' posts</span>' +
'<button class="icon-btn" data-edit=\'' + SPA.esc(JSON.stringify(c)) + '\' aria-label="Edit category">' + SPA.icon('pencil') + '</button>' +
'<button class="icon-btn" data-del-cat="' + c.id + '" data-name="' + SPA.esc(c.name) + '" aria-label="Delete category">' + SPA.icon('trash') + '</button></div>';
}).join('') : '<div class="empty">No categories yet.</div>';
}).catch(function (err) { SPA.toast(SPA.errMsg(err), 'error'); });
}
function loadTags() {
return sb.from('blog_tags').select('id,name,slug,blog_post_tags(count)').order('name').then(function (r) {
if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
tagList.innerHTML = (r.data || []).length ? r.data.map(function (t) {
var n = t.blog_post_tags && t.blog_post_tags[0] ? t.blog_post_tags[0].count : 0;
return '<div class="list-row"><div><strong>#' + SPA.esc(t.name) + '</strong><small>' + n + ' posts</small></div><button class="icon-btn" data-del-tag="' + t.id + '" data-name="' + SPA.esc(t.name) + '" aria-label="Delete tag">' + SPA.icon('trash') + '</button></div>';
}).join('') : '<div class="empty">Tags are created from the blog editor.</div>';
});
}
var nameIn = form.elements.name, slugIn = form.elements.slug, slugTouched = false;
nameIn.addEventListener('input', function () { if (!slugTouched) slugIn.value = SPA.slugify(nameIn.value); });
slugIn.addEventListener('input', function () { slugTouched = true; });
function resetForm() { form.reset(); editingId = null; slugTouched = false; document.getElementById('cat-form-title').textContent = 'Add category'; form.querySelector('[type=submit]').textContent = 'Add Category'; document.getElementById('cat-cancel').hidden = true; }
document.getElementById('cat-cancel').addEventListener('click', resetForm);
form.addEventListener('submit', function (e) {
e.preventDefault();
var row = { name: nameIn.value.trim(), slug: SPA.slugify(slugIn.value || nameIn.value), description: form.elements.description.value.trim() || null };
if (row.name.length < 2) return SPA.toast('Category name is too short', 'error');
var btn = form.querySelector('[type=submit]'); SPA.busy(btn, true);
var q = editingId ? sb.from('blog_categories').update(row).eq('id', editingId) : sb.from('blog_categories').insert(row);
q.then(function (r) {
SPA.busy(btn, false);
if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
SPA.toast(editingId ? 'Category updated' : 'Category added', 'success'); resetForm(); loadCats();
});
});
document.addEventListener('click', function (e) {
var ed = e.target.closest('[data-edit]');
if (ed) {
var c = JSON.parse(ed.getAttribute('data-edit')); editingId = c.id; slugTouched = true;
nameIn.value = c.name; slugIn.value = c.slug; form.elements.description.value = c.description || '';
document.getElementById('cat-form-title').textContent = 'Edit category'; form.querySelector('[type=submit]').textContent = 'Save Changes';
document.getElementById('cat-cancel').hidden = false; nameIn.focus();
}
var dc = e.target.closest('[data-del-cat]');
if (dc) SPA.confirm('Delete category "' + dc.dataset.name + '"?', 'Posts in this category will become uncategorised. Posts are not deleted.').then(function (ok) {
if (ok) sb.from('blog_categories').delete().eq('id', dc.dataset.delCat).then(function (r) { if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error'); SPA.toast('Category deleted', 'success'); loadCats(); });
});
var dt = e.target.closest('[data-del-tag]');
if (dt) SPA.confirm('Delete tag "#' + dt.dataset.name + '"?', 'The tag will be removed from all posts.').then(function (ok) {
if (ok) sb.from('blog_tags').delete().eq('id', dt.dataset.delTag).then(function (r) { if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error'); SPA.toast('Tag deleted', 'success'); loadTags(); });
});
});
loadCats(); loadTags();
});
if (isLogin) {
var alertEl = document.getElementById('login-alert');
var views = { login: document.getElementById('view-login'), forgot: document.getElementById('view-forgot'), reset: document.getElementById('view-reset') };
function show(v) { Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; }); hideAlert(); }
function showAlert(msg, type) { alertEl.className = 'auth-alert ' + (type || 'error'); alertEl.textContent = msg; alertEl.hidden = false; }
function hideAlert() { alertEl.hidden = true; }
var qs = new URLSearchParams(location.search);
if (qs.get('denied')) showAlert('This account does not have admin access.');
if (qs.get('out')) showAlert('You have been logged out.', 'success');
var recovering = /type=recovery/.test(location.hash) || qs.get('mode') === 'reset';
sb.auth.onAuthStateChange(function (evt) { if (evt === 'PASSWORD_RECOVERY') { recovering = true; show('reset'); } });
if (recovering) show('reset');
else sb.auth.getSession().then(function (r) {
if (r.data.session) SPA.checkAdmin().then(function (ok) { if (ok) location.replace(safeNext()); });
});
function safeNext() { var n = qs.get('next') || ''; return /^\/admin\/[a-z\-]+(\?[\w=&%-]*)?$/.test(n) ? n : '/admin/dashboard'; }
document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.view); }); });
document.querySelectorAll('[data-pw-toggle]').forEach(function (b) {
b.addEventListener('click', function () { var i = b.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; });
});
var fails = 0;
document.getElementById('login-form').addEventListener('submit', function (e) {
e.preventDefault();
var f = e.target, btn = f.querySelector('[type=submit]');
if (fails >= 5) return showAlert('Too many attempts. Please wait a minute and try again.');
SPA.busy(btn, true); hideAlert();
sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
if (r.error) { fails++; if (fails >= 5) setTimeout(function () { fails = 0; }, 60000); throw r.error; }
return SPA.checkAdmin().then(function (ok) {
if (!ok) return sb.auth.signOut().then(function () { throw new Error('This account does not have admin access.'); });
location.replace(safeNext());
});
}).catch(function (err) {
SPA.busy(btn, false);
showAlert(/invalid login/i.test(err.message) ? 'Incorrect email or password.' : err.message);
});
});
document.getElementById('forgot-form').addEventListener('submit', function (e) {
e.preventDefault();
var btn = e.target.querySelector('[type=submit]'); SPA.busy(btn, true);
sb.auth.resetPasswordForEmail(e.target.email.value.trim(), { redirectTo: location.origin + '/admin/login?mode=reset' }).then(function (r) {
SPA.busy(btn, false);
if (r.error && /rate/i.test(r.error.message)) return showAlert('Please wait a little before requesting another email.');
showAlert('If that email belongs to an admin account, a password reset link has been sent.', 'success');
});
});
document.getElementById('reset-form').addEventListener('submit', function (e) {
e.preventDefault();
var p1 = e.target.password.value, p2 = e.target.password2.value, btn = e.target.querySelector('[type=submit]');
if (p1.length < 10) return showAlert('Use at least 10 characters for your new password.');
if (p1 !== p2) return showAlert('Passwords do not match.');
SPA.busy(btn, true);
sb.auth.updateUser({ password: p1 }).then(function (r) {
SPA.busy(btn, false);
if (r.error) return showAlert(r.error.message);
history.replaceState(null, '', '/admin/login');
showAlert('Password updated. Redirecting…', 'success');
setTimeout(function () { location.replace('/admin/dashboard'); }, 1200);
});
});
}
})();