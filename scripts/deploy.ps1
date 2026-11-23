# Checks, commits, pushes to GitHub, waits for the Pages deploy, then opens the live site.
# Usage:  npm.cmd run deploy -- "What changed"
param([string]$Message = "Update")

# 'Continue': git prints harmless warnings (e.g. line endings) to stderr; exit codes are checked explicitly.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot)

function Fail($text) { Write-Host "x $text" -ForegroundColor Red; exit 1 }
function Step($text) { Write-Host "> $text" -ForegroundColor Cyan }

# 1. Local checks: never publish a broken build.
Step 'Running tests and build'
npm.cmd test --silent; if ($LASTEXITCODE -ne 0) { Fail 'Tests failed, nothing was pushed.' }
npm.cmd run build --silent; if ($LASTEXITCODE -ne 0) { Fail 'Build failed, nothing was pushed.' }

# 2. Commit whatever changed (if anything).
git add -A
if (git status --porcelain) {
  Step "Committing: $Message"
  git commit -q -m $Message; if ($LASTEXITCODE -ne 0) { Fail 'Commit failed.' }
} else {
  Step 'No changes to commit'
}

# 3. Push.
Step 'Pushing to GitHub'
git push -q origin main; if ($LASTEXITCODE -ne 0) { Fail 'Push failed.' }
$sha = (git rev-parse HEAD).Trim()

# 4. Wait for the "Deploy to GitHub Pages" run of this commit.
$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'github\.com[/:]([^/]+)/([^/.]+)') { Fail "Can't read owner/repo from $remote" }
$owner = $Matches[1]; $repo = $Matches[2]
$api = "https://api.github.com/repos/$owner/$repo/actions/runs?head_sha=$sha"
$site = "https://$($owner.ToLower()).github.io/$repo/"

Step 'Waiting for the GitHub Pages deploy (usually 1-2 min)'
$deadline = (Get-Date).AddMinutes(10)
$run = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 10
  try { $runs = (Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'deploy-script' } -ErrorAction Stop).workflow_runs } catch { continue }
  $run = $runs | Where-Object { $_.name -eq 'Deploy to GitHub Pages' } | Select-Object -First 1
  if ($run -and $run.status -eq 'completed') { break }
  Write-Host '  ...' -NoNewline
}
Write-Host ''

if (-not $run -or $run.status -ne 'completed') { Fail "Timed out. Check the Actions tab: https://github.com/$owner/$repo/actions" }
if ($run.conclusion -ne 'success') { Fail "Deploy $($run.conclusion). Details: $($run.html_url)" }

# 5. Open the live site (the ?v= part skips the browser's cached copy).
Write-Host "Live: $site" -ForegroundColor Green
Start-Process "$site`?v=$($sha.Substring(0, 7))"
