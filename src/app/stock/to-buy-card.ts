import { Component, input, output } from '@angular/core';
import { ItemView } from './item-view';

@Component({
  selector: 'app-to-buy-card',
  template: `
    @let v = view();
    <button type="button" class="info" (click)="edit.emit()">
      <span class="title-row">
        <span class="name truncate">{{ v.item.name }}</span>
        @if (v.item.pending) {
          <span class="tag tag-neutral tag-small">pendiente</span>
        }
      </span>
      <span class="detail truncate">{{ v.detail }}</span>
    </button>
    <div class="need" aria-label="Comprar {{ v.need }} {{ v.item.unit }}">
      <div class="n">{{ v.need }}</div>
      <div class="unit">{{ v.item.unit }}</div>
    </div>
    <button
      type="button"
      class="bought"
      (click)="bought.emit()"
      [attr.aria-label]="'Comprado: ' + v.item.name"
    >
      <svg width="19" height="15" viewBox="0 0 19 15" fill="none" aria-hidden="true">
        <path
          d="M1.5 8l5.5 5L17.5 1.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 0;
      border: 0;
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }
    .name {
      font-size: 16px;
      font-weight: 500;
    }
    .detail {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 3px;
    }
    .need {
      flex: none;
      text-align: right;
    }
    .n {
      font-size: 25px;
      font-weight: 500;
      line-height: 1;
      color: var(--color-accent-strong);
      font-variant-numeric: tabular-nums;
    }
    .unit {
      font-size: 10px;
      color: var(--color-text-faint);
      letter-spacing: 0.04em;
    }
    .bought {
      width: 46px;
      height: 46px;
      flex: none;
      border-radius: 50%;
      border: 1px solid var(--color-accent);
      background: transparent;
      color: var(--color-accent-strong);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bought:hover {
      background: rgba(145, 132, 217, 0.16);
    }
    .bought:active {
      background: rgba(145, 132, 217, 0.28);
    }
  `,
})
export class ToBuyCard {
  readonly view = input.required<ItemView>();
  readonly edit = output<void>();
  readonly bought = output<void>();
}
