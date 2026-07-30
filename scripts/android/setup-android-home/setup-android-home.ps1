<#
.SYNOPSIS
    Locates the Android SDK and persists ANDROID_HOME for the current Windows user.

.DESCRIPTION
    AGP resolves the SDK from `sdk.dir` in local.properties first, then falls back
    to ANDROID_HOME. local.properties is gitignored and per-project, so ANDROID_HOME
    is the only setting that makes a fresh clone build with no per-project setup.

    Non-Windows developers should use setup-android-home.sh instead.
#>

$ErrorActionPreference = "Stop"

function Find-Sdk {
    # An existing value wins, but only if it actually points at an SDK.
    $candidates = @(
        [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User"),
        $env:ANDROID_HOME,
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
    Write-Host "error: could not find an Android SDK." -ForegroundColor Red
    Write-Host "Looked for a directory containing platform-tools\ at:"
    Write-Host "  `$env:ANDROID_HOME, `$env:ANDROID_SDK_ROOT, $env:LOCALAPPDATA\Android\Sdk"
    Write-Host ""
    Write-Host "Install it via Android Studio (SDK Manager), then re-run this script."
    exit 1
}

Write-Host "Found Android SDK: $sdk"

[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")
Write-Host "Persisted ANDROID_HOME to the Windows user environment."

# Keep the current session usable without a restart.
$env:ANDROID_HOME = $sdk

Write-Host ""
Write-Host "Note: Windows hands the new value only to processes started AFTER this point."
Write-Host "Already-running shells (and their children) keep the old environment, so"
Write-Host "restart your terminal -- or for one-off use in an existing shell:"
Write-Host "  `$env:ANDROID_HOME = `"$sdk`""
Write-Host ""
Write-Host "Done. Verify in a NEW shell with: echo `$env:ANDROID_HOME"
