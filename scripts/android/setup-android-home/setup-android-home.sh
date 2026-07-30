#!/usr/bin/env bash
# Locates the Android SDK and persists ANDROID_HOME for this machine.
# Works on macOS, Linux, and Windows (Git Bash / MSYS).
#
# Why this exists: AGP resolves the SDK from `sdk.dir` in local.properties first,
# then falls back to ANDROID_HOME. local.properties is gitignored and per-project,
# so ANDROID_HOME is the only setting that makes a fresh clone build with no setup.

set -euo pipefail

os_name() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux) echo "linux" ;;
    MINGW* | MSYS* | CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

OS="$(os_name)"

default_sdk_path() {
  case "$OS" in
    macos) echo "$HOME/Library/Android/sdk" ;;
    linux) echo "$HOME/Android/Sdk" ;;
    # $LOCALAPPDATA arrives with backslashes; normalize so the path we print
    # is copy-pasteable into a shell.
    windows) echo "${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk" | tr '\\' '/' ;;
    *) echo "" ;;
  esac
}

find_sdk() {
  # An existing value wins, but only if it actually points at an SDK.
  for candidate in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$(default_sdk_path)"; do
    if [ -n "$candidate" ] && [ -d "$candidate/platform-tools" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! SDK="$(find_sdk)"; then
  echo "error: could not find an Android SDK." >&2
  echo "Looked for a directory containing platform-tools/ at:" >&2
  echo "  \$ANDROID_HOME, \$ANDROID_SDK_ROOT, $(default_sdk_path)" >&2
  echo >&2
  echo "Install it via Android Studio (SDK Manager), then re-run this script." >&2
  exit 1
fi

echo "Found Android SDK: $SDK"

profile_line='export ANDROID_HOME="'"$SDK"'"'

case "$OS" in
  windows)
    # setx writes to the user environment in the registry. It affects new
    # processes only -- already-running shells keep their inherited copy.
    WIN_SDK="$(cygpath -w "$SDK" 2>/dev/null || echo "$SDK")"
    setx ANDROID_HOME "$WIN_SDK" >/dev/null
    echo "Persisted ANDROID_HOME=$WIN_SDK to the Windows user environment."
    echo "Note: only new shells see it. For this shell, run:"
    echo "  export ANDROID_HOME=\"$SDK\""
    ;;
  macos | linux)
    # Pick the profile matching the login shell, falling back to bash.
    case "${SHELL:-}" in
      */zsh) PROFILE="$HOME/.zshrc" ;;
      */bash) PROFILE="$HOME/.bashrc" ;;
      *) PROFILE="$HOME/.profile" ;;
    esac
    touch "$PROFILE"
    if grep -q "ANDROID_HOME" "$PROFILE"; then
      echo "ANDROID_HOME already referenced in $PROFILE -- leaving it alone."
      echo "Verify it points at: $SDK"
    else
      {
        echo ""
        echo "# Added by ReFillr scripts/setup-android-home.sh"
        echo "$profile_line"
        echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"'
      } >>"$PROFILE"
      echo "Appended ANDROID_HOME to $PROFILE"
    fi
    echo "For this shell, run:"
    echo "  $profile_line"
    ;;
  *)
    echo "error: unsupported OS '$(uname -s)'. Set ANDROID_HOME manually to $SDK" >&2
    exit 1
    ;;
esac

echo
echo "Done. Verify in a NEW shell with: echo \$ANDROID_HOME"
