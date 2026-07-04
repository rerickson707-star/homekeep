# Steadwell - Locate the warranty-tracker landing page source
# Run from: C:\Users\reric\homekeep
# Usage:    .\find-warranty-page.ps1

Write-Host ""
Write-Host "Searching repo for unique text from the live warranty-tracker page..." -ForegroundColor Cyan
Write-Host ""

$searchTerms = @(
    "Free Warranty Tracker",
    "Track Any Warranty",
    "4.99",
    "9.99"
)

$excludeDirs = @("node_modules", ".git", ".vercel", "dist", "build")

# Build the exclude pattern for Get-ChildItem
$allFiles = Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $path = $_.FullName
    -not ($excludeDirs | Where-Object { $path -match [regex]::Escape("\$_\") })
}

Write-Host "Scanning $($allFiles.Count) files (excluding node_modules, .git, dist, build)..." -ForegroundColor DarkGray
Write-Host ""

foreach ($term in $searchTerms) {
    Write-Host "=== Searching for: '$term' ===" -ForegroundColor Yellow
    $matches = $allFiles | Select-String -Pattern $term -SimpleMatch -ErrorAction SilentlyContinue
    if ($matches) {
        $matches | Group-Object Path | ForEach-Object {
            Write-Host "  FOUND in: $($_.Name)" -ForegroundColor Green
        }
    } else {
        Write-Host "  (no matches)" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# Also check vercel.json for rewrites/redirects related to warranty-tracker
Write-Host "=== Checking vercel.json for rewrites/redirects ===" -ForegroundColor Yellow
if (Test-Path "vercel.json") {
    $vercelContent = Get-Content "vercel.json" -Raw
    if ($vercelContent -match "warranty") {
        Write-Host "  vercel.json contains a warranty-related rule:" -ForegroundColor Green
        Get-Content "vercel.json" | Select-String -Pattern "warranty" -Context 2,2
    } else {
        Write-Host "  No warranty-related rules found in vercel.json" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  No vercel.json found in this directory" -ForegroundColor DarkGray
}
Write-Host ""

# List what's in the public folder, since static HTML pages often live there
Write-Host "=== Contents of public/ folder (if it exists) ===" -ForegroundColor Yellow
if (Test-Path "public") {
    Get-ChildItem -Path "public" -Recurse -File | Select-Object -ExpandProperty FullName
} else {
    Write-Host "  No public/ folder found in this directory" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "-----------------------------------------------" -ForegroundColor DarkGray
Write-Host "Done. Paste whatever this printed back into the chat." -ForegroundColor White
