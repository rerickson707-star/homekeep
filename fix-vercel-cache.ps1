# fix-vercel-cache.ps1
# Run from: C:\Users\reric\homekeep
# Adds no-cache header for index.html to prevent stale asset references

$json = '{
  "framework": "vite",
  "rewrites": [
    { "source": "/assets/(.*)", "destination": "/assets/$1" },
    { "source": "/guides", "destination": "/index.html" },
    { "source": "/blog/:slug", "destination": "/index.html" },
    { "source": "/sitemap.xml", "destination": "/sitemap.xml" },
    { "source": "/robots.txt", "destination": "/robots.txt" },
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Pragma", "value": "no-cache" },
        { "key": "Expires", "value": "0" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}'

[System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) "vercel.json"),
    $json,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "vercel.json updated with cache headers." -ForegroundColor Green
Get-Content "vercel.json"
git add vercel.json
git commit -m "add cache-control headers - no-cache for index.html, immutable for assets"
git push
