# Prepares web logo files from the official logo artwork (source/logo/shiftingpartner-logo.webp).
# - logo.png            : official logo, trimmed, white background made transparent (colours untouched)
# - logo-header.png     : same artwork without the tagline line (for small header sizes, as in the UI reference)
# - logo-header-light.png : reversed version for dark backgrounds (navy -> white, orange untouched), as shown in the UI reference
# - icon-512.png / icon-192.png / apple-touch-icon.png / favicon-32.png : the "S" box mark
# Replace these with official exports from your designer whenever available.
param([string]$Src = (Join-Path $PSScriptRoot '..\source\logo\shiftingpartner-logo.webp'),
      [string]$Out = (Join-Path $PSScriptRoot '..\public_html\assets\logo'))
Add-Type -AssemblyName PresentationCore, WindowsBase
New-Item -ItemType Directory -Force $Out | Out-Null
$fs = [IO.File]::OpenRead((Resolve-Path $Src))
$frame = [Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'None', 'OnLoad').Frames[0]
$fs.Close()
$conv = New-Object Windows.Media.Imaging.FormatConvertedBitmap($frame, [Windows.Media.PixelFormats]::Bgra32, $null, 0)
$W = $conv.PixelWidth; $H = $conv.PixelHeight; $stride = $W * 4
$px = New-Object byte[] ($stride * $H)
$conv.CopyPixels($px, $stride, 0)

# 1) Un-mix white background into alpha
for ($i = 0; $i -lt $px.Length; $i += 4) {
  $b = $px[$i]; $g = $px[$i+1]; $r = $px[$i+2]
  $mn = [Math]::Min($r, [Math]::Min($g, $b))
  $a = [Math]::Min(1.0, (255 - $mn) / 215.0)
  if ($a -le 0.02) { $px[$i]=0; $px[$i+1]=0; $px[$i+2]=0; $px[$i+3]=0; continue }
  $k = (1 - $a) * 255
  $px[$i]   = [byte][Math]::Max(0, [Math]::Min(255, ($b - $k) / $a))
  $px[$i+1] = [byte][Math]::Max(0, [Math]::Min(255, ($g - $k) / $a))
  $px[$i+2] = [byte][Math]::Max(0, [Math]::Min(255, ($r - $k) / $a))
  $px[$i+3] = [byte]([Math]::Round($a * 255))
}

function Get-BBox($buf, $x0, $y0, $x1, $y1) {
  $minX = $x1; $minY = $y1; $maxX = $x0; $maxY = $y0
  for ($y = $y0; $y -lt $y1; $y++) { for ($x = $x0; $x -lt $x1; $x++) {
    if ($buf[($y * $stride) + $x * 4 + 3] -gt 20) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } } } }
  return @($minX, $minY, ($maxX + 1), ($maxY + 1))
}
function Save-Crop($buf, $bb, $path, [int]$pad = 4, [int]$targetW = 0) {
  $x0 = [Math]::Max(0, $bb[0] - $pad); $y0 = [Math]::Max(0, $bb[1] - $pad)
  $x1 = [Math]::Min($W, $bb[2] + $pad); $y1 = [Math]::Min($H, $bb[3] + $pad)
  $cw = $x1 - $x0; $ch = $y1 - $y0
  $src = [Windows.Media.Imaging.BitmapSource]::Create($W, $H, 96, 96, [Windows.Media.PixelFormats]::Bgra32, $null, $buf, $stride)
  $bmp = New-Object Windows.Media.Imaging.CroppedBitmap($src, (New-Object Windows.Int32Rect($x0, $y0, $cw, $ch)))
  if ($targetW -gt 0) {
    $s = $targetW / [double]$cw
    $bmp = New-Object Windows.Media.Imaging.TransformedBitmap($bmp, (New-Object Windows.Media.ScaleTransform($s, $s)))
  }
  $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bmp))
  $f = [IO.File]::Create($path); $enc.Save($f); $f.Close()
  Write-Host "wrote $path"
}
function Save-Square($buf, $bb, $path, [int]$size, [double]$padRatio = 0.12) {
  $cw = $bb[2] - $bb[0]; $ch = $bb[3] - $bb[1]; $side = [int]([Math]::Max($cw, $ch) * (1 + 2 * $padRatio))
  $sq = New-Object byte[] ($side * $side * 4)
  $ox = [int](($side - $cw) / 2); $oy = [int](($side - $ch) / 2)
  for ($y = 0; $y -lt $ch; $y++) { [Array]::Copy($buf, (($bb[1] + $y) * $stride) + $bb[0] * 4, $sq, (($oy + $y) * $side + $ox) * 4, $cw * 4) }
  $src = [Windows.Media.Imaging.BitmapSource]::Create($side, $side, 96, 96, [Windows.Media.PixelFormats]::Bgra32, $null, $sq, $side * 4)
  $s = $size / [double]$side
  $bmp = New-Object Windows.Media.Imaging.TransformedBitmap($src, (New-Object Windows.Media.ScaleTransform($s, $s)))
  $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bmp))
  $f = [IO.File]::Create($path); $enc.Save($f); $f.Close(); Write-Host "wrote $path"
}

