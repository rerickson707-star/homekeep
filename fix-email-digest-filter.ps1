# fix-email-digest-filter.ps1
# Run from: C:\Users\reric\homekeep
# Adds email_digest filter to weekly-digest and task-reminders
# so users who have unsubscribed don't receive these emails

$results = @()

# ── 1. weekly-digest ─────────────────────────────────────────────────────────
$file = "supabase\functions\weekly-digest\index.ts"
$content = Get-Content $file -Raw -Encoding UTF8

$old = 'const { data: profiles } = await supabase.from("profiles").select("user_id, name");'
$new = 'const { data: profiles } = await supabase.from("profiles").select("user_id, name").neq("email_digest", false);'

if ($content.Contains($old)) {
    $updated = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    $results += "weekly-digest: updated"
} else {
    $results += "weekly-digest: no match found"
}

# ── 2. task-reminders ────────────────────────────────────────────────────────
$file = "supabase\functions\task-reminders\index.ts"
$content = Get-Content $file -Raw -Encoding UTF8

$old = 'const { data: profiles } = await supabase.from("profiles").select("user_id, name");'
$new = 'const { data: profiles } = await supabase.from("profiles").select("user_id, name").neq("email_digest", false);'

if ($content.Contains($old)) {
    $updated = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $updated, [System.Text.UTF8Encoding]::new($false))
    $results += "task-reminders: updated"
} else {
    $results += "task-reminders: no match found"
}

# ── Print results ─────────────────────────────────────────────────────────────
foreach ($r in $results) {
    Write-Host $r -ForegroundColor $(if ($r -match "updated") { "Green" } else { "Yellow" })
}

# ── Deploy both ───────────────────────────────────────────────────────────────
Write-Host "`nDeploying..." -ForegroundColor Cyan
npx supabase functions deploy weekly-digest --no-verify-jwt
npx supabase functions deploy task-reminders --no-verify-jwt
Write-Host "Done." -ForegroundColor Green
