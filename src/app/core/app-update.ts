import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

/**
 * New-version detection for the installed PWA. The service worker downloads a new build in the
 * background; `ready` turns true once it is cached, and `apply()` switches to it with a reload.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly sw = inject(SwUpdate);
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'VERSION_READY') this._ready.set(true);
    });
    // The cached version can no longer be served (e.g. its files were evicted): only a reload helps.
    this.sw.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => document.location.reload());

    // An installed PWA can stay open for days; look for a new deploy whenever it comes back.
    const check = () => {
      if (document.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', check));
  }

  async apply(): Promise<void> {
    await this.sw.activateUpdate();
    document.location.reload();
  }

  dismiss(): void {
    this._ready.set(false);
  }
}
