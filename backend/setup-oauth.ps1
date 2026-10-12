# Launcher do wizard pra PowerShell: roda setup-oauth.sh no Git Bash.
# Uso:  .\backend\setup-oauth.ps1
$candidates = @(
  "$env:ProgramFiles\Git\bin\bash.exe",
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)
$bash = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash) {
  Write-Host "Git Bash nao encontrado. Instale com: winget install Git.Git" -ForegroundColor Red
  exit 1
}
$script = Join-Path $PSScriptRoot "setup-oauth.sh"
& $bash $script
