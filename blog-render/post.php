<?php
/**
 * Server-rendered blog article:  /blog/<slug>  (rewritten here by .htaccess)
 * Uses /blog-details as the page template (same header, footer and styles as the site),
 * fills in SEO tags, BlogPosting + BreadcrumbList structured data and the full article HTML,
 * so search engines receive complete content without running JavaScript.
 */
declare(strict_types=1);
require __DIR__ . '/../includes/supabase.php';

$slug = isset($_GET['slug']) ? strtolower((string)$_GET['slug']) : '';
$template = @file_get_contents(__DIR__ . '/../blog-details.html');
if ($template === false) { http_response_code(500); exit('Template missing'); }

function sp_not_found(): void {
    http_response_code(404);
    readfile(__DIR__ . '/../404.html');
    exit;
}
if (!preg_match('/^[a-z0-9-]{1,140}$/', $slug)) { sp_not_found(); }

$cfg = sp_config();
$site = rtrim((string)$cfg['site_url'], '/');
$rows = sp_db_get('blog_posts?select=*,category:blog_categories(name,slug),tags:blog_post_tags(tag:blog_tags(name,slug))&slug=eq.' . rawurlencode($slug) . '&' . sp_published_filter() . '&limit=1');

if ($rows === null) {
    // Supabase not configured or unreachable: serve the template; client-side JS will try to render it.
    header('Cache-Control: no-store');
    echo $template;
    exit;
}
if (empty($rows)) { sp_not_found(); }
$p = $rows[0];

$cat = $p['category'] ?? null;
$tags = array_values(array_filter(array_map(function ($t) { return $t['tag'] ?? null; }, $p['tags'] ?? [])));
$url = !empty($p['canonical_url']) ? $p['canonical_url'] : $site . '/blog/' . $p['slug'];
$title = (!empty($p['seo_title']) ? $p['seo_title'] : $p['title']) . ' | Shiftingpartner';
$desc = !empty($p['meta_description']) ? $p['meta_description'] : (string)($p['excerpt'] ?? '');
$img = !empty($p['og_image']) ? $p['og_image'] : (string)($p['featured_image'] ?? '');
$published = (string)($p['published_at'] ?? '');
$updated = (string)($p['updated_at'] ?? $published);
$reading = max(1, (int)($p['reading_time'] ?? 3));

// ---- SEO block
$seo = '<title>' . e($title) . '</title>' . "\n"
    . '<meta name="description" content="' . e($desc) . '">' . "\n"
    . '<link rel="canonical" href="' . e($url) . '">' . "\n"
    . '<meta name="robots" content="index, follow, max-image-preview:large">' . "\n"
    . '<meta property="og:type" content="article">' . "\n"
    . '<meta property="og:site_name" content="Shiftingpartner">' . "\n"
    . '<meta property="og:locale" content="en_IN">' . "\n"
    . '<meta property="og:title" content="' . e($title) . '">' . "\n"
    . '<meta property="og:description" content="' . e($desc) . '">' . "\n"
    . '<meta property="og:url" content="' . e($url) . '">' . "\n"
    . ($img ? '<meta property="og:image" content="' . e($img) . '">' . "\n" : '')
    . '<meta property="article:published_time" content="' . e($published) . '">' . "\n"
    . '<meta property="article:modified_time" content="' . e($updated) . '">' . "\n"
    . ($cat ? '<meta property="article:section" content="' . e($cat['name']) . '">' . "\n" : '')
    . '<meta name="twitter:card" content="summary_large_image">' . "\n"
    . '<meta name="twitter:title" content="' . e($title) . '">' . "\n"
    . '<meta name="twitter:description" content="' . e($desc) . '">' . "\n"
    . ($img ? '<meta name="twitter:image" content="' . e($img) . '">' . "\n" : '');

