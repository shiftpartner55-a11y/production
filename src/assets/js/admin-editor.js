// Shiftingpartner Admin — Blog editor (create / edit / publish / schedule / preview)
// Rich text: TinyMCE 7 (GPL, self-hosted via jsDelivr). Images: Supabase Storage bucket "blog-images".
(function () {
  'use strict';
  var SPA = window.SPA;
  if (!SPA || !SPA.sb) return;
  var sb = SPA.sb, esc = SPA.esc;
  var form = document.getElementById('post-form');
  var postId = new URLSearchParams(location.search).get('id');
  var isEdit = !!postId;
  var original = null, dirty = false, slugTouched = isEdit, tags = [], allTags = [], editor = null;
  var f = form.elements;
  var BUCKET = 'blog-images';

  // ---------- image upload (auto-resize to max 1920px & convert to WebP when supported)
  function optimise(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return resolve(file);
      createImageBitmap(file).then(function (bmp) {
        var scale = Math.min(1, 1920 / bmp.width);
        var c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' }));
        }, 'image/webp', 0.82);
      }).catch(function () { resolve(file); });
    });
  }
  function upload(file, folder) {
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) return Promise.reject(new Error('Please upload a JPG, PNG, WebP, AVIF or GIF image.'));
    return optimise(file).then(function (img) {
      if (img.size > 5 * 1024 * 1024) throw new Error('Image is larger than 5 MB. Please use a smaller image.');
      var d = new Date();
      var name = SPA.slugify(img.name.replace(/\.\w+$/, '')).slice(0, 50) || 'image';
      var ext = (img.name.match(/\.(\w+)$/) || [, 'jpg'])[1].toLowerCase();
      var path = (folder || 'posts') + '/' + d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + Date.now().toString(36) + '-' + name + '.' + ext;
      return sb.storage.from(BUCKET).upload(path, img, { cacheControl: '31536000', upsert: false, contentType: img.type }).then(function (r) {
        if (r.error) throw r.error;
        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      });
    });
  }

  // ---------- TinyMCE
  function initEditor(content) {
    return new Promise(function (resolve) {
      if (!window.tinymce) {
        document.getElementById('editor-loading').textContent = 'Editor failed to load. Check your connection and reload.';
        return resolve(null);
      }
      tinymce.init({
        selector: '#content',
        license_key: 'gpl',
        height: 640,
        menubar: 'edit insert format table',
        plugins: 'lists advlist link image table code autolink wordcount fullscreen searchreplace autoresize quickbars',
        toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link image table blockquote | alignleft aligncenter | hr removeformat | code fullscreen',
        block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4',
        quickbars_insert_toolbar: false,
        quickbars_selection_toolbar: 'bold italic | h2 h3 | blockquote quicklink',
        autoresize_bottom_margin: 40, min_height: 520, max_height: 1400,
        branding: false, promotion: false, convert_urls: false, relative_urls: false,
        link_default_target: '_self', link_assume_external_targets: 'https', link_context_toolbar: true,
        image_caption: false, image_advtab: false, image_dimensions: false, automatic_uploads: true, paste_data_images: true,
        images_file_types: 'jpeg,jpg,png,webp,gif,avif',
        images_upload_handler: function (blobInfo) {
          var file = new File([blobInfo.blob()], blobInfo.filename() || 'image.png', { type: blobInfo.blob().type });
          return upload(file, 'content').catch(function (e) { throw { message: e.message || 'Upload failed', remove: true }; });
        },
        table_default_attributes: {}, table_default_styles: {}, table_class_list: [{ title: 'Default', value: '' }],
        valid_elements: 'p,br,h2,h3,h4,strong/b,em/i,u,s,a[href|title|target|rel],ul,ol,li,blockquote,hr,img[src|alt|width|height|loading],table,thead,tbody,tfoot,tr,th[colspan|rowspan|scope],td[colspan|rowspan],figure,figcaption,span,code,pre,sub,sup',
        content_style: 'body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:16px;line-height:1.75;color:#2B3440;max-width:760px;margin:24px auto;padding:0 16px}h2,h3,h4{color:#101B2D;line-height:1.2}a{color:#F36B21}blockquote{border-left:4px solid #F36B21;margin:1.4em 0;padding:12px 20px;background:#F8F6F2;font-weight:600}table{border-collapse:collapse;width:100%}td,th{border:1px solid #E6E1D8;padding:8px 12px}th{background:#101B2D;color:#fff}img{max-width:100%;height:auto;border-radius:12px}',
        setup: function (ed) {
          ed.on('init', function () {
            ed.setContent(content || '');
            document.getElementById('editor-loading').hidden = true;
            editor = ed; resolve(ed); updateSeo();
          });
          ed.on('input change undo redo', function () { markDirty(); updateSeoDebounced(); });
        }
      });
    });
  }
  function getContent() { return editor ? editor.getContent() : document.getElementById('content').value; }

  // ---------- form helpers
  function markDirty() { dirty = true; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  form.addEventListener('input', function (e) { if (e.target.id !== 'tag-entry') markDirty(); updateSeoDebounced(); });

  f.title.addEventListener('input', function () { if (!slugTouched) f.slug.value = SPA.slugify(f.title.value); });
  f.slug.addEventListener('input', function () { slugTouched = true; });
  f.slug.addEventListener('blur', function () { f.slug.value = SPA.slugify(f.slug.value); updateSeo(); });

  function counter(input, max, warnAt) {
    var el = document.querySelector('[data-count="' + input.name + '"]');
    function u() { var n = input.value.length; el.textContent = n + ' / ' + max; el.className = 'counter' + (n > max ? ' bad' : n > warnAt ? ' warn' : ''); }
    input.addEventListener('input', u); u(); return u;
  }
  var counters = [counter(f.seo_title, 60, 55), counter(f.meta_description, 160, 150), counter(f.excerpt, 300, 260)];

  // date helpers (datetime-local <-> ISO)
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }
  function updatePublishLabel() {
    var v = f.published_at.value, future = v && new Date(v) > new Date();
    document.getElementById('btn-publish').querySelector('span').textContent = future ? 'Schedule' : (original && original.status !== 'draft' ? 'Update' : 'Publish');
  }
  f.published_at.addEventListener('change', updatePublishLabel);

  // ---------- SEO preview & checks
  var seoTimer;
  function updateSeoDebounced() { clearTimeout(seoTimer); seoTimer = setTimeout(updateSeo, 300); }
  function updateSeo() {
    var title = f.seo_title.value || f.title.value || 'Post title';
    var desc = f.meta_description.value || f.excerpt.value || 'Meta description preview…';
    var slug = f.slug.value || 'post-url';
    document.getElementById('serp-t').textContent = (title + ' | Shiftingpartner').slice(0, 70);
    document.getElementById('serp-d').textContent = desc.slice(0, 165);
    document.getElementById('serp-u').textContent = (window.SP_CONFIG.siteUrl || location.origin).replace(/^https?:\/\//, '') + ' › blog › ' + slug;
    var kw = f.focus_keyword.value.trim().toLowerCase();
    var text = getContent().replace(/<[^>]+>/g, ' ');
    var words = (text.trim().match(/\S+/g) || []).length;
    var checks = [
      [!!kw && title.toLowerCase().indexOf(kw) > -1, 'Focus keyword in SEO title'],
      [!!kw && desc.toLowerCase().indexOf(kw) > -1, 'Focus keyword in meta description'],
      [!!kw && slug.indexOf(SPA.slugify(kw)) > -1, 'Focus keyword in URL slug'],
      [!!kw && text.toLowerCase().indexOf(kw) > -1, 'Focus keyword in content'],
      [words >= 300, 'Content length 300+ words (' + words + ')'],
      [(f.seo_title.value || f.title.value).length <= 60, 'SEO title within 60 characters'],
      [f.meta_description.value.length >= 70 && f.meta_description.value.length <= 160, 'Meta description 70–160 characters'],
      [!!f.featured_image.value && !!f.image_alt.value.trim(), 'Featured image with alt text']
    ];
    document.getElementById('seo-checks').innerHTML = checks.map(function (c) { return '<li class="' + (c[0] ? 'ok' : '') + '">' + esc(c[1]) + '</li>'; }).join('');
  }

  // ---------- featured & OG image
  function imageField(prefix) {
    var input = f[prefix], box = document.getElementById(prefix + '-preview'), drop = document.getElementById(prefix + '-drop');
    function show() {
      if (input.value) { box.hidden = false; box.querySelector('img').src = input.value; drop.hidden = true; }
      else { box.hidden = true; drop.hidden = false; }
    }
    box.querySelector('[data-remove]').addEventListener('click', function () { input.value = ''; show(); markDirty(); updateSeo(); });
    var file = drop.querySelector('input[type=file]');
    function handle(fl) {
      if (!fl) return;
      drop.classList.add('drag'); drop.querySelector('p').textContent = 'Uploading…';
      upload(fl, prefix === 'og_image' ? 'og' : 'featured').then(function (url) {
        input.value = url; show(); markDirty(); updateSeo(); SPA.toast('Image uploaded', 'success');
      }).catch(function (e) { SPA.toast(SPA.errMsg(e), 'error'); }).then(function () {
        drop.classList.remove('drag'); drop.querySelector('p').textContent = 'Click or drop an image (max 5 MB)'; file.value = '';
      });
    }
    file.addEventListener('change', function () { handle(file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); }); });
    drop.addEventListener('drop', function (e) { handle(e.dataTransfer.files[0]); });
    var urlBtn = document.querySelector('[data-url-for="' + prefix + '"]');
    if (urlBtn) urlBtn.addEventListener('click', function () {
      var u = window.prompt('Paste an image URL (https://…)');
      if (u && /^https:\/\/\S+$/i.test(u.trim())) { input.value = u.trim(); show(); markDirty(); updateSeo(); }
    });
    return show;
  }
  var showFeatured = imageField('featured_image');
  var showOg = imageField('og_image');

  // ---------- tags
  var tagBox = document.getElementById('tag-box'), tagEntry = document.getElementById('tag-entry');
  function renderTags() {
    tagBox.querySelectorAll('.tag-chip').forEach(function (c) { c.remove(); });
    tags.forEach(function (t, i) {
      var chip = document.createElement('span'); chip.className = 'tag-chip';
      chip.innerHTML = esc(t) + '<button type="button" aria-label="Remove tag ' + esc(t) + '">×</button>';
      chip.querySelector('button').addEventListener('click', function () { tags.splice(i, 1); renderTags(); markDirty(); });
      tagBox.insertBefore(chip, tagEntry);
    });
  }
  function addTag(v) {
    v = v.replace(/[,#]/g, '').trim().slice(0, 50);
    if (v && tags.length < 12 && !tags.some(function (t) { return t.toLowerCase() === v.toLowerCase(); })) { tags.push(v); renderTags(); markDirty(); }
  }
  tagEntry.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagEntry.value); tagEntry.value = ''; }
    else if (e.key === 'Backspace' && !tagEntry.value && tags.length) { tags.pop(); renderTags(); markDirty(); }
  });
  tagEntry.addEventListener('change', function () { if (tagEntry.value) { addTag(tagEntry.value); tagEntry.value = ''; } });
  tagBox.addEventListener('click', function () { tagEntry.focus(); });

  // ---------- categories (incl. quick add)
  function loadCategories(selected) {
    return sb.from('blog_categories').select('id,name,slug').order('name').then(function (r) {
      var sel = f.category_id; sel.innerHTML = '<option value="">— Select category —</option>';
      (r.data || []).forEach(function (c) { sel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '" data-slug="' + esc(c.slug) + '">' + esc(c.name) + '</option>'); });
      if (selected) sel.value = selected;
    });
  }
  document.getElementById('quick-cat').addEventListener('click', function () {
    var name = (window.prompt('New category name') || '').trim(); if (name.length < 2) return;
    sb.from('blog_categories').insert({ name: name, slug: SPA.slugify(name) }).select('id').single().then(function (r) {
      if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
      loadCategories(r.data.id); markDirty(); SPA.toast('Category added', 'success');
    });
  });

  // ---------- load existing post
  function fill(p) {
    ['title', 'slug', 'excerpt', 'author', 'seo_title', 'meta_description', 'focus_keyword', 'canonical_url', 'featured_image', 'image_alt', 'og_image'].forEach(function (k) { f[k].value = p[k] || ''; });
    f.published_at.value = toLocalInput(p.published_at);
    showFeatured(); showOg(); counters.forEach(function (u) { u(); });
    var st = SPA.effectiveStatus(p);
    document.getElementById('meta-status').innerHTML = SPA.badge(p);
    document.getElementById('meta-updated').textContent = SPA.date(p.updated_at, true);
    document.getElementById('meta-created').textContent = SPA.date(p.created_at, true);
    var view = document.getElementById('btn-view');
    if (st === 'published') { view.hidden = false; view.href = '/blog/' + encodeURIComponent(p.slug); } else view.hidden = true;
    document.getElementById('btn-unpublish').hidden = p.status === 'draft';
    updatePublishLabel();
  }

  // ---------- save
  function collect() {
    return {
      title: f.title.value.trim(),
      slug: SPA.slugify(f.slug.value || f.title.value),
      excerpt: f.excerpt.value.trim() || null,
      content: getContent(),
      featured_image: f.featured_image.value.trim() || null,
      image_alt: f.image_alt.value.trim() || null,
      og_image: f.og_image.value.trim() || null,
      category_id: f.category_id.value || null,
      author: f.author.value.trim() || 'Shiftingpartner Team',
      seo_title: f.seo_title.value.trim() || null,
      meta_description: f.meta_description.value.trim() || null,
      focus_keyword: f.focus_keyword.value.trim() || null,
      canonical_url: f.canonical_url.value.trim() || null
    };
  }
  function validate(row, publishing) {
    var errs = [];
    if (row.title.length < 3) errs.push('Add a title (at least 3 characters).');
    if (!row.slug) errs.push('Add a URL slug.');
    if (row.seo_title && row.seo_title.length > 70) errs.push('SEO title must be 70 characters or fewer.');
    if (row.meta_description && row.meta_description.length > 170) errs.push('Meta description must be 170 characters or fewer.');
    if (row.excerpt && row.excerpt.length > 400) errs.push('Short description must be 400 characters or fewer.');
    if (row.canonical_url && !/^https:\/\/\S+$/i.test(row.canonical_url)) errs.push('Canonical URL must start with https://');
    if (publishing) {
      if (row.content.replace(/<[^>]+>/g, '').trim().length < 50) errs.push('Add some content before publishing.');
      if (row.featured_image && !row.image_alt) errs.push('Add image alt text for the featured image.');
    }
    f.title.classList.toggle('invalid', row.title.length < 3);
    return errs;
  }
  function syncTags(id) {
    var wanted = tags.map(function (t) { return { name: t, slug: SPA.slugify(t) }; }).filter(function (t) { return t.slug; });
    var p = wanted.length ? sb.from('blog_tags').upsert(wanted, { onConflict: 'slug', ignoreDuplicates: true }).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('blog_tags').select('id,slug').in('slug', wanted.map(function (t) { return t.slug; }));
    }) : Promise.resolve({ data: [] });
    return p.then(function (r) {
      if (r.error) throw r.error;
      var ids = (r.data || []).map(function (t) { return t.id; });
      return sb.from('blog_post_tags').delete().eq('blog_id', id).then(function (d) {
        if (d.error) throw d.error;
        if (!ids.length) return;
        return sb.from('blog_post_tags').insert(ids.map(function (tid) { return { blog_id: id, tag_id: tid }; })).then(function (i) { if (i.error) throw i.error; });
      });
    });
  }
  function save(mode, btn) {
    var row = collect();
    var publishing = mode === 'publish';
    if (mode === 'draft') { row.status = 'draft'; row.published_at = fromLocalInput(f.published_at.value); }
    else if (mode === 'unpublish') { row.status = 'draft'; }
    else {
      var when = fromLocalInput(f.published_at.value) || new Date().toISOString();
      row.published_at = when;
      row.status = new Date(when) > new Date() ? 'scheduled' : 'published';
    }
    var errs = validate(row, publishing);
    if (errs.length) { SPA.toast(errs[0], 'error'); return; }
    SPA.busy(btn, true);
    var q = isEdit ? sb.from('blog_posts').update(row).eq('id', postId).select().single() : sb.from('blog_posts').insert(row).select().single();
    q.then(function (r) {
      if (r.error) throw r.error;
      return syncTags(r.data.id).then(function () { return r.data; });
    }).then(function (p) {
      dirty = false; SPA.busy(btn, false);
      var msg = p.status === 'draft' ? 'Draft saved' : p.status === 'scheduled' ? 'Scheduled for ' + SPA.date(p.published_at, true) : 'Published — live on the blog';
      if (!isEdit) { location.replace('/admin/edit-blog?id=' + p.id + '&saved=' + encodeURIComponent(msg)); return; }
      original = p; fill(p); SPA.toast(msg, 'success');
    }).catch(function (err) { SPA.busy(btn, false); SPA.toast(SPA.errMsg(err), 'error'); });
  }
  document.getElementById('btn-draft').addEventListener('click', function () { save('draft', this); });
  document.getElementById('btn-publish').addEventListener('click', function () { save('publish', this); });
  document.getElementById('btn-unpublish').addEventListener('click', function () {
    var b = this; SPA.confirm('Unpublish this post?', 'It will be hidden from the public blog and moved to drafts.', 'Unpublish').then(function (ok) { if (ok) save('unpublish', b); });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); save('draft', document.getElementById('btn-draft')); });
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save('draft', document.getElementById('btn-draft')); } });

  // ---------- preview (opens the real article template with the current, unsaved content)
  document.getElementById('btn-preview').addEventListener('click', function () {
    var row = collect();
    var opt = f.category_id.selectedOptions[0];
    row.category = row.category_id && opt ? { name: opt.textContent, slug: opt.dataset.slug } : null;
    row.tags = tags.slice();
    row.published_at = fromLocalInput(f.published_at.value) || new Date().toISOString();
    row.updated_at = new Date().toISOString();
    row.reading_time = Math.max(1, Math.ceil(((row.content.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length) / 200));
    try { localStorage.setItem('sp_preview', JSON.stringify(row)); } catch (e) { return SPA.toast('Preview needs browser storage enabled', 'error'); }
    window.open('/blog-details?preview=1', 'sp-preview');
  });

  // ---------- delete (edit page)
  var delBtn = document.getElementById('btn-delete');
  if (delBtn) delBtn.addEventListener('click', function () {
    SPA.confirm('Delete this post?', 'This permanently deletes the post. This cannot be undone.').then(function (ok) {
      if (!ok) return;
      sb.from('blog_posts').delete().eq('id', postId).then(function (r) {
        if (r.error) return SPA.toast(SPA.errMsg(r.error), 'error');
        dirty = false; location.replace('/admin/blogs');
      });
    });
  });

  // ---------- boot
  SPA.ready.then(function () {
    var saved = new URLSearchParams(location.search).get('saved');
    if (saved) { SPA.toast(saved, 'success'); history.replaceState(null, '', location.pathname + '?id=' + postId); }
    sb.from('blog_tags').select('name').order('name').then(function (r) {
      allTags = (r.data || []).map(function (t) { return t.name; });
      document.getElementById('tag-suggestions').innerHTML = allTags.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
    });
    if (!isEdit) {
      f.author.value = 'Shiftingpartner Team';
      document.getElementById('meta-status').innerHTML = '<span class="badge badge-draft">New</span>';
      updatePublishLabel();
      return loadCategories().then(function () { return initEditor(''); }).then(function () { dirty = false; });
    }
    return sb.from('blog_posts').select('*,tags:blog_post_tags(tag:blog_tags(name))').eq('id', postId).single().then(function (r) {
      if (r.error || !r.data) { SPA.toast('Post not found', 'error'); setTimeout(function () { location.replace('/admin/blogs'); }, 1200); return; }
      original = r.data;
      tags = (r.data.tags || []).map(function (t) { return t.tag && t.tag.name; }).filter(Boolean); renderTags();
      fill(r.data);
      return loadCategories(r.data.category_id).then(function () { return initEditor(r.data.content); }).then(function () { dirty = false; updateSeo(); });
    });
  }).catch(function () {});
})();
