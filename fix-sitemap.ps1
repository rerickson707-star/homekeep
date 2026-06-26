# fix-sitemap.ps1
# Run from: C:\Users\reric\homekeep

$sitemap = @'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Core pages -->
  <url>
    <loc>https://www.trysteadwell.app/</loc>
    <lastmod>2026-06-18</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/guides</loc>
    <lastmod>2026-06-22</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/warranty-tracker</loc>
    <lastmod>2026-06-18</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog</loc>
    <lastmod>2026-06-22</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/terms</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/privacy</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/ada</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.3</priority>
  </url>

  <!-- Blog posts -->
  <url>
    <loc>https://www.trysteadwell.app/blog/hvac-maintenance-schedule</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/find-appliance-serial-number</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/cost-of-deferred-maintenance</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/how-old-is-my-water-heater</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/steadwell-vs-homezada</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/steadwell-vs-homebinder</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/centriq-alternative</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/home-maintenance-checklist</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/what-does-a-home-warranty-cover</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/how-to-find-age-of-house</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.trysteadwell.app/blog/roof-lifespan-when-to-replace</loc>
    <lastmod>2026-06-01</lastmod>
    <priority>0.7</priority>
  </url>

</urlset>
'@

[System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) "public\sitemap.xml"),
    $sitemap,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Sitemap updated." -ForegroundColor Green
git add public/sitemap.xml
git commit -m "fix sitemap - add blog index, guides lastmod, proper closing tag"
git push
