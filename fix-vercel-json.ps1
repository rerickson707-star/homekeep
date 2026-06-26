# fix-vercel-json.ps1
# Run from: C:\Users\reric\homekeep

$json = '{
  "framework": "vite",
  "rewrites": [
    { "source": "/assets/(.*)", "destination": "/assets/$1" },
    { "source": "/guides", "destination": "/index.html" },
    { "source": "/blog/:slug", "destination": "/index.html" },
    { "source": "/sitemap.xml", "destination": "/sitemap.xml" },
    { "source": "/robots.txt", "destination": "/robots.txt" },
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ]
}'

[System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) "vercel.json"),
    $json,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "vercel.json rewritten. Contents:" -ForegroundColor Green
Get-Content "vercel.json"

git add vercel.json
git commit -m "fix vercel.json encoding"
git push
