import { Component, input, output } from '@angular/core';
import { ItemView } from './item-view';

@Component({
  selector: 'app-stock-row',
  template: `
    @let v = view();
    <button type="button" class="info" (click)="edit.emit()">
      <span class="title-row">
        <span class="name truncate">{{ v.item.name }}</span>
        @if (v.item.pending) {
          <span class="tag tag-neutral tag-small">pendiente</span>
        }
        @if (v.need > 0) {
          <span class="dot" title="Falta comprar"></span>
        }
      </span>
      <span class="detail truncate">{{ v.detail }}</span>
    </button>
    <div class="stepper">
      <button
        type="button"
        (click)="adjust.emit(-1)"
        [disabled]="v.item.currentQty === 0"
        [attr.aria-label]="'Usé uno: ' + v.item.name"
      >
        −
      </button>
      <output class="qty" [attr.aria-label]="v.item.currentQty + ' ' + v.item.unit + ' en casa'">{{
        v.item.currentQty
      }}</output>
      <button
        type="button"
        (click)="adjust.emit(1)"
        [attr.aria-label]="'Agregué uno: ' + v.item.name"
      >
        +
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 58px;
      border-bottom: 1px solid var(--color-hairline);
    }
    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 8px 0;
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
      font-size: 15px;
    }
    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-accent);
      flex: none;
    }
    .detail {
      font-size: 12px;
      color: var(--color-text-faint);
      margin-top: 2px;
    }
    .stepper {
      display: flex;
      align-items: center;
      flex: none;
    }
    .stepper button {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      border: 0;
      background: transparent;
      color: var(--color-neutral-300);
      font-size: 20px;
      cursor: pointer;
      touch-action: manipulation;
    }
    .stepper button:hover {
      background: rgba(233, 233, 237, 0.07);
    }
    .stepper button:active {
      background: rgba(233, 233, 237, 0.14);
    }
    .stepper button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .qty {
      min-width: 30px;
      text-align: center;
      font-size: 16px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class StockRow {
  readonly view = input.required<ItemView>();
  readonly edit = output<void>();
  readonly adjust = output<number>();
}
