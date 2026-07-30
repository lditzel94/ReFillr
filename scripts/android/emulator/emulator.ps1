<#
.SYNOPSIS
    Start / stop / inspect Android emulators without hunting for SDK paths.

.DESCRIPTION
    Windows-native counterpart to emulator.sh.

.EXAMPLE
    .\scripts\android\emulator\emulator.ps1 list
    .\scripts\android\emulator\emulator.ps1 start Pixel_2
    .\scripts\android\emulator\emulator.ps1 status
    .\scripts\android\emulator\emulator.ps1 stop
#>

param(
    [ValidateSet("list", "start", "status", "stop")]
    [string]$Command = "start",

    [string]$Avd
)

$ErrorActionPreference = "Stop"

function Find-Sdk {
    $candidates = @(
        $env:ANDROID_HOME,
        [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User"),
        $env:ANDROID_SDK_ROOT,
        "$env:LOCALAPPDATA\Android\Sdk"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "platform-tools"))) { return $c }
    }
    return $null
}

$sdk = Find-Sdk
if (-not $sdk) {
    Write-Host "error: Android SDK not found." -ForegroundColor Red
    Write-Host "Run .\scripts\android\setup-android-home\setup-android-home.ps1 first."
    exit 1
}

$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"

if (-not (Test-Path $adb)) { Write-Host "error: adb not found at $adb" -ForegroundColor Red; exit 1 }

# Runs adb and returns its output as text, tolerating expected failures.
#
# Windows PowerShell 5.1 wraps a native executable's stderr in ErrorRecords when
# it is redirected. With $ErrorActionPreference = "Stop" that turns adb's routine
# "no devices/emulators found" -- which is the normal state while an emulator is
# still starting -- into a terminating error that kills the script. Dropping to
# "Continue" for the call and capturing both streams keeps it non-fatal and quiet.
function Invoke-AdbQuiet {
    param([string[]]$AdbArgs)

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $adb @AdbArgs 2>&1 | Out-String
    }
    catch {
        $output = ""
    }
    finally {
        $ErrorActionPreference = $previous
    }
    return $output
}

function Get-Avds {
    if (-not (Test-Path $emulator)) {
        Write-Host "error: emulator not found at $emulator" -ForegroundColor Red
        exit 1
    }
    @(& $emulator -list-avds | Where-Object { $_.Trim() -ne "" })
}

function Invoke-List {
    $avds = Get-Avds
    if ($avds.Count -eq 0) {
        Write-Host "No AVDs defined."
        Write-Host ""
        Write-Host "Create one in Android Studio: Device Manager > Create Virtual Device."
        Write-Host "On a small laptop screen prefer a 16:9 profile (Pixel 2, Nexus 5) over"
        Write-Host "the 20:9 Pixel 6/7/8 family, which eats the full window height."
        return
    }
    Write-Host "Available AVDs:"
    $avds | ForEach-Object { "  $_" }
}

function Invoke-Start {
    $avds = Get-Avds
    if ($avds.Count -eq 0) { Invoke-List; exit 1 }

    if (-not $Avd) {
        $Avd = $avds[0]
        Write-Host "No AVD named; using first available: $Avd"
    }
    elseif ($avds -notcontains $Avd) {
        Write-Host "error: no AVD named '$Avd'." -ForegroundColor Red
        $avds | ForEach-Object { "  $_" }
        exit 1
    }

    Write-Host "Starting $Avd (detached)..."
    # Start-Process gives a process independent of this shell, so the emulator
    # survives the script exiting.
    Start-Process -FilePath $emulator -ArgumentList "-avd", $Avd -WindowStyle Minimized

    # Deliberately NOT using `adb wait-for-device`: it returns immediately for a
    # stale entry left behind by an emulator that was just killed, so a
    # stop-then-start cycle would sail past it and then hang. Polling
    # sys.boot_completed is the only signal that means the device is truly usable.
    Write-Host "Waiting for boot to complete..."
    $deadline = (Get-Date).AddMinutes(5)
    while ((Get-Date) -lt $deadline) {
        $booted = Invoke-AdbQuiet @("shell", "getprop", "sys.boot_completed")
        if ("$booted".Trim() -eq "1") {
            Write-Host "Boot complete."
            & $adb devices
            return
        }
        Start-Sleep -Seconds 3
    }

    Write-Host "error: timed out after 5 minutes waiting for boot." -ForegroundColor Red
    exit 1
}

function Invoke-Status { & $adb devices -l }

function Invoke-Stop {
    $devices = @(& $adb devices | Select-String "^emulator-" | ForEach-Object { ($_ -split "\s+")[0] })
    if ($devices.Count -eq 0) { Write-Host "No running emulators."; return }
    foreach ($d in $devices) {
        Write-Host "Stopping $d..."
        & $adb -s $d emu kill
    }

    # Block until they are really gone. `emu kill` returns as soon as the command
    # is delivered, but the AVD lock is held until the process exits -- starting a
    # new emulator before then fails.
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $still = @(& $adb devices | Select-String "^emulator-")
        if ($still.Count -eq 0) { Write-Host "Stopped."; return }
        Start-Sleep -Seconds 2
    }
    Write-Host "warning: emulator still listed after 60s; a restart may fail." -ForegroundColor Yellow
}

switch ($Command) {
    "list" { Invoke-List }
    "start" { Invoke-Start }
    "status" { Invoke-Status }
    "stop" { Invoke-Stop }
}