$full = Get-BBox $px 0 0 $W $H
Save-Crop $px $full (Join-Path $Out 'logo.png') 6 900

# Locate the tagline: the text block right of the divider; tagline starts below the wordmark's lowest dense row.
$divX = 600
$hdr = $px.Clone()
# rows in the right-hand text area that contain ink
$rows = @(); for ($y = 0; $y -lt $H; $y++) { $ink = $false; for ($x = $divX + 20; $x -lt $W; $x += 2) { if ($px[$y*$stride + $x*4 + 3] -gt 60) { $ink = $true; break } }; $rows += $ink }
# find the gap between the wordmark and tagline (first empty run after the wordmark starts)
$start = [Array]::IndexOf($rows, $true); $y = $start; while ($y -lt $H -and $rows[$y]) { $y++ }
# descenders of "g" may create small gaps; walk forward over gaps shorter than 6px
while ($true) { $g = $y; while ($g -lt $H -and -not $rows[$g]) { $g++ }; if ($g - $y -lt 6 -and $g -lt $H) { $y = $g; while ($y -lt $H -and $rows[$y]) { $y++ } } else { break } }
$tagTop = $y
for ($yy = $tagTop; $yy -lt $H; $yy++) { for ($x = $divX - 30; $x -lt $W; $x++) { $o = $yy*$stride + $x*4; if ($x -gt $divX - 30 -and $x -lt $divX + 10) { continue }; $hdr[$o+3] = 0 } }
# trim the divider line height to the wordmark area as well
$hb = Get-BBox $hdr 0 0 $W $H
Save-Crop $hdr $hb (Join-Path $Out 'logo-header.png') 4 720

# Reversed (light) version: navy-ish pixels (blue >= red) -> white, keep alpha; orange stays.
$light = $hdr.Clone()
for ($i = 0; $i -lt $light.Length; $i += 4) {
  if ($light[$i+3] -eq 0) { continue }
  if ($light[$i] -ge $light[$i+2]) { $light[$i] = 255; $light[$i+1] = 255; $light[$i+2] = 255 }
}
Save-Crop $light $hb (Join-Path $Out 'logo-header-light.png') 4 720
$fullLight = $px.Clone()
for ($i = 0; $i -lt $fullLight.Length; $i += 4) { if ($fullLight[$i+3] -ne 0 -and $fullLight[$i] -ge $fullLight[$i+2]) { $fullLight[$i]=255; $fullLight[$i+1]=255; $fullLight[$i+2]=255 } }
Save-Crop $fullLight $full (Join-Path $Out 'logo-light.png') 6 900

# Icon mark: everything left of the divider
$mb = Get-BBox $px 0 0 ($divX - 40) $H
Save-Square $px $mb (Join-Path $Out 'icon-512.png') 512
Save-Square $px $mb (Join-Path $Out 'icon-192.png') 192
Save-Square $px $mb (Join-Path $Out 'apple-touch-icon.png') 180
Save-Square $px $mb (Join-Path $Out 'favicon-32.png') 32 0.04
Write-Host "tagline cut at y=$tagTop"
