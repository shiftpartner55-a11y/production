# Shiftingpartner — Household Relocation Website

Production-ready static website (HTML5 · CSS3 · Vanilla JS) for **Shiftingpartner**, with:

- 10 public pages + 7 city landing pages, SEO and schema markup on every page
- Blog powered by **Supabase** (PostgreSQL + RLS + Storage), with server-rendered, SEO-friendly article URLs (`/blog/<slug>`, clean URLs with no `.html` anywhere)
- Admin dashboard at `/admin/` (Supabase Auth): create, edit, schedule, publish, preview and delete posts, upload images, manage categories and tags, edit SEO fields
- Consultation and contact forms → **Google Sheets** (sent directly to a Google Apps Script web app: instant, no Supabase involved).
- Deploys to **Hostinger shared hosting** (`public_html/`). No Node.js on the server. PHP is used only to server-render blog articles and the blog sitemap.

---

## 1. Project structure

```
Shifting_Partner/
├── public_html/              ← UPLOAD THE CONTENTS OF THIS FOLDER TO HOSTINGER public_html/
│   ├── index.html  about.html  blog.html  blog-details.html  contact.html
│   ├── consultation.html  thank-you.html  privacy-policy.html  terms.html  404.html
│   ├── cities/               bengaluru, hyderabad, chennai, mumbai, pune, delhi, coimbatore
│   ├── blog-render/post.php  server-rendered article  (/blog/<slug>)
│   ├── blog-render/sitemap.php dynamic blog sitemap     (/blog-sitemap.xml)
│   ├── admin/                login, dashboard, blogs, add-blog, edit-blog, categories
│   ├── includes/             config.php + supabase.php (blocked from the web)
│   ├── assets/css|js|icons|logo
│   ├── .htaccess  robots.txt  sitemap.xml  site.webmanifest
├── src/                      ← source files (edit these, then run the build)
│   ├── pages/  admin/  partials/  templates/city.html  data/cities.json
│   ├── assets/css  assets/js  static/  site.config.json
├── supabase/
│   ├── schema.sql            tables, RLS policies, storage bucket, default categories
│   ├── seed-posts.sql        3 optional starter articles
│   ├── create-admin.sql      make a user an admin
├── google-apps-script/Code.gs           Google Sheets receiver + reference number generator
├── source/                   original logo + UI reference
└── tools/
    ├── build.ps1             builds src/ → public_html/ (minifies CSS/JS, generates city pages + sitemap)
    ├── serve.ps1             local preview server (http://localhost:8080)
    └── process-logo.ps1      regenerates web logo files from source/logo
```

### Building (only needed after editing `src/`)

```bash
powershell -ExecutionPolicy Bypass -File tools/build.ps1
```

The build never overwrites `public_html/assets/js/config.js` or `public_html/includes/config.php` once they exist, so your keys are safe.

### Local preview

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8080. PHP and `.htaccess` do not run locally; blog articles render client-side in that case.

---

## 2. Credentials you need to add, and where

| What | Where it goes | Public? |
|---|---|---|
| Supabase Project URL | `public_html/assets/js/config.js` → `supabaseUrl` **and** `public_html/includes/config.php` → `supabase_url` | yes |
| Supabase anon (publishable) key | `config.js` → `supabaseAnonKey` **and** `config.php` → `supabase_anon_key` | yes (protected by RLS) |
| Apps Script web app URL (…/exec) | `config.js` → `appsScriptUrl` | yes |
| (optional) Google Maps browser key with Places API | `config.js` → `googleMapsApiKey` (restrict it to your domain) | yes |
| (optional) Lead notification email | Apps Script property `NOTIFY_EMAIL` | — |

**Never** put the Supabase `service_role` key, Google credentials or the shared secret in any file inside `public_html/`.

---

## 3. Supabase setup (database, auth, storage)

