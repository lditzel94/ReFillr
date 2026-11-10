import { Component, computed, inject, signal } from '@angular/core';
import { plural } from '../core/format';
import { InventoryStore } from '../core/inventory-store';

/**
 * The household's own categories, in the household sheet: rename them, or delete one that has
 * no items. The base ones (Despensa, Baño, Limpieza) are listed but can't be changed.
 * New categories are created from the item sheet ("+ Nueva").
 */
@Component({
  selector: 'app-category-list',
  template: `
    <ul class="categories">
      @for (c of rows(); track c.id) {
        <li>
          @if (editing() === c.id) {
            <input
              class="input"
              [attr.aria-label]="'Nuevo nombre para ' + c.name"
              maxlength="40"
              autocomplete="off"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
              (keydown.enter)="save(c.id)"
            />
            <button type="button" class="btn btn-secondary" (click)="cancel()">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="save(c.id)">Guardar</button>
          } @else {
            <span class="name">
              <span class="truncate">{{ c.name }}</span>
              <span class="muted count">{{ c.count }}</span>
            </span>
            @if (!c.isBase) {
              <button type="button" class="btn btn-ghost" (click)="edit(c.id, c.name)">
                Renombrar
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                [disabled]="c.items > 0"
                [attr.aria-label]="'Borrar ' + c.name"
                (click)="remove(c.id)"
              >
                Borrar
              </button>
            }
          }
        </li>
      }
    </ul>
    @if (error(); as text) {
      <p class="field-error">{{ text }}</p>
    }
    <p class="hint muted">
      Creá una categoría desde un ítem, con "+ Nueva". Solo se borra si no tiene ítems.
    </p>
  `,
  styles: `
    .categories {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      font-size: 14px;
    }
    li .input {
      flex: 1;
      min-width: 0;
    }
    .name {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .count {
      flex: none;
      font-size: 12px;
    }
    .hint {
      margin: 8px 0 0;
      font-size: 12px;
    }
  `,
})
export class CategoryList {
  private readonly inventory = inject(InventoryStore);

  protected readonly editing = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const items = this.inventory.items();
    return this.inventory.categories().map((c) => {
      const count = items.filter((it) => it.categoryId === c.id).length;
      return { ...c, items: count, count: plural(count, 'ítem', 'ítems') };
    });
  });

  protected edit(id: string, name: string): void {
    this.editing.set(id);
    this.draft.set(name);
    this.error.set(null);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  protected save(id: string): void {
    const name = this.draft().trim();
    if (this.inventory.renameCategory(id, name)) {
      this.cancel();
    } else {
      this.error.set(name ? `Ya hay una categoría llamada ${name}.` : 'Ponele un nombre.');
    }
  }

  protected remove(id: string): void {
    this.error.set(null);
    if (!this.inventory.deleteCategory(id)) {
      this.error.set('Solo se puede borrar una categoría sin ítems.');
    }
  }
}
