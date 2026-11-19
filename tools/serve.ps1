# Minimal local static server for previewing public_html on Windows (no Node/PHP needed).
# Usage: powershell -ExecutionPolicy Bypass -File tools/serve.ps1 [-Port 8080]
# Note: Apache .htaccess rewrites and PHP (blog/post.php) do not run here; use Hostinger or XAMPP for those.
param([int]$Port = 8080, [string]$Root = (Join-Path $PSScriptRoot '..\public_html'))
$Root = (Resolve-Path $Root).Path
$mime = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
  '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.svg'='image/svg+xml';
  '.ico'='image/x-icon'; '.xml'='application/xml'; '.txt'='text/plain'; '.webmanifest'='application/manifest+json' }
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    # Folder without trailing slash (e.g. /admin) -> redirect to /admin/ like Apache does
    $asDir = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
    if (-not $path.EndsWith('/') -and (Test-Path $asDir -PathType Container) -and (Test-Path (Join-Path $asDir 'index.html'))) {
      $ctx.Response.StatusCode = 301
      $ctx.Response.RedirectLocation = $path + '/' + $ctx.Request.Url.Query
      continue   # the finally block closes the response
    }
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
    # Emulate .htaccess: /blog/<slug> -> blog-details.html, extensionless -> .html
    if (-not (Test-Path $file -PathType Leaf)) {
      if ($path -match '^/blog/[a-z0-9-]+(\.html)?$') { $file = Join-Path $Root 'blog-details.html' }
      elseif (Test-Path "$file.html" -PathType Leaf) { $file = "$file.html" }
    }
    if ($file.StartsWith($Root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file); $ctx.Response.StatusCode = 200
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
    } else {
      $bytes = [IO.File]::ReadAllBytes((Join-Path $Root '404.html')); $ctx.Response.StatusCode = 404
      $ctx.Response.ContentType = 'text/html; charset=utf-8'
    }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { $ctx.Response.StatusCode = 500 } finally { $ctx.Response.Close() }
}