1. Create a project at https://supabase.com (region: Mumbai `ap-south-1` is closest to your users).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**. This creates:
   - `admin_users`, `blog_posts`, `blog_categories`, `blog_tags`, `blog_post_tags` (there is no leads table)
   - Row Level Security: the public can read **published** posts only; only admins can create, edit or delete
   - the `blog-images` storage bucket: public read, admin-only upload, update and delete (5 MB, images only)
   - the 5 default categories
3. Optional: run `supabase/seed-posts.sql` to add 3 starter articles.
4. **Authentication → Providers → Email**: keep Email enabled and **disable "Allow new users to sign up"**, so nobody can self-register.
5. **Authentication → URL Configuration**: Site URL = `https://shiftingpartner.com`; add Redirect URL `https://shiftingpartner.com/admin/login` (used by "Forgot password").
6. **Project Settings → API**: copy the Project URL and the anon/publishable key into `config.js` and `includes/config.php` (see the table above).

### Create your admin account

1. **Authentication → Users → Add user → Create new user**: enter your email and a strong password, and tick *Auto Confirm User*.
2. **SQL Editor**: open `supabase/create-admin.sql`, replace the email and run it.
3. Go to `https://shiftingpartner.com/admin/` and log in.

A logged-in user who is **not** listed in `admin_users` is signed out immediately, and RLS blocks every write from them anyway.

---

## 4. Google Sheets lead capture (no Supabase)

Flow: **website form → Google Apps Script web app → your Google Sheet**, in a single request. Each row is saved the moment the visitor clicks Submit. The script generates the reference number (`SP-YYYYMMDD-00001` for consultations, `SPE-YYYYMMDD-00001` for contact enquiries), and the visitor is sent to the thank-you page only after that number comes back.

1. Open your Google Sheet → **Extensions → Apps Script** → delete the sample code → paste `google-apps-script/Code.gs` → **Save**. (Your sheet ID is already in the code.)
2. Choose the function **`setup`** in the toolbar → **Run** → **Allow**. This creates the **Consultation Leads** and **Contact Enquiries** tabs with their headings.
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone** → **Deploy** → copy the URL (ends in `/exec`).
4. Paste it into `public_html/assets/js/config.js` → `appsScriptUrl: 'https://script.google.com/macros/s/…/exec'`.
5. Optional: **Project Settings → Script properties** → `NOTIFY_EMAIL` = your email, for an email alert on every lead.
6. After changing the script later: **Deploy → Manage deployments → Edit → Version: New version → Deploy** (the URL stays the same).

**Protection built in:** validation in the browser and again in the script, a honeypot field, a minimum time-to-fill check, an overall rate limit plus a per-phone limit, idempotency keys (a retry or double-click never creates a second row), 10-minute duplicate detection, and protection against spreadsheet formula injection. If a submission fails, the form keeps what was typed and offers **Try again**.

---

## 5. Deploying to Hostinger

1. hPanel → **Websites → Manage → File Manager** → open `public_html/` (delete the default `default.php`/`index.php` if present).
2. Upload **everything inside** the local `public_html/` folder, including the hidden `.htaccess` files (`/.htaccess`, `/admin/.htaccess`, `/includes/.htaccess`). Tip: zip the contents, upload the zip, then **Extract** it.
3. Edit on the server (or before uploading):
   - `public_html/assets/js/config.js` → Supabase URL and anon key
   - `public_html/includes/config.php` → Supabase URL and anon key
4. Make sure `public_html/includes/` is writable (permission 755) so the article cache folder can be created.
5. **PHP version**: hPanel → Advanced → PHP Configuration → PHP 8.1 or newer, with `curl` and `mbstring` enabled (both are on by default).

### Domain connection
- Domain registered with Hostinger: it is connected automatically when you add the website.
- Domain registered elsewhere: point the nameservers to `ns1.dns-parking.com` and `ns2.dns-parking.com`, **or** create an `A` record for `@` with your Hostinger IP (hPanel → Hosting → Details) and a `CNAME` for `www` pointing to `shiftingpartner.com`. DNS can take up to 24 hours to update.

