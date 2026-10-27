import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth';
import { Clock } from '../core/clock';
import { Connectivity } from '../core/connectivity';
import { formatMonth, initials, plural, timeAgo } from '../core/format';
import { HouseholdService } from '../core/household';
import { InventoryStore } from '../core/inventory-store';
import { CATEGORY_LABELS, Item, ItemDraft } from '../core/models';
import { needToBuy } from '../core/stock';
import { ToastService } from '../core/toast';
import { Logo } from '../shared/logo';
import { HouseholdSheet } from './household-sheet';
import { ItemSheet } from './item-sheet';
import { ItemView } from './item-view';
import { StockRow } from './stock-row';
import { ToBuyCard } from './to-buy-card';

type Sheet = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'household' } | null;

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-stock-page',
  imports: [Logo, ToBuyCard, StockRow, ItemSheet, HouseholdSheet],
  templateUrl: './stock-page.html',
  styleUrl: './stock-page.css',
})
export class StockPage {
  private readonly auth = inject(AuthService);
  private readonly households = inject(HouseholdService);
  private readonly inventory = inject(InventoryStore);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly connectivity = inject(Connectivity);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly household = this.households.current;
  protected readonly isEmpty = this.inventory.isEmpty;

  protected readonly sheet = signal<Sheet>(null);

  /** The item behind an open edit sheet; closes itself if the item disappears. */
  protected readonly editing = computed(() => {
    const s = this.sheet();
    return s?.kind === 'edit' ? (this.inventory.byId(s.id) ?? null) : null;
  });

  protected readonly avatars = computed(() =>
    this.households
      .members()
      .map((u) => ({
        id: u.id,
        initial: initials(u.displayName),
        me: u.id === this.auth.user()?.id,
      })),
  );

  protected readonly toBuy = computed(() => this.inventory.toBuy().map((it) => this.toView(it)));

  protected readonly groups = computed(() =>
    this.inventory.groups().map((g) => ({
      category: g.category,
      count: plural(g.items.length, 'ítem', 'ítems'),
      items: g.items.map((it) => this.toView(it)),
    })),
  );

  protected readonly headline = computed(() => {
    const n = this.toBuy().length;
    if (n) return `${plural(n, 'ítem', 'ítems')} para comprar`;
    return this.isEmpty() ? 'Empecemos' : 'Todo en stock';
  });

  protected readonly toBuySummary = computed(
    () => `faltan ${plural(this.inventory.unitsShort(), 'unidad', 'unidades')}`,
  );

  /** Monthly cycle marker. Need-to-buy is rolling; this bar is only orientation. */
  protected readonly cycle = computed(() => {
    const household = this.household();
    if (!household) return null;
    const start = new Date(household.cycleStart);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const now = new Date(this.clock.now());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const length = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const day = Math.floor((today - startDay) / DAY_MS) + 1;
    const left = length - day;
    return {
      label: `Ciclo de ${formatMonth(household.cycleStart)} · día ${day} de ${length}`,
      right:
        left > 0
          ? `${plural(left, 'día', 'días')} restantes`
          : left === 0
            ? 'último día'
            : 'ciclo cumplido',
      pct: Math.min(100, Math.round((day / length) * 100)),
    };
  });

  protected openAdd(): void {
    this.sheet.set({ kind: 'add' });
  }

  protected openEdit(id: string): void {
    this.sheet.set({ kind: 'edit', id });
  }

  protected closeSheet(): void {
    this.sheet.set(null);
  }

  protected adjust(item: Item, delta: number): void {
    this.inventory.adjust(item.id, delta);
  }

  protected bought(item: Item): void {
    const previous = this.inventory.restock(item.id);
    if (previous === undefined) return;
    this.toast.show(`${item.name}: repuesto a ${item.monthlyUsage} ${item.unit}.`, () =>
      this.inventory.setQty(item.id, previous),
    );
  }

  protected save(draft: ItemDraft): void {
    const editing = this.editing();
    if (editing) {
      this.inventory.update(editing.id, draft);
      this.toast.show(`Guardado: ${draft.name.trim()}.`);
    } else {
      this.inventory.add(draft);
      this.toast.show(`Agregado: ${draft.name.trim()}.`);
    }
    this.closeSheet();
  }

  protected remove(): void {
    const editing = this.editing();
    if (!editing) return;
    const restore = this.inventory.remove(editing.id);
    this.closeSheet();
    this.toast.show(`Eliminado: ${editing.name}.`, restore);
  }

  protected newCycle(): void {
    this.households.startNewCycle();
    const household = this.household();
    if (household) this.toast.show(`Arrancó el ciclo de ${formatMonth(household.cycleStart)}.`);
  }

  protected loadDemo(): void {
    this.inventory.loadDemo();
    this.toast.show('Cargamos un stock de ejemplo. Editalo o borralo cuando quieras.');
  }

  protected async signedOut(): Promise<void> {
    this.closeSheet();
    await this.router.navigateByUrl('/ingresar');
  }

  private toView(item: Item): ItemView {
    const me = this.auth.user()?.id;
    const who =
      item.updatedBy === me
        ? 'Vos'
        : (this.auth.userById(item.updatedBy)?.displayName ?? 'Alguien');
    return {
      item,
      need: needToBuy(item),
      detail: [
        `${item.monthlyUsage}/mes`,
        `${item.currentQty} en casa`,
        `${who} · ${timeAgo(item.updatedAt, this.clock.now())}`,
      ].join('  ·  '),
    };
  }
}
