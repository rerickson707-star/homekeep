# fix-warranty-icon.ps1
# Run from: C:\Users\reric\homekeep
# Adds the Steadwell logo icon to the warranty tracker nav

$file = "public\warranty-tracker\index.html"
$content = Get-Content $file -Raw -Encoding UTF8

# The icon SVG to inject - matches the logo exactly
$icon = '<span style="width:32px;height:32px;border-radius:9px;background:#234A3D;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle;margin-right:8px"><svg viewBox="0 0 48 48" fill="none" width="62%" height="62%"><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="18.3" r="1.5" fill="#D2876A"/></svg></span>'

# Print what the current brand/logo area looks like so we can confirm the match
Write-Host "=== Searching for brand/logo area ===" -ForegroundColor Cyan
$lines = $content -split "`n"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "Steadwell" -and $lines[$i] -match "nav|brand|logo|header") {
        Write-Host "Line $($i+1): $($lines[$i].Trim())" -ForegroundColor Yellow
    }
}

# Try common patterns for the wordmark in the nav
$patterns = @(
    '>Steadwell</a>',
    '>Steadwell</span>',
    '>Steadwell</',
    '"Steadwell"'
)

$matched = $false
foreach ($p in $patterns) {
    if ($content -match [regex]::Escape($p)) {
        $updated = $content.Replace($p, ">$icon`Steadwell$($p.Substring($p.IndexOf('<')))")
        if ($updated -ne $content) {
            [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
            Write-Host "Icon added before '$p'" -ForegroundColor Green
            $matched = $true
            git add public/warranty-tracker/index.html
            git commit -m "add logo icon to warranty tracker nav"
            git push
            break
        }
    }
}

if (-not $matched) {
    Write-Host "No match found. Paste the nav/header HTML here so we can target it precisely." -ForegroundColor Red
}
