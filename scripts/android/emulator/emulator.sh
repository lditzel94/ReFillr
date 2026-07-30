#!/usr/bin/env bash
# Start / stop / inspect Android emulators without hunting for SDK paths.
# Works on macOS, Linux, and Windows (Git Bash / MSYS).
#
# Usage (run from the repo root):
#   ./scripts/android/emulator/emulator.sh list          # show available AVDs
#   ./scripts/android/emulator/emulator.sh start [name]  # boot detached, wait until ready
#   ./scripts/android/emulator/emulator.sh status        # what adb currently sees
#   ./scripts/android/emulator/emulator.sh stop          # shut down running emulators

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
EXT=""
[ "$OS" = "windows" ] && EXT=".exe"

default_sdk_path() {
  case "$OS" in
    macos) echo "$HOME/Library/Android/sdk" ;;
    linux) echo "$HOME/Android/Sdk" ;;
    # $LOCALAPPDATA arrives with backslashes; normalize for consistent paths.
    windows) echo "${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk" | tr '\\' '/' ;;
    *) echo "" ;;
  esac
}

find_sdk() {
  for candidate in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$(default_sdk_path)"; do
    if [ -n "$candidate" ] && [ -d "$candidate/platform-tools" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! SDK="$(find_sdk)"; then
  echo "error: Android SDK not found." >&2
  echo "Run ./scripts/android/setup-android-home/setup-android-home.sh first." >&2
  exit 1
fi

ADB="$SDK/platform-tools/adb$EXT"
EMULATOR="$SDK/emulator/emulator$EXT"

[ -x "$ADB" ] || { echo "error: adb not found at $ADB" >&2; exit 1; }

list_avds() {
  [ -x "$EMULATOR" ] || { echo "error: emulator not found at $EMULATOR" >&2; exit 1; }
  "$EMULATOR" -list-avds
}

cmd_list() {
  local avds
  avds="$(list_avds || true)"
  if [ -z "$avds" ]; then
    echo "No AVDs defined."
    echo
    echo "Create one in Android Studio: Device Manager > Create Virtual Device."
    echo "On a small laptop screen prefer a 16:9 profile (Pixel 2, Nexus 5) over"
    echo "the 20:9 Pixel 6/7/8 family, which eats the full window height."
    return
  fi
  echo "Available AVDs:"
  echo "$avds" | sed 's/^/  /'
}

# Detach so the emulator outlives this script's shell. A plain `&` makes it a
# child of the calling shell, so it dies when that shell exits -- which is easy
# to hit when driving this from a tool or CI step.
start_detached() {
  local avd="$1"
  local log="${TMPDIR:-/tmp}/emulator-$avd.log"
  if [ "$OS" = "windows" ]; then
    # Git Bash job control does not reliably survive the parent exiting on
    # Windows; PowerShell's Start-Process gives a genuinely independent process.
    local win_emu
    win_emu="$(cygpath -w "$EMULATOR" 2>/dev/null || echo "$EMULATOR")"
    powershell -NoProfile -Command \
      "Start-Process -FilePath '$win_emu' -ArgumentList '-avd','$avd' -WindowStyle Minimized" \
      >/dev/null
  else
    nohup "$EMULATOR" -avd "$avd" >"$log" 2>&1 &
    disown || true
    echo "Log: $log"
  fi
}

cmd_start() {
  local avd="${1:-}"
  local avds
  avds="$(list_avds || true)"

  if [ -z "$avds" ]; then
    cmd_list
    exit 1
  fi

  if [ -z "$avd" ]; then
    avd="$(echo "$avds" | head -n 1)"
    echo "No AVD named; using first available: $avd"
  elif ! echo "$avds" | grep -qx "$avd"; then
    echo "error: no AVD named '$avd'." >&2
    echo "$avds" | sed 's/^/  /' >&2
    exit 1
  fi

  echo "Starting $avd (detached)..."
  start_detached "$avd"

  # Deliberately NOT using `adb wait-for-device`: it returns immediately for a
  # stale entry left behind by an emulator that was just killed, so a
  # stop-then-start cycle would sail past it and then hang. Polling
  # sys.boot_completed is the only signal that means the device is truly usable
  # -- it fails harmlessly while no device is attached, so one loop covers both
  # "not appeared yet" and "appeared but still booting".
  echo "Waiting for boot to complete..."
  local deadline=$((SECONDS + 300))
  while [ "$SECONDS" -lt "$deadline" ]; do
    # tr strips the CR that adb shell emits on Windows.
    if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')" = "1" ]; then
      echo "Boot complete."
      "$ADB" devices
      return 0
    fi
    sleep 3
  done

  echo "error: timed out after 5 minutes waiting for boot." >&2
  echo "Check whether the emulator process actually started; on Windows a" >&2
  echo "failed launch is silent because it is detached." >&2
  exit 1
}

cmd_status() {
  "$ADB" devices -l
}

cmd_stop() {
  local devices
  devices="$("$ADB" devices | awk '/^emulator-/ {print $1}')"
  if [ -z "$devices" ]; then
    echo "No running emulators."
    return
  fi
  for d in $devices; do
    echo "Stopping $d..."
    "$ADB" -s "$d" emu kill || true
  done

  # Block until they are really gone. `emu kill` returns as soon as the command
  # is delivered, but the AVD lock is held until the process exits -- starting a
  # new emulator before then fails.
  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -z "$("$ADB" devices | awk '/^emulator-/ {print $1}')" ]; then
      echo "Stopped."
      return 0
    fi
    sleep 2
  done
  echo "warning: emulator still listed after 60s; a restart may fail." >&2
}

case "${1:-start}" in
  list) cmd_list ;;
  start) cmd_start "${2:-}" ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  *)
    echo "Usage: $0 {list|start [avd]|status|stop}" >&2
    exit 1
    ;;
esac
