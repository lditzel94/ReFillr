import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, FormRoot, min, required } from '@angular/forms/signals';
import { InventoryStore } from '../core/inventory-store';
import { Item, ItemDraft } from '../core/models';
import { needToBuy } from '../core/stock';
import { BottomSheet } from '../shared/bottom-sheet';
import { FieldError } from '../shared/field-error';

const NEW_ITEM: Omit<ItemDraft, 'categoryId'> = {
  name: '',
  unit: 'paquetes',
  monthlyUsage: 1,
  currentQty: 0,
};

/**
 * Add / edit sheet. The draft is a linkedSignal of the `item` input, so
 * opening the sheet for another item resets the form automatically, and
 * the signal form is built directly on top of that draft.
 */
@Component({
  selector: 'app-item-sheet',
  imports: [BottomSheet, FormField, FormRoot, FieldError],
  template: `
    <app-bottom-sheet [label]="title()" (closed)="closed.emit()">
      <form [formRoot]="itemForm">
        <div class="head">
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancelar</button>
        </div>

        <div class="field">
          <label for="item-name">Ítem</label>
          <input
            id="item-name"
            class="input"
            placeholder="Cartones de leche"
            autocomplete="off"
            [formField]="itemForm.name"
          />
          <app-field-error [field]="itemForm.name" />
        </div>

        <div class="numbers">
          <div class="field">
            <label for="item-monthly">Uso por mes</label>
            <input
              id="item-monthly"
              class="input"
              type="number"
              inputmode="numeric"
              [formField]="itemForm.monthlyUsage"
            />
          </div>
          <div class="field">
            <label for="item-qty">En casa</label>
            <input
              id="item-qty"
              class="input"
              type="number"
              inputmode="numeric"
              [formField]="itemForm.currentQty"
            />
          </div>
          <div class="field unit">
            <label for="item-unit">Unidad</label>
            <input
              id="item-unit"
              class="input"
              placeholder="cartones"
              autocomplete="off"
              [formField]="itemForm.unit"
            />
          </div>
        </div>
        <app-field-error [field]="itemForm.monthlyUsage" />
        <app-field-error [field]="itemForm.currentQty" />

        <fieldset class="field">
          <legend>Categoría</legend>
          <div class="chips">
            @for (c of categories(); track c.id) {
              <button
                type="button"
                class="tag chip"
                [class.tag-outline]="draft().categoryId === c.id"
                [class.tag-neutral]="draft().categoryId !== c.id"
                [attr.aria-pressed]="draft().categoryId === c.id"
                (click)="pick(c.id)"
              >
                {{ c.name }}
              </button>
            }
            @if (!addingCategory()) {
              <button type="button" class="tag tag-neutral chip" (click)="addingCategory.set(true)">
                + Nueva
              </button>
            }
          </div>
          @if (addingCategory()) {
            <div class="new-category">
              <input
                class="input"
                aria-label="Nombre de la categoría nueva"
                placeholder="Mascotas"
                autocomplete="off"
                maxlength="40"
                [value]="newCategory()"
                (input)="newCategory.set($any($event.target).value)"
                (keydown.enter)="$event.preventDefault(); createCategory()"
              />
              <button type="button" class="btn btn-secondary" (click)="cancelCategory()">
                Cancelar
              </button>
              <button type="button" class="btn btn-primary" (click)="createCategory()">
                Crear
              </button>
            </div>
            @if (categoryError(); as error) {
              <p class="field-error">{{ error }}</p>
            }
          }
        </fieldset>

        <div class="need">
          <span>Comprar ahora</span>
          <strong>{{ need() }} {{ draft().unit || 'unidades' }}</strong>
        </div>

        <div class="actions">
          <button type="submit" class="btn btn-primary btn-lg save">
            {{ item() ? 'Guardar' : 'Agregar al hogar' }}
          </button>
          @if (item()) {
            <button type="button" class="btn btn-secondary btn-lg" (click)="deleted.emit()">
              Eliminar
            </button>
          }
        </div>
      </form>
    </app-bottom-sheet>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }
    .head .btn {
      min-height: 36px;
    }
    .numbers {
      display: flex;
      gap: 10px;
    }
    .numbers .field {
      flex: 1;
    }
    .numbers .unit {
      flex: 1.2;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
    }
    legend {
      font-size: 12px;
      margin-bottom: 5px;
      padding: 0;
      color: color-mix(in srgb, var(--color-text) 70%, transparent);
    }
    .new-category {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .new-category .input {
      flex: 1;
      min-width: 0;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chip {
      cursor: pointer;
      height: 34px;
      padding: 0 14px;
      font-size: 13px;
    }
    .chip.tag-outline {
      background: transparent;
    }
    .need {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .need strong {
      font-size: 19px;
      font-weight: 500;
      color: var(--color-accent-strong);
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    .save {
      flex: 1;
    }
  `,
})
export class ItemSheet {
  /** The item being edited, or null to add a new one. */
  readonly item = input<Item | null>(null);
  readonly saved = output<ItemDraft>();
  readonly deleted = output<void>();
  readonly closed = output<void>();

  private readonly inventory = inject(InventoryStore);
  /** The household's categories, from the database (base ones first). */
  protected readonly categories = this.inventory.categories;

  protected readonly addingCategory = signal(false);
  protected readonly newCategory = signal('');
  protected readonly categoryError = signal<string | null>(null);

  protected readonly draft = linkedSignal<ItemDraft>(() => {
    const it = this.item();
    return it
      ? {
          name: it.name,
          categoryId: it.categoryId,
          unit: it.unit,
          monthlyUsage: it.monthlyUsage,
          currentQty: it.currentQty,
        }
      : // untracked: a category created from this sheet must not reset the form.
        { ...NEW_ITEM, categoryId: untracked(this.categories)[0]?.id ?? '' };
  });

  protected readonly itemForm = form(
    this.draft,
    (p) => {
      required(p.name, { message: 'Ponele un nombre.' });
      min(p.monthlyUsage, 0, { message: 'El uso por mes no puede ser negativo.' });
      min(p.currentQty, 0, { message: 'La cantidad en casa no puede ser negativa.' });
    },
    {
      submission: {
        action: async (f) => {
          this.saved.emit(f().value());
          return undefined;
        },
      },
    },
  );

  protected readonly title = computed(() => (this.item() ? 'Editar ítem' : 'Nuevo ítem'));
  protected readonly need = computed(() => needToBuy(this.draft()));

  protected pick(categoryId: string): void {
    this.draft.update((d) => ({ ...d, categoryId }));
  }

  /** Creates the category and leaves it picked for this item. */
  protected createCategory(): void {
    const name = this.newCategory().trim();
    if (!name) {
      this.categoryError.set('Ponele un nombre.');
      return;
    }
    const id = this.inventory.createCategory(name);
    if (!id) {
      this.categoryError.set(`Ya hay una categoría llamada ${name}.`);
      return;
    }
    this.pick(id);
    this.cancelCategory();
  }

  protected cancelCategory(): void {
    this.addingCategory.set(false);
    this.newCategory.set('');
    this.categoryError.set(null);
  }
}
