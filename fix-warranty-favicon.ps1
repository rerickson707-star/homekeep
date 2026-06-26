# fix-warranty-favicon.ps1
# Run from: C:\Users\reric\homekeep
# Adds favicon link to warranty tracker page

$file = "public\warranty-tracker\index.html"
$content = Get-Content $file -Raw -Encoding UTF8

$favicon = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'

if ($content -match 'rel="icon"') {
    Write-Host "Favicon already present - no change needed." -ForegroundColor Green
} else {
    $updated = $content.Replace('<meta charset="UTF-8">', "<meta charset=`"UTF-8`">`n$favicon")
    
    if ($updated -eq $content) {
        Write-Host "No match found for insertion point." -ForegroundColor Red
    } else {
        [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
        Write-Host "Favicon added." -ForegroundColor Green
        git add public/warranty-tracker/index.html
        git commit -m "add favicon to warranty tracker page"
        git push
    }
}