### SSL
hPanel → **Security → SSL** → install the free SSL on `shiftingpartner.com` (and `www`). Once it shows *Active*, the `.htaccess` file already forces HTTPS and redirects `www` to the bare domain. If you prefer `www` as the main address, change `url` in `src/site.config.json` and the redirect rule in `src/static/.htaccess`, then rebuild.

### After going live, test these
- `/` and the other pages, `/cities/pune`, `/blog`, and a blog article `/blog/how-to-pack-your-home-for-moving` (open View Source and confirm the article text is in the HTML)
- `/blog-sitemap.xml`, `/sitemap.xml`, `/robots.txt`
- Submit the consultation form → a row appears in the Sheet and the thank-you page shows the reference number
- Submit the contact form → a row appears in Contact Enquiries
- `/admin/` → log in → create a draft → Preview → Publish → the article appears on `/blog`

---

## 6. SEO setup

Already built in: a unique title, meta description and canonical link on every page; Open Graph and Twitter tags; a clean H1–H3 hierarchy; breadcrumbs (visible and as schema); Organization, WebSite, MovingCompany, Service, FAQPage, BreadcrumbList, Blog and BlogPosting structured data; `sitemap.xml` (pages), `blog-sitemap.xml` (dynamic); `robots.txt`; lazy-loaded responsive images with explicit sizes; minified CSS and JS; long-term caching and gzip through `.htaccess`. No ratings or reviews appear in the schema.

### Google Search Console
1. https://search.google.com/search-console → **Add property → Domain** → `shiftingpartner.com` → verify with the DNS TXT record (hPanel → Domains → DNS / Nameservers → add a TXT record).
2. **Sitemaps** → submit `sitemap.xml` and `blog-sitemap.xml`.
3. **URL Inspection** → request indexing for the home page and the city pages.
4. Also create a **Google Business Profile** for local search, and add your real address if you have one. The site currently uses no `LocalBusiness` address schema because no address was provided.

### Writing blog posts that rank
Use the editor's SEO panel: a focus keyword, an SEO title of 60 characters or fewer, a meta description of 120–160 characters, a descriptive slug, alt text on the featured image, and 800+ words. Link to the relevant city pages and the consultation page.

---

## 7. Placeholders and items to confirm before launch

| Item | Where | Status |
|---|---|---|
| Supabase URL and anon key | `config.js`, `includes/config.php` | **required** |
| Apps Script web app URL | `config.js` → `appsScriptUrl` | **required** for forms |
| Business hours | `src/site.config.json` (`hours`) and `src/pages/contact.html` | placeholder, please confirm |
| Social media links | `src/site.config.json` | currently point to the platform home pages; replace with your profiles |
| Testimonials | `src/pages/index.html` | clearly labelled **Sample**; replace with verified reviews (with customer consent) |
| Photography | Unsplash images (free licence) | see below |
| Privacy Policy and Terms | `src/pages/privacy-policy.html`, `terms.html` | templates; have them reviewed legally |
| Customer rating (4.8/5) and "2,000+ moves" | — | intentionally **not shown**, because they are not verified; add them once you can back them up |

### Photography
The site uses carefully chosen photos from Unsplash (free for commercial use, delivered as WebP or AVIF in responsive sizes). **Branded Shiftingpartner truck photography does not exist yet.** To replace any image with your own (strongly recommended for the home hero and About page):
1. Save the image as WebP (around 2000px wide for heroes, 1200px for cards) in `src/static/assets/images/`.
2. In the page source, change `<sp-img id="…">` to `<sp-img src="/assets/images/your-file.webp" …>` (keep `alt` and `ratio`).
3. Run the build.

### Logo
`assets/logo/logo.png` is your official logo: trimmed, with the white background made transparent and the colours unchanged. For the dark header and footer, your UI reference uses a reversed version (white "Shifting"). `logo-header-light.png` and `logo-light.png` reproduce that from the official artwork. If your designer has official reversed or horizontal exports, drop them into `public_html/assets/logo/` with the same file names.

---

## 8. Admin dashboard — quick guide

