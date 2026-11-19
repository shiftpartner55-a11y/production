<?php
/**
 * Shiftingpartner server-side configuration (public_html/includes/config.php)
 * Used only by blog/post.php and blog/sitemap.php to read PUBLISHED blog posts.
 * The anon key is public by design (Row Level Security protects data).
 * Never put the Supabase service-role key here.
 */
return [
    'supabase_url'      => 'https://mvkhjykvlopmsapxziyx.supabase.co',   // e.g. https://abcdefghijkl.supabase.co
    'supabase_anon_key' => 'sb_publishable_t-PW84t-FZ31yDNU0zo0RA_f26dKhoX',   // Project Settings > API > anon / publishable key
    'site_url'          => 'https://shiftingpartner.com',
    'cache_seconds'     => 300,  // server-side cache for rendered articles (0 = off)
];
