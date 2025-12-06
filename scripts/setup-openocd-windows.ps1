# Setup OpenOCD for Windows
# Downloads xPack OpenOCD with all required DLLs

$ErrorActionPreference = "Stop"

Write-Host "Setting up OpenOCD for Windows..." -ForegroundColor Cyan

# xPack OpenOCD version
$version = "0.12.0-4"
$archiveName = "xpack-openocd-$version-win32-x64"
$downloadUrl = "https://github.com/xpack-dev-tools/openocd-xpack/releases/download/v$version/$archiveName.zip"
$tempZip = "$env:TEMP\$archiveName.zip"
$extractPath = "$env:TEMP\openocd-extract"
$targetPath = "embedded\openocd-binaries\windows"

Write-Host "1. Downloading OpenOCD $version..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
    Write-Host "   ✓ Downloaded successfully" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ Failed to download: $_" -ForegroundColor Red
    exit 1
}

Write-Host "2. Extracting archive..." -ForegroundColor Yellow
try {
    if (Test-Path $extractPath) {
        Remove-Item $extractPath -Recurse -Force
    }
    Expand-Archive -Path $tempZip -DestinationPath $extractPath -Force
    Write-Host "   ✓ Extracted successfully" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ Failed to extract: $_" -ForegroundColor Red
    exit 1
}

Write-Host "3. Backing up current installation..." -ForegroundColor Yellow
if (Test-Path $targetPath) {
    $backupPath = "$targetPath-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item $targetPath $backupPath -Force
    Write-Host "   ✓ Backed up to: $backupPath" -ForegroundColor Green
}

Write-Host "4. Installing new OpenOCD..." -ForegroundColor Yellow
try {
    $sourcePath = Get-ChildItem -Path $extractPath -Directory | Select-Object -First 1
    
    # Create target directory structure
    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    
    # Copy bin directory
    Copy-Item -Path "$($sourcePath.FullName)\bin" -Destination "$targetPath\bin" -Recurse -Force
    
    # Copy OpenOCD scripts
    if (Test-Path "$($sourcePath.FullName)\scripts") {
        New-Item -ItemType Directory -Path "$targetPath\openocd" -Force | Out-Null
        Copy-Item -Path "$($sourcePath.FullName)\scripts" -Destination "$targetPath\openocd\scripts" -Recurse -Force
    }
    elseif (Test-Path "$($sourcePath.FullName)\openocd\scripts") {
        Copy-Item -Path "$($sourcePath.FullName)\openocd" -Destination "$targetPath\openocd" -Recurse -Force
    }
    
    Write-Host "   ✓ Installed successfully" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ Failed to install: $_" -ForegroundColor Red
    exit 1
}

Write-Host "5. Cleaning up..." -ForegroundColor Yellow
Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "   ✓ Cleanup complete" -ForegroundColor Green

Write-Host ""
Write-Host "6. Verifying installation..." -ForegroundColor Yellow
$openocdExe = "$targetPath\bin\openocd.exe"
if (Test-Path $openocdExe) {
    try {
        $version = & $openocdExe --version 2>&1 | Select-String "Open On-Chip Debugger" | Select-Object -First 1
        Write-Host "   ✓ OpenOCD installed successfully!" -ForegroundColor Green
        Write-Host "   $version" -ForegroundColor Cyan
        
        # List DLLs
        $dlls = Get-ChildItem -Path "$targetPath\bin" -Filter "*.dll"
        Write-Host "   Found $($dlls.Count) DLL files" -ForegroundColor Cyan
        
    }
    catch {
        Write-Host "   ⚠ OpenOCD installed but test failed: $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "   ✗ OpenOCD.exe not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Setup completed successfully! 🎉" -ForegroundColor Green
Write-Host "You can now restart the application." -ForegroundColor Cyan