- **Dashboard**: published, draft and scheduled counts, number of categories, recent updates.
- **All Blogs**: filter by status or category, search, publish or unpublish in one click, edit, delete, view live.
- **Add / Edit Blog**: title, slug (filled in automatically), short description, rich-text content (headings, bold, italic, lists, links, images, tables, quotes), featured image upload with alt text, category (with quick add), tags, author, publication date (a future date schedules the post), SEO title, meta description, focus keyword, canonical URL, Open Graph image, a live Google preview and an SEO checklist. Preview opens the real article template with your unsaved changes. Ctrl + S saves a draft.
- **Categories & Tags**: add, rename or delete categories; remove tags.
- Scheduled posts go live automatically at their publication time; no cron job is needed. RLS and the article renderer both check `published_at <= now()`.
- Uploaded images are resized automatically to a maximum of 1920px and converted to WebP in the browser before upload.

---

## 9. Security summary

- Public pages and the admin panel use only the **anon** key; all data access is enforced by **Row Level Security** and the `is_admin()` function.
- Public sign-ups are disabled; admins are added only via SQL.
- Storage writes are restricted to admins; uploads are limited by type and size.
- Lead data goes browser → Apps Script → Google Sheets; nothing is stored in Supabase.
- `/includes/` is denied by `.htaccess`; `/admin/` sends `noindex` and `no-store` headers.
- Security headers (nosniff, frame options, referrer policy, permissions policy, HSTS) are set in `.htaccess`. A ready-made Content-Security-Policy line is included there, commented out; enable it after testing.

---

## 10. Consultation popup, Google Tag Manager and credits

**Popup:** the free consultation form opens by itself once, 8 seconds after a visitor arrives (as a bottom sheet on mobile). It doesn't appear again for 7 days, never after the visitor has submitted a lead, and never on `/consultation` or `/thank-you`. It also stays closed if the visitor is typing in another form or has the mobile menu open. The popup and the consultation page share one form (`src/partials/consult-form.html`), so both save to the **Consultation Leads** tab. To turn the popup off on a page, add `popup: off` to that page's header block in `src/pages/`.

**Google Tag Manager (GTM-W286KDXF)** is on every public page (`src/partials/gtm-head.html` and `gtm-body.html`). The website sends these events to the dataLayer, ready to use as GTM triggers (for GA4 or Google Ads conversions):

| Event | When | Extra fields |
|---|---|---|
| `generate_lead` | A consultation or contact form is saved in the sheet | `form_type` (consultation/contact), `form_location` (consultation_page/popup/contact_page), `lead_id`, `move_type` |
| `consultation_popup_open` | The popup opens | `popup_trigger` (timer_8s/click) |

In GTM, create a **Custom Event** trigger with event name `generate_lead` and attach your GA4 event or Ads conversion tag to it.

**Footer credit:** "Developed by Howlers · Powered by Brand Making Tractor" (`src/partials/footer.html`).

**Security in this release:** HTTPS and www redirects, security headers (HSTS, nosniff, frame protection, referrer and permissions policy, a baseline Content-Security-Policy), server signature hidden, Subresource Integrity on all CDN scripts, `/includes/` blocked, admin pages `noindex` and `no-store`, Supabase Row Level Security, and lead spam protection in Apps Script.

---

## 11. GitHub branches and deploying to Hostinger

Hostinger deploys the **root of the `main` branch** straight into `public_html`, so:

| Branch | Contains | Used for |
|---|---|---|
| `main` | Only the built website (the contents of `public_html/`) | Hostinger deploys this |
| `source` | The full project: `src/`, `tools/`, `supabase/`, `google-apps-script/`, this README | Editing and building |

**To publish a change:** edit files in `src/` on the `source` branch, then run:

```bash
powershell -ExecutionPolicy Bypass -File tools/publish.ps1 "What changed"
```

This builds the site, pushes `source`, updates `main` with the new `public_html/` contents, and then you click **Redeploy** in Hostinger.

**Never** point Hostinger at the `source` branch: it would make the source code and this guide publicly downloadable.
