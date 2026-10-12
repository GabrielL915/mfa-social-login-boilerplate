# Launcher do wizard de SSO pra PowerShell: roda setup-sso.sh no Git Bash.
# Uso:  .\backend\setup-sso.ps1
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
$script = Join-Path $PSScriptRoot "setup-sso.sh"
& $bash $script
