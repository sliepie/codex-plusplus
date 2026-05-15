$ErrorActionPreference = "Stop"

if (Get-Command codexplusplus -ErrorAction SilentlyContinue) {
  & codexplusplus update @args
  exit $LASTEXITCODE
}

if (Get-Command codex-plusplus -ErrorAction SilentlyContinue) {
  & codex-plusplus update @args
  exit $LASTEXITCODE
}

[Console]::Error.WriteLine("[!] codexplusplus is not installed in PATH; running the installer instead.")
$Installer = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-plusplus-install." + [System.Guid]::NewGuid().ToString("N") + ".ps1")

try {
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/b-nnett/codex-plusplus/main/install.ps1" -OutFile $Installer -UseBasicParsing
  & $Installer @args
  exit $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $Installer -Force -ErrorAction SilentlyContinue
}
