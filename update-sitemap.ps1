# update-sitemap.ps1
# Run from: C:\Users\reric\homekeep

$file = "public\sitemap.xml"
$content = Get-Content $file -Raw -Encoding UTF8

# Check if /guides is already there
if ($content -match "/guides") {
    Write-Host "Guides already in sitemap - no change needed." -ForegroundColor Green
    exit
}

# Insert /guides entry before the closing </urlset> tag
$guidesEntry = @"
  <url>
    <loc>https://www.trysteadwell.app/guides</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
"@

$updated = $content.Replace("</urlset>", $guidesEntry + "</urlset>")

if ($updated -eq $content) {
    Write-Host "Could not find closing </urlset> tag - printing sitemap for review:" -ForegroundColor Yellow
    Write-Host $content
} else {
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.Encoding]::UTF8)
    Write-Host "Sitemap updated." -ForegroundColor Green
    Get-Content $file
    git add public\sitemap.xml
    git commit -m "add /guides to sitemap"
    git push
}
