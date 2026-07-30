# scripts/android

Android developer environment helpers. Pick the variant matching your shell —
`.sh` for macOS, Linux, and Git Bash on Windows; `.ps1` for native PowerShell.

## setup-android-home

Finds the Android SDK and persists `ANDROID_HOME` for your user account.

```bash
./scripts/android/setup-android-home/setup-android-home.sh      # macOS / Linux / Git Bash
```
```powershell
.\scripts\android\setup-android-home\setup-android-home.ps1     # Windows PowerShell
```

**Why this rather than `local.properties`.** AGP resolves the SDK from `sdk.dir`
in `local.properties` first, then falls back to `ANDROID_HOME`. `local.properties`
is gitignored and per-project, so every clone would need setting up by hand. An
empty `sdk.dir=` is worse than none at all — it wins the precedence race and then
supplies nothing, blocking the fallback. Setting `ANDROID_HOME` once per machine
makes every future clone build with zero project-level configuration.

CI needs none of this: `android-actions/setup-android` sets `ANDROID_HOME` itself.

**Environment variables only reach processes started afterwards.** Shells already
running keep their inherited copy, so restart your terminal after the first run.

## emulator

Starts, stops, and inspects emulators without hunting for SDK paths.

```bash
./scripts/android/emulator/emulator.sh list           # available AVDs
./scripts/android/emulator/emulator.sh start          # boot the first AVD, wait until usable
./scripts/android/emulator/emulator.sh start Pixel_2  # boot a specific one
./scripts/android/emulator/emulator.sh status         # what adb currently sees
./scripts/android/emulator/emulator.sh stop           # shut down running emulators
```

The PowerShell version takes the same verbs: `.\scripts\android\emulator\emulator.ps1 start Pixel_2`.

Two behaviours worth knowing, both learned the hard way:

- **Launches are detached.** A plain `emulator -avd X &` makes the emulator a child
  of the calling shell, so it dies when that shell exits — easy to hit when driving
  it from a tool, a script, or CI.
- **`start` polls `sys.boot_completed`, not `adb wait-for-device`.** The latter
  returns immediately for the stale entry a just-killed emulator leaves behind, so
  a stop-then-start cycle would sail past it and then hang. Likewise `stop` blocks
  until the process is really gone, because the AVD lock outlives `emu kill`.

## Creating an AVD

Neither script creates AVDs — that needs `avdmanager` from `cmdline-tools`, which
is not installed by default. Use Android Studio's **Device Manager > Create Virtual
Device**.

On a small laptop screen, prefer a **16:9** profile (Pixel 2, Nexus 5) over the
**20:9** Pixel 6/7/8 family. Aspect ratio matters more than resolution here — the
emulator scales the display to its window, but a 20:9 device eats the full screen
height regardless. Reuse an already-installed system image to avoid a multi-GB
download.
