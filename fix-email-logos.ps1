# fix-email-logos.ps1
# Run from: C:\Users\reric\homekeep

$CORRECT_22 = '<svg viewBox="0 0 48 48" fill="none" width="22" height="22">
            <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
          </svg>'

$CORRECT_19 = '<svg viewBox="0 0 48 48" fill="none" width="19" height="19">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>'

$CORRECT_20 = '<svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>'

$OLD_22 = '<svg viewBox="0 0 48 48" fill="none" width="22" height="22">
            <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          </svg>'

$OLD_19 = '<svg viewBox="0 0 48 48" fill="none" width="19" height="19">
          <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        </svg>'

$OLD_20 = '<svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        </svg>'

function Fix-File($path, $old, $new, $label) {
  $c = Get-Content $path -Raw -Encoding UTF8
  if ($c.Contains($old)) {
    $c = $c.Replace($old, $new)
    [System.IO.File]::WriteAllText((Resolve-Path $path), $c, [System.Text.UTF8Encoding]::new($false))
    Write-Host "$label fixed" -ForegroundColor Green
  } else {
    Write-Host "$label SVG not matched" -ForegroundColor Yellow
  }
}

# welcome-email: fix SVG + tile color
$f = "supabase\functions\welcome-email\index.ts"
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c.Replace($OLD_22, $CORRECT_22)
$c = $c.Replace('background: #C16140; border-radius: 10px;', 'background: #234A3D; border-radius: 9px;')
[System.IO.File]::WriteAllText((Resolve-Path $f), $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "welcome-email: done" -ForegroundColor Green

Fix-File "supabase\functions\warranty-alerts\index.ts" $OLD_19 $CORRECT_19 "warranty-alerts"
Fix-File "supabase\functions\weekly-digest\index.ts"   $OLD_20 $CORRECT_20 "weekly-digest"
Fix-File "supabase\functions\task-reminders\index.ts"  $OLD_19 $CORRECT_19 "task-reminders"

Write-Host ""
Write-Host "Deploying..." -ForegroundColor Cyan
npx supabase functions deploy welcome-email --no-verify-jwt
npx supabase functions deploy warranty-alerts --no-verify-jwt
npx supabase functions deploy weekly-digest --no-verify-jwt
npx supabase functions deploy task-reminders --no-verify-jwt
Write-Host "All done." -ForegroundColor Green
