<?php
// Minimal read-only Supabase REST helper with a small file cache (PHP 7.4+ / 8.x, Hostinger compatible).
declare(strict_types=1);

function sp_config(): array {
    static $cfg = null;
    if ($cfg === null) { $cfg = require __DIR__ . '/config.php'; }
    return $cfg;
}

function sp_db_get(string $path, int $ttl = -1): ?array {
    $cfg = sp_config();
    if (empty($cfg['supabase_url']) || empty($cfg['supabase_anon_key'])) { return null; }
    $ttl = $ttl < 0 ? (int)($cfg['cache_seconds'] ?? 0) : $ttl;
    $cacheDir = __DIR__ . '/cache';
    $cacheFile = $cacheDir . '/' . sha1($path) . '.json';
    if ($ttl > 0 && is_file($cacheFile) && (time() - filemtime($cacheFile) < $ttl)) {
        $data = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($data)) { return $data; }
    }
    $url = rtrim($cfg['supabase_url'], '/') . '/rest/v1/' . $path;
    $headers = ['apikey: ' . $cfg['supabase_anon_key'], 'Authorization: Bearer ' . $cfg['supabase_anon_key'], 'Accept: application/json'];
    $body = null; $status = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['header' => implode("\r\n", $headers), 'timeout' => 8, 'ignore_errors' => true]]);
        $body = @file_get_contents($url, false, $ctx);
        $status = isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m) ? (int)$m[1] : 0;
    }
    if ($status !== 200 || !is_string($body)) { return null; }
    $data = json_decode($body, true);
    if (!is_array($data)) { return null; }
    if ($ttl > 0) {
        if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0750, true); }
        @file_put_contents($cacheFile, $body, LOCK_EX);
    }
    return $data;
}

function sp_published_filter(): string {
    return 'status=in.(published,scheduled)&published_at=lte.' . rawurlencode(gmdate('Y-m-d\TH:i:s\Z'));
}

function e(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

// Defence in depth: content is written by authenticated admins only, but we still strip active content.
function sp_sanitize_html(string $html): string {
    $html = (string)preg_replace('#<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*>.*?</\1>#is', '', $html);
    $html = (string)preg_replace('#<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*/?>#is', '', $html);
    $html = (string)preg_replace('#\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)#i', '', $html);
    $html = (string)preg_replace('#(href|src)\s*=\s*(["\'])\s*(javascript|vbscript|data):[^"\']*\2#i', '$1="#"', $html);
    return (string)$html;
}

function sp_format_date(?string $iso): string {
    if (!$iso) { return ''; }
    try { $d = new DateTime($iso); $d->setTimezone(new DateTimeZone('Asia/Kolkata')); return $d->format('j M Y'); } catch (Exception $ex) { return ''; }
}
