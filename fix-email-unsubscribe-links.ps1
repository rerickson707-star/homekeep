# fix-email-unsubscribe-links.ps1
# Run from: C:\Users\reric\homekeep
# Adds user-specific unsubscribe token to warranty-alerts, weekly-digest, task-reminders

$results = @()

# ── 1. warranty-alerts ──────────────────────────────────────────────────────
$file = "supabase\functions\warranty-alerts\index.ts"
$content = Get-Content $file -Raw -Encoding UTF8
$old = '<a href="${APP_URL}/unsubscribe" style="color:#A8A09A;text-decoration:none;">Unsubscribe</a>'
$new = '<a href="${APP_URL}/unsubscribe?token=${userId}" style="color:#A8A09A;text-decoration:none;">Unsubscribe</a>'
if ($content -match [regex]::Escape($old)) {
    $updated = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    $results += "warranty-alerts: updated"
} else {
    $results += "warranty-alerts: no match found"
}

# ── 2. weekly-digest ─────────────────────────────────────────────────────────
$file = "supabase\functions\weekly-digest\index.ts"
$content = Get-Content $file -Raw -Encoding UTF8
$old = '<p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>'
$new = '<p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a> · <a href="https://www.trysteadwell.app/unsubscribe?token=${userId}" style="color:#A8A09A;">Unsubscribe</a></p>'
if ($content -match [regex]::Escape($old)) {
    $updated = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    $results += "weekly-digest: updated"
} else {
    $results += "weekly-digest: no match found"
}

# ── 3. task-reminders ────────────────────────────────────────────────────────
$file = "supabase\functions\task-reminders\index.ts"
$content = Get-Content $file -Raw -Encoding UTF8
$old = '<p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>'
$new = '<p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a> · <a href="https://www.trysteadwell.app/unsubscribe?token=${userId}" style="color:#A8A09A;">Unsubscribe</a></p>'
if ($content -match [regex]::Escape($old)) {
    $updated = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    $results += "task-reminders: updated"
} else {
    $results += "task-reminders: no match found"
}

# ── Print results ─────────────────────────────────────────────────────────────
foreach ($r in $results) { Write-Host $r -ForegroundColor $(if ($r -match "updated") { "Green" } else { "Yellow" }) }

# ── Deploy all three ──────────────────────────────────────────────────────────
Write-Host "`nDeploying..." -ForegroundColor Cyan
npx supabase functions deploy warranty-alerts --no-verify-jwt
npx supabase functions deploy weekly-digest --no-verify-jwt
npx supabase functions deploy task-reminders --no-verify-jwt
Write-Host "Done." -ForegroundColor Green
