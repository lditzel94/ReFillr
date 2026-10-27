import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Browser online/offline state as a signal. */
@Injectable({ providedIn: 'root' })
export class Connectivity {
  private readonly _online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly online = this._online.asReadonly();

  constructor() {
    const update = () => this._online.set(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}
