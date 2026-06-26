# update-vercel-json.ps1
# Run from: C:\Users\reric\homekeep

$file = "vercel.json"
$content = Get-Content $file -Raw -Encoding UTF8

$old = '{ "source": "/blog/:slug", "destination": "/index.html" },'
$new = '{ "source": "/guides", "destination": "/index.html" },' + "`n    " + '{ "source": "/blog/:slug", "destination": "/index.html" },'

$updated = $content.Replace($old, $new)

if ($updated -eq $content) {
    Write-Host "No match found - printing current vercel.json for review:" -ForegroundColor Yellow
    Write-Host $content
} else {
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.Encoding]::UTF8)
    Write-Host "Updated vercel.json:" -ForegroundColor Green
    Get-Content $file
    git add vercel.json
    git commit -m "add /guides rewrite to vercel.json"
    git push
}
