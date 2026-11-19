# Publish the built website to GitHub for Hostinger.
#   powershell -ExecutionPolicy Bypass -File tools/publish.ps1 "Short description of the change"
#
# Branch layout:
#   source : the full project (src/, tools/, supabase/, README ...) — work here
#   main   : ONLY the contents of public_html/ at the repository root — Hostinger deploys this
#
# Steps: build -> commit + push 'source' -> create a 'main' commit from public_html/ -> push 'main'.
param([string]$Message = "Website update")
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

& powershell -NoProfile -ExecutionPolicy Bypass -File tools/build.ps1 | Out-Null
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -q -m $Message }
git push -q origin source

git fetch -q origin main
$tree = git rev-parse "HEAD:public_html"
$mainTree = git rev-parse "origin/main^{tree}"
if ($tree -eq $mainTree) { Write-Host "Website unchanged - nothing to deploy."; exit 0 }
$commit = git commit-tree $tree -p origin/main -m $Message
git push -q origin "${commit}:refs/heads/main"
Write-Host "Pushed to main ($($commit.Substring(0,7))). Now click Redeploy in Hostinger."
