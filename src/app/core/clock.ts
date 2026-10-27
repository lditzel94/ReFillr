import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * A signal that ticks once a minute, so relative times ("hace 5 minutos")
 * and the cycle bar re-render without any manual change detection.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly _now = signal(Date.now());
  readonly now = this._now.asReadonly();

  constructor() {
    const id = setInterval(() => this._now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Forces a refresh, e.g. right after a write so "ahora" is accurate. */
  tick(): void {
    this._now.set(Date.now());
  }
}
