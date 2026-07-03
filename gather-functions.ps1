# ─────────────────────────────────────────────────────────────────────────────
# Steadwell — Gather Edge Function Source
# Run from: C:\Users\reric\homekeep
# Usage:    .\gather-functions.ps1
# Combines all remaining edge function files into one text file so you only
# need to paste/upload once instead of one at a time.
# ─────────────────────────────────────────────────────────────────────────────

$FunctionNames = @(
    "warranty-alerts",
    "weekly-digest",
    "task-reminders",
    "affiliate-application",
    "drip-day3",
    "drip-day5",
    "drip-day7",
    "drip-day10",
    "drip-day14"
)

$OutputFile = "C:\Users\reric\Downloads\steadwell-edge-functions-combined.txt"
$FunctionsDir = "C:\Users\reric\homekeep\supabase\functions"

# Clear/create the output file
"" | Out-File -FilePath $OutputFile -Encoding utf8

$found = @()
$missing = @()

foreach ($name in $FunctionNames) {
    $filePath = Join-Path $FunctionsDir "$name\index.ts"

    "=================================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "FUNCTION: $name" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "=================================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8

    if (Test-Path $filePath) {
        Get-Content $filePath -Raw | Out-File -FilePath $OutputFile -Append -Encoding utf8
        $found += $name
        Write-Host "  Found:   $name" -ForegroundColor Green
    } else {
        "(file not found at $filePath)" | Out-File -FilePath $OutputFile -Append -Encoding utf8
        $missing += $name
        Write-Host "  Missing: $name" -ForegroundColor Yellow
    }

    "" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "" | Out-File -FilePath $OutputFile -Append -Encoding utf8
}

Write-Host ""
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Found $($found.Count) of $($FunctionNames.Count) functions" -ForegroundColor White
if ($missing.Count -gt 0) {
    Write-Host "  Missing: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "  (these may not exist locally — check Supabase dashboard if needed)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Combined file written to:" -ForegroundColor White
Write-Host "  $OutputFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Upload that single file to the chat, or open it and paste the contents." -ForegroundColor White
