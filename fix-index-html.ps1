# fix-index-html.ps1
# Run from: C:\Users\reric\homekeep
# Removes the hardcoded built asset tags from index.html
# Vite injects these automatically at build time - they must NOT be in the source file

$html = '<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#234A3D">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Steadwell">
    <title>Steadwell — Home Management App | Track Maintenance, Warranties & Costs</title>
    <meta name="description" content="Steadwell is the home management app that tracks maintenance schedules, appliance warranties, repair costs, and documents — all in one place. Free to start, setup in 3 minutes.">
    <meta name="keywords" content="home maintenance app, home management software, appliance warranty tracker, home maintenance tracker, HomeZada alternative">
    <link rel="canonical" href="https://www.trysteadwell.app/">
    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.trysteadwell.app/">
    <meta property="og:title" content="Steadwell — Your home, kept well.">
    <meta property="og:description" content="Track maintenance, warranties, costs, and documents for your home. Type your address and Steadwell fills in the rest.">
    <meta property="og:image" content="https://www.trysteadwell.app/og-image.png">
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Steadwell — Your home, kept well.">
    <meta name="twitter:description" content="Home management app that tracks maintenance, warranties, and costs. Free to start.">
    <!-- Structured data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Steadwell",
      "applicationCategory": "HomeAndGardenApplication",
      "operatingSystem": "Web, iOS, Android",
      "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
      "description": "Home management software for tracking maintenance, warranties, costs, and documents.",
      "url": "https://www.trysteadwell.app"
    }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>'

[System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) "index.html"),
    $html,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "index.html restored to correct Vite source format." -ForegroundColor Green
git add index.html
git commit -m "fix index.html - remove hardcoded built asset tags, restore Vite source format"
git push
