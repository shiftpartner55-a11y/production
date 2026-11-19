# Shiftingpartner static site build (Windows PowerShell 5.1+, no Node/PHP required)
#   powershell -ExecutionPolicy Bypass -File tools/build.ps1
# Reads src/ and writes the deployable site into public_html/.
#  - src/pages/**.html   -> public pages wrapped in src/partials/layout.html
#  - src/admin/*.html    -> /admin pages wrapped in src/partials/admin-layout.html (or "layout: bare")
#  - src/assets/css|js   -> minified into public_html/assets/css|js (config.js is copied as-is)
#  - src/static/**       -> copied verbatim (tokens like {{site.url}} expanded in text files)
#  - sitemap.xml generated from indexable pages
param([switch]$NoMinify)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$src = Join-Path $root 'src'
$out = Join-Path $root 'public_html'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Text([string]$p) { [IO.File]::ReadAllText($p, $utf8) }
function Write-Text([string]$p, [string]$t) {
  $d = Split-Path $p; if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }
  [IO.File]::WriteAllText($p, $t, $utf8)
}
function HtmlEnc([string]$s) { [System.Net.WebUtility]::HtmlEncode($s) }
function JsonStr([string]$s) { '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }

$cfgObj = Read-Text (Join-Path $src 'site.config.json') | ConvertFrom-Json
$vars = @{}
foreach ($p in $cfgObj.PSObject.Properties) { $vars["site.$($p.Name)"] = [string]$p.Value }
$vars['build.date'] = (Get-Date).ToString('yyyy-MM-dd')
$vars['build.year'] = (Get-Date).ToString('yyyy')
$vars['build.ver'] = (Get-Date).ToString('yyyyMMddHHmm')

function Expand-Tokens([string]$t, [hashtable]$v) {
  return [regex]::Replace($t, '\{\{\s*([\w\.\-]+)\s*\}\}', [System.Text.RegularExpressions.MatchEvaluator] {
    param($m) $k = $m.Groups[1].Value; if ($v.ContainsKey($k)) { return $v[$k] } else { return $m.Value } })
}

$partials = @{}
Get-ChildItem (Join-Path $src 'partials') -Filter *.html | ForEach-Object { $partials[$_.BaseName] = Read-Text $_.FullName }
function Expand-Includes([string]$t) {
  for ($i = 0; $i -lt 3; $i++) {
    $t = [regex]::Replace($t, '<!--@include\s+([\w\-]+)\s*-->', [System.Text.RegularExpressions.MatchEvaluator] {
      param($m) $n = $m.Groups[1].Value; if ($partials.ContainsKey($n)) { return $partials[$n] } else { throw "Missing partial $n" } })
  }
  return $t
}

# <sp-img id="unsplash-photo-id" | src="/local.webp" alt="" ratio="3:2" sizes="" class="" eager>
function Expand-Images([string]$t) {
  return [regex]::Replace($t, '<sp-img\s+([^>]*?)\s*/?>', [System.Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $a = @{}
    foreach ($am in [regex]::Matches($m.Groups[1].Value, '([\w\-]+)(?:="([^"]*)")?')) { $a[$am.Groups[1].Value] = $am.Groups[2].Value }
    $ratio = if ($a['ratio']) { $a['ratio'] } else { '3:2' }
    $rp = $ratio.Split(':'); $w = 1600; $h = [int][Math]::Round($w * [double]$rp[1] / [double]$rp[0])
    $sizes = if ($a['sizes']) { $a['sizes'] } else { '100vw' }
    $cls = if ($a['class']) { " class=`"$($a['class'])`"" } else { '' }
    $load = if ($a.ContainsKey('eager')) { ' loading="eager" fetchpriority="high"' } else { ' loading="lazy"' }
    $alt = HtmlEnc ([System.Net.WebUtility]::HtmlDecode($a['alt']))
    if ($a['src']) {
      return "<img src=`"$($a['src'])`" alt=`"$alt`" width=`"$w`" height=`"$h`"$cls$load decoding=`"async`">"
    }
    $base = "https://images.unsplash.com/photo-$($a['id'])?auto=format&amp;fit=crop&amp;ar=$ratio&amp;q=72"
    $srcset = (@(480, 800, 1200, 1600, 2200) | ForEach-Object { "$base&amp;w=$_ ${_}w" }) -join ', '
    return "<img src=`"$base&amp;w=1200`" srcset=`"$srcset`" sizes=`"$sizes`" alt=`"$alt`" width=`"$w`" height=`"$h`"$cls$load decoding=`"async`">"
  })
}

# <sp-i phone> or <sp-i phone class="extra">  -> inline SVG referencing the shared sprite
function Expand-Icons([string]$t) {
  return [regex]::Replace($t, '<sp-i\s+([\w\-]+)(?:\s+class="([^"]*)")?\s*/?>', [System.Text.RegularExpressions.MatchEvaluator] {
    param($m) $c = 'i'; if ($m.Groups[2].Success) { $c += ' ' + $m.Groups[2].Value }
    return "<svg class=`"$c`" aria-hidden=`"true`" focusable=`"false`"><use href=`"/assets/icons/sprite.svg#$($m.Groups[1].Value)`"></use></svg>" })
}

function Parse-Page([string]$raw) {
  $meta = @{}
  $m = [regex]::Match($raw, '^\s*<!--(.*?)-->', 'Singleline')
  $body = $raw
  if ($m.Success) {
    foreach ($line in ($m.Groups[1].Value -split "`n")) {
      $kv = [regex]::Match($line, '^\s*([\w\-]+)\s*:\s*(.*?)\s*$'); if ($kv.Success) { $meta[$kv.Groups[1].Value] = $kv.Groups[2].Value }
    }
    $body = $raw.Substring($m.Length)
  }
  $head = ''; $scripts = ''
  $hm = [regex]::Match($body, '<!--HEAD-->(.*?)<!--/HEAD-->', 'Singleline'); if ($hm.Success) { $head = $hm.Groups[1].Value; $body = $body.Remove($hm.Index, $hm.Length) }
  $sm = [regex]::Match($body, '<!--SCRIPTS-->(.*?)<!--/SCRIPTS-->', 'Singleline'); if ($sm.Success) { $scripts = $sm.Groups[1].Value; $body = $body.Remove($sm.Index, $sm.Length) }
  return @{ meta = $meta; body = $body.Trim(); head = $head.Trim(); scripts = $scripts.Trim() }
}

function Build-Crumbs([string]$spec, [string]$siteUrl) {
  # "Home|/ > Blog|/blog > Title"
  if (-not $spec) { return @('', '') }
  $parts = $spec -split '\s*>\s*'
  $html = '<nav class="breadcrumb" aria-label="Breadcrumb"><ol>'
  $items = @(); $i = 1
  foreach ($p in $parts) {
    $nm, $href = $p -split '\|', 2
    if ($href) { $html += "<li><a href=`"$href`">$(HtmlEnc $nm)</a></li>"; $url = $siteUrl + $href }
    else { $html += "<li aria-current=`"page`">$(HtmlEnc $nm)</li>"; $url = $null }
    $item = "{`"@type`":`"ListItem`",`"position`":$i,`"name`":$(JsonStr $nm)"
    if ($url) { $item += ",`"item`":$(JsonStr $url)" }
    $items += $item + '}'; $i++
  }
  $html += '</ol></nav>'
  $ld = "<script type=`"application/ld+json`">{`"@context`":`"https://schema.org`",`"@type`":`"BreadcrumbList`",`"itemListElement`":[" + ($items -join ',') + ']}</script>'
  return @($html, $ld)
}

$sitemap = New-Object System.Collections.Generic.List[string]
function Build-Pages([string]$dir, [string]$outBase, [string]$defaultLayout) {
  if (-not (Test-Path $dir)) { return }
  Get-ChildItem $dir -Recurse -Filter *.html | ForEach-Object {
    $rel = $_.FullName.Substring($dir.Length).TrimStart('\') -replace '\\', '/'
    $pg = Parse-Page (Read-Text $_.FullName)
    $meta = $pg.meta
    $layout = if ($meta['layout']) { $meta['layout'] } else { $defaultLayout }
    $v = $vars.Clone()
    $path = if ($meta.ContainsKey('path')) { $meta['path'] } else { $rel }
    $v['page.path'] = $path
    $v['page.title'] = HtmlEnc $meta['title']
    $v['page.description'] = HtmlEnc $meta['description']
    $v['page.canonical'] = $vars['site.url'] + '/' + $path
    $v['page.og_image'] = if ($meta['og_image']) { $meta['og_image'] } else { $vars['site.og_default'] }
    $v['page.og_type'] = if ($meta['og_type']) { $meta['og_type'] } else { 'website' }
    $v['page.robots'] = if ($meta['robots']) { $meta['robots'] } else { 'index, follow, max-image-preview:large' }
    $v['page.body_class'] = $meta['body_class']
    $crumbs = Build-Crumbs $meta['crumbs'] $vars['site.url']
    $v['breadcrumb'] = $crumbs[0]
    $v['page.head'] = $pg.head + "`n" + $crumbs[1]
    $v['page.scripts'] = $pg.scripts
    # Site-wide consultation popup (skip with "popup: off" in page meta)
    $v['page.popup'] = if ($meta['popup'] -eq 'off' -or $layout -ne 'site') { '' } else { Expand-Includes $partials['consult-popup'] }
    $content = Expand-Includes $pg.body
    $v['content'] = $content
    if ($layout -eq 'bare') { $html = $content } else {
      $tpl = if ($layout -eq 'admin') { $partials['admin-layout'] } else { $partials['layout'] }
      $html = Expand-Includes $tpl
      # content/head/scripts are inserted before token expansion so their own tokens expand too
      $html = $html.Replace('{{content}}', $content).Replace('{{page.head}}', $v['page.head']).Replace('{{page.scripts}}', $v['page.scripts'])
    }
    $html = Expand-Tokens $html $v
    $html = Expand-Tokens $html $v
    $html = Expand-Images $html
    $html = Expand-Icons $html
    if ($meta['nav']) { $html = $html.Replace("data-nav=`"$($meta['nav'])`"", "data-nav=`"$($meta['nav'])`" aria-current=`"page`"") }
    $html = [regex]::Replace($html, "(\r?\n\s*){3,}", "`n`n")
    Write-Text (Join-Path $outBase $rel) $html
    if ($layout -ne 'admin' -and $layout -ne 'bare' -and $v['page.robots'] -notmatch 'noindex') {
      $prio = if ($meta['priority']) { $meta['priority'] } else { '0.7' }
      $loc = if ($path -eq '') { $vars['site.url'] + '/' } else { $vars['site.url'] + '/' + $path }
      $sitemap.Add("  <url><loc>$loc</loc><lastmod>$($vars['build.date'])</lastmod><priority>$prio</priority></url>")
    }
    Write-Host "page  $rel"
  }
}

function Minify-Css([string]$c) {
  $c = [regex]::Replace($c, '/\*.*?\*/', '', 'Singleline')
  $c = [regex]::Replace($c, '\s+', ' ')
  $c = [regex]::Replace($c, '\s*([{};,>])\s*', '$1')
  $c = [regex]::Replace($c, ':\s+', ':')
  $c = $c.Replace(';}', '}')
  # restore spaces needed inside media queries "and("
  $c = $c -replace '\)and\(', ') and ('
  return $c.Trim()
}
function Minify-Js([string]$j) {
  $lines = $j -split "\r?\n"
  $outL = foreach ($l in $lines) { $t = $l.Trim(); if ($t -eq '' -or $t.StartsWith('//')) { continue }; $t }
  return ($outL -join "`n")
}

# ---- assets
$cssDir = Join-Path $src 'assets\css'; $jsDir = Join-Path $src 'assets\js'
Get-ChildItem $cssDir -Filter *.css | ForEach-Object {
  $c = Read-Text $_.FullName; if (-not $NoMinify) { $c = Minify-Css $c }
  Write-Text (Join-Path $out "assets\css\$($_.Name)") $c; Write-Host "css   $($_.Name)"
}
Get-ChildItem $jsDir -Filter *.js | ForEach-Object {
  $j = Read-Text $_.FullName
  $dest = Join-Path $out "assets\js\$($_.Name)"
  if ($_.Name -eq 'config.js') { if (Test-Path $dest) { Write-Host "keep  config.js (already configured in public_html)"; return } }
  elseif (-not $NoMinify) { $j = Minify-Js $j }
  Write-Text $dest $j; Write-Host "js    $($_.Name)"
}

# ---- static files (copied, tokens expanded in text formats)
$staticDir = Join-Path $src 'static'
Get-ChildItem $staticDir -Recurse -File -Force | ForEach-Object {
  $rel = $_.FullName.Substring($staticDir.Length).TrimStart('\')
  $dest = Join-Path $out $rel
  if ($rel -eq 'includes\config.php' -and (Test-Path $dest)) { Write-Host "keep  includes/config.php (already configured)"; return }
  if ($_.Extension -in '.php', '.txt', '.htaccess', '.xml', '.webmanifest', '.json' -or $_.Name -eq '.htaccess') {
    Write-Text $dest (Expand-Tokens (Read-Text $_.FullName) $vars)
  } else { New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null; Copy-Item $_.FullName $dest -Force }
  Write-Host "copy  $rel"
}

# ---- city landing pages (generated from src/data/cities.json + src/templates/city.html)
$genDir = Join-Path $src '.generated\cities'
if (Test-Path $genDir) { Remove-Item -Recurse -Force $genDir }
New-Item -ItemType Directory -Force $genDir | Out-Null
$cities = Read-Text (Join-Path $src 'data\cities.json') | ConvertFrom-Json
$cityTpl = Read-Text (Join-Path $src 'templates\city.html')
$byslug = @{}; foreach ($c in $cities) { $byslug[$c.slug] = $c }
foreach ($c in $cities) {
  $cv = @{}
  foreach ($p in $c.PSObject.Properties) { if ($p.Value -is [string]) { $cv["city.$($p.Name)"] = HtmlEnc $p.Value } }
  $cv['city.title'] = $c.title; $cv['city.description'] = $c.description   # raw: encoded later by the page pipeline
  $cv['city.intro_html'] = ($c.intro | ForEach-Object { "<p>$(HtmlEnc $_)</p>" }) -join "`n"
  $cv['city.considerations_html'] = ($c.considerations | ForEach-Object { "<div class=`"fact reveal`"><span class=`"icon-badge`"><sp-i $($_.icon)></span><h3>$(HtmlEnc $_.title)</h3><p>$(HtmlEnc $_.text)</p></div>" }) -join "`n"
  $cv['city.localities_html'] = ($c.localities | ForEach-Object { "<li>$(HtmlEnc $_)</li>" }) -join ''
  $cv['city.routes_html'] = ($c.routes | ForEach-Object { $o = $byslug[$_]; "<a href=`"/consultation?from=$($c.name)&amp;to=$($o.name)`">$($c.name) &rarr; $($o.name) <sp-i arrow></a>" }) -join "`n"
  $cv['city.others_html'] = ($cities | Where-Object { $_.slug -ne $c.slug } | ForEach-Object { "<li><a href=`"/cities/$($_.slug)`">Packers and movers in $($_.name)</a></li>" }) -join ''
  $first = $true
  $cv['city.faqs_html'] = ($c.faqs | ForEach-Object { $o = if ($first) { ' open' } else { '' }; $first = $false; "<details class=`"faq-item`"$o><summary>$(HtmlEnc $_.q)<sp-i chevron-down></summary><div class=`"faq-body`"><p>$(HtmlEnc $_.a)</p></div></details>" }) -join "`n"
  $cv['city.faq_ld'] = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[' + (($c.faqs | ForEach-Object { "{`"@type`":`"Question`",`"name`":$(JsonStr $_.q),`"acceptedAnswer`":{`"@type`":`"Answer`",`"text`":$(JsonStr $_.a)}}" }) -join ',') + ']}</script>'
  Write-Text (Join-Path $genDir "$($c.slug).html") (Expand-Tokens $cityTpl $cv)
}

# ---- pages
Build-Pages (Join-Path $src 'pages') $out 'site'
Build-Pages $genDir (Join-Path $out 'cities') 'site'
Build-Pages (Join-Path $src 'admin') (Join-Path $out 'admin') 'admin'

$xml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n" + ($sitemap -join "`n") + "`n</urlset>`n"
Write-Text (Join-Path $out 'sitemap.xml') $xml
Write-Host "sitemap.xml ($($sitemap.Count) urls)"
Write-Host 'Build complete.'
