# fix-warranty-duplicate-icon.ps1
# Run from: C:\Users\reric\homekeep
# Removes the duplicate SVG icon injected into nav-name span

$file = "public\warranty-tracker\index.html"
$content = Get-Content $file -Raw -Encoding UTF8

# Remove the entire injected span (SVG tile) from inside nav-name, leaving just "Steadwell"
# Pattern: <span class="nav-name"><span style="...">...</svg></span>Steadwell</span>
# Target: remove the inner <span>...</span> block, keep "Steadwell"

$updated = $content -replace '<span class="nav-name"><span style="[^"]*"[^>]*>.*?</span>', '<span class="nav-name">'

if ($updated -eq $content) {
    Write-Host "Regex didn't match - trying alternative..." -ForegroundColor Yellow
    # Try dotall match
    $updated = [regex]::Replace($content, 
        '<span class="nav-name"><span style=".+?</span>(?=Steadwell)', 
        '<span class="nav-name">', 
        [System.Text.RegularExpressions.RegexOptions]::Singleline)
}

if ($updated -eq $content) {
    Write-Host "No match found." -ForegroundColor Red
} else {
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Duplicate icon removed." -ForegroundColor Green
    
    # Verify
    $start = $updated.IndexOf('<span class="nav-name">')
    Write-Host "Nav-name now reads: $($updated.Substring($start, 60))" -ForegroundColor Cyan
    
    git add public/warranty-tracker/index.html
    git commit -m "remove duplicate icon from warranty tracker nav"
    git push
}
