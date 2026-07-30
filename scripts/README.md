# scripts

Developer tooling, grouped first by platform concern, then by intent.

```
scripts/
└── android/
    ├── setup-android-home/     # persist ANDROID_HOME for this machine
    │   ├── setup-android-home.sh
    │   └── setup-android-home.ps1
    └── emulator/               # start / stop / inspect emulators
        ├── emulator.sh
        └── emulator.ps1
```

See [`android/README.md`](android/README.md) for usage.

Planned as the project grows: `web/` (Wasm dev server, PWA asset checks),
`ios/` (CI entry points — no local Xcode on this project), `supabase/`
(schema migrations, RLS policies).

## Conventions

**One folder per intent, holding every platform variant of that one tool.** A
tool's `.sh` and `.ps1` are a matched pair: they take the same verbs, print the
same messages, and must change together. Keeping them side by side makes the
pair visible at a glance and makes divergence between them obvious — which
matters, because the two shells fail in genuinely different ways.

- `.sh` — macOS, Linux, and Git Bash on Windows. Detects the OS via `uname`.
- `.ps1` — native Windows PowerShell.

**Both variants get tested on the same change.** A fix verified only through the
`.sh` path says nothing about the `.ps1` one.

**Scripts are run from the repo root**, e.g.
`./scripts/android/emulator/emulator.sh start`.
