# Schedule Memory Tasks in Windows Task Scheduler
# Run this script as Administrator to set up automatic memory consolidation

$scriptPath = $PSScriptRoot

# Task 1: Nightly Consolidation (3 AM)
$action1 = New-ScheduledTaskAction -Execute "node" -Argument "$scriptPath\consolidate.js" -WorkingDirectory $scriptPath
$trigger1 = New-ScheduledTaskTrigger -Daily -At 3am
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal1 = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName "OpenClaw-MemoryConsolidation" `
  -Action $action1 `
  -Trigger $trigger1 `
  -Settings $settings1 `
  -Principal $principal1 `
  -Description "Nightly memory consolidation for OpenClaw (3 AM)" `
  -Force

Write-Host "✅ Scheduled: Nightly Consolidation (3 AM)" -ForegroundColor Green

# Task 2: Weekly Meta-Learning (Sunday 4 AM)
$action2 = New-ScheduledTaskAction -Execute "node" -Argument "$scriptPath\meta-learn.js" -WorkingDirectory $scriptPath
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 4am
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal2 = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName "OpenClaw-MetaLearning" `
  -Action $action2 `
  -Trigger $trigger2 `
  -Settings $settings2 `
  -Principal $principal2 `
  -Description "Weekly meta-learning optimization for OpenClaw (Sunday 4 AM)" `
  -Force

Write-Host "✅ Scheduled: Weekly Meta-Learning (Sunday 4 AM)" -ForegroundColor Green

Write-Host "`n📅 Scheduled tasks created successfully!" -ForegroundColor Cyan
Write-Host "   - Memory Consolidation: Daily at 3 AM"
Write-Host "   - Meta-Learning: Sunday at 4 AM"
Write-Host "`nView tasks: taskschd.msc" -ForegroundColor Yellow
