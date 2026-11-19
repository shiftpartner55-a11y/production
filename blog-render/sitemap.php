<?php
// Dynamic XML sitemap of published blog posts:  /blog-sitemap.xml  (rewritten here by .htaccess)
declare(strict_types=1);
require __DIR__ . '/../includes/supabase.php';
header('Content-Type: application/xml; charset=utf-8');
$cfg = sp_config();
$site = rtrim((string)$cfg['site_url'], '/');
$rows = sp_db_get('blog_posts?select=slug,updated_at,published_at,canonical_url,featured_image,title&' . sp_published_filter() . '&order=published_at.desc&limit=5000', 600) ?? [];
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
echo '  <url><loc>' . e($site . '/blog') . '</loc><changefreq>daily</changefreq></url>' . "\n";
foreach ($rows as $r) {
    if (!empty($r['canonical_url']) && strpos($r['canonical_url'], $site) !== 0) { continue; } // canonical lives elsewhere
    $loc = $site . '/blog/' . $r['slug'];
    $mod = gmdate('Y-m-d', strtotime((string)($r['updated_at'] ?: $r['published_at'])) ?: time());
    echo '  <url><loc>' . e($loc) . '</loc><lastmod>' . $mod . '</lastmod>';
    if (!empty($r['featured_image'])) { echo '<image:image><image:loc>' . e($r['featured_image']) . '</image:loc></image:image>'; }
    echo "</url>\n";
}
echo "</urlset>\n";
