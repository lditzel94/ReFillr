import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

/** One toast at a time, auto-dismissed. A new toast replaces the current one. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _current = signal<Toast | null>(null);
  readonly current = this._current.asReadonly();

  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string, undo?: () => void, durationMs = 4200): void {
    const toast: Toast = { id: this.nextId++, text, undo };
    this._current.set(toast);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this._current()?.id === toast.id) this._current.set(null);
    }, durationMs);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this._current.set(null);
  }

  runUndo(): void {
    const undo = this._current()?.undo;
    this.dismiss();
    undo?.();
  }
}