// ---- Structured data
$ld = [
    '@context' => 'https://schema.org', '@type' => 'BlogPosting',
    'headline' => mb_substr((string)$p['title'], 0, 110), 'description' => $desc,
    'datePublished' => $published, 'dateModified' => $updated,
    'author' => ['@type' => !empty($p['author']) ? 'Person' : 'Organization', 'name' => !empty($p['author']) ? $p['author'] : 'Shiftingpartner'],
    'publisher' => ['@type' => 'Organization', 'name' => 'Shiftingpartner', 'logo' => ['@type' => 'ImageObject', 'url' => $site . '/assets/logo/logo.png']],
    'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
    'inLanguage' => 'en-IN',
];
if ($img) { $ld['image'] = [$img]; }
if ($cat) { $ld['articleSection'] = $cat['name']; }
if (!empty($p['focus_keyword'])) { $ld['keywords'] = $p['focus_keyword']; }
$crumbs = [['Home', $site . '/'], ['Blog', $site . '/blog']];
if ($cat) { $crumbs[] = [$cat['name'], $site . '/blog?category=' . rawurlencode($cat['slug'])]; }
$crumbs[] = [$p['title'], null];
$items = [];
foreach ($crumbs as $i => $c) { $it = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $c[0]]; if ($c[1]) { $it['item'] = $c[1]; } $items[] = $it; }
$jsonFlags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP;
$ldHtml = '<script type="application/ld+json">' . json_encode($ld, $jsonFlags) . '</script>' . "\n"
    . '<script type="application/ld+json">' . json_encode(['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items], $jsonFlags) . '</script>';

// ---- Article HTML (mirrors assets/js/blog-post.js render())
function icon(string $n): string { return '<svg class="i" aria-hidden="true"><use href="/assets/icons/sprite.svg#' . $n . '"></use></svg>'; }
$bc = '<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li>'
    . ($cat ? '<li><a href="/blog?category=' . e($cat['slug']) . '">' . e($cat['name']) . '</a></li>' : '')
    . '<li aria-current="page">' . e($p['title']) . '</li></ol></nav>';
$showUpdated = $updated && $published && (strtotime($updated) - strtotime($published) > 86400);
$share = rawurlencode($url); $shareT = rawurlencode((string)$p['title']);
$article = '<section class="article-head"><div class="container">' . $bc
    . ($cat ? '<p class="eyebrow">' . e($cat['name']) . '</p>' : '')
    . '<h1>' . e($p['title']) . '</h1>'
    . (!empty($p['excerpt']) ? '<p class="excerpt">' . e($p['excerpt']) . '</p>' : '')
    . '<div class="post-meta"><span>' . icon('calendar') . 'Published <time datetime="' . e($published) . '">' . sp_format_date($published) . '</time></span>'
    . ($showUpdated ? '<span>' . icon('refresh') . 'Updated <time datetime="' . e($updated) . '">' . sp_format_date($updated) . '</time></span>' : '')
    . '<span>' . icon('clock') . $reading . ' min read</span>'
    . (!empty($p['author']) ? '<span>' . icon('user') . e($p['author']) . '</span>' : '') . '</div>'
    . (!empty($p['featured_image'])
        ? '<figure class="article-cover"><img src="' . e($p['featured_image']) . '" alt="' . e($p['image_alt'] ?: $p['title']) . '" width="1600" height="800" fetchpriority="high"></figure>'
        : '<div style="height:56px"></div>')
    . '</div></section>'
    . '<section class="section-sm"><div class="container article-wrap"><article>'
    . '<div class="prose">' . sp_sanitize_html((string)($p['content'] ?? '')) . '</div>'
    . ($tags ? '<div class="article-tags">' . implode('', array_map(function ($t) { return '<span>#' . e($t['name']) . '</span>'; }, $tags)) . '</div>' : '')
    . '<div class="author-box"><span class="avatar">' . e(strtoupper(mb_substr($p['author'] ?: 'S', 0, 1))) . '</span><div><strong>' . e($p['author'] ?: 'Shiftingpartner Team') . '</strong><span>Household relocation insights from the Shiftingpartner team.</span></div></div>'
    . '<div class="share"><strong>Share this article</strong>'
    . '<a href="https://wa.me/?text=' . $shareT . '%20' . $share . '" target="_blank" rel="noopener" aria-label="Share on WhatsApp">' . icon('whatsapp') . '</a>'
    . '<a href="https://www.facebook.com/sharer/sharer.php?u=' . $share . '" target="_blank" rel="noopener" aria-label="Share on Facebook">' . icon('facebook') . '</a>'
    . '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' . $share . '" target="_blank" rel="noopener" aria-label="Share on LinkedIn">' . icon('linkedin') . '</a>'
    . '<a href="mailto:?subject=' . $shareT . '&amp;body=' . $share . '" aria-label="Share by email">' . icon('mail') . '</a>'
    . '<button type="button" data-copy="' . e($url) . '" aria-label="Copy link">' . icon('link') . '</button></div>'
    . '</article>'
    . '<aside class="article-aside"><div class="side-card dark"><p class="eyebrow eyebrow-light">Free consultation</p><h3>Planning a household move?</h3>'
    . '<p>Share your pickup and drop locations and our team will help you plan your relocation.</p>'
    . '<a class="btn btn-primary btn-block" href="/consultation">Get Free Consultation ' . icon('arrow') . '</a></div>'
    . '<div class="side-card"><h3>Read more guides</h3><p style="color:var(--muted);font-size:15px">Moving tips, packing guides and city guides.</p><a class="link-arrow" href="/blog">All articles ' . icon('arrow') . '</a></div></aside>'
    . '</div></section>'
    . '<script type="application/json" id="post-data">' . json_encode(['id' => $p['id'], 'slug' => $p['slug'], 'category_id' => $p['category_id'] ?? null], $jsonFlags) . '</script>';

// ---- Assemble
$html = preg_replace('#<!--SP-SEO-START-->.*?<!--SP-SEO-END-->#s', $seo, $template, 1);
$html = str_replace('<!--SP-LD-->', $ldHtml, $html);
$html = preg_replace('#<!--SP-POST-START-->.*?<!--SP-POST-END-->#s', str_replace(['\\', '$'], ['\\\\', '\\$'], $article), $html, 1);
$html = str_replace('id="post-root" data-ssr="0"', 'id="post-root" data-ssr="1"', $html);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', strtotime($updated) ?: time()) . ' GMT');
echo $html;
