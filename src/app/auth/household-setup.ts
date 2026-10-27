import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HouseholdService } from '../core/household';
import { InventoryStore } from '../core/inventory-store';
import { formatMonthYear, plural } from '../core/format';
import { normalizeInviteCode } from '../core/stock';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-household-setup',
  styleUrl: './auth-screen.css',
  template: `
    <div class="stack">
      <div>
        <h1 class="display">Tu hogar</h1>
        <p class="lede muted">Los ítems son del hogar, no de cada persona.</p>
      </div>

      <form class="field join" (submit)="$event.preventDefault(); join()">
        <label for="code">Unirse con un código</label>
        <div class="join-row">
          <input
            id="code"
            class="input code"
            placeholder="4KQ2ZP"
            maxlength="6"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            [value]="code()"
            (input)="onCode($event)"
          />
          <button type="submit" class="btn btn-secondary">Unirme</button>
        </div>
      </form>

      @let found = match();
      @if (found) {
        <div class="card">
          <div class="card-kicker">Hogar encontrado</div>
          <div class="card-title">{{ found.name }}</div>
          <div class="card-meta">{{ found.summary }}</div>
        </div>
      } @else if (code().length === 6) {
        <p class="form-error">No hay ningún hogar con ese código. Revisalo con quien te invitó.</p>
      }

      <hr class="rule" />

      <div class="create">
        <p class="muted">¿Nadie te invitó todavía?</p>
        <button type="button" class="btn btn-secondary btn-block create-btn" (click)="create()">
          Crear un hogar nuevo
        </button>
      </div>
    </div>
  `,
  styles: `
    .stack {
      gap: 22px;
    }
    .join {
      flex: none;
      margin: 0;
    }
    .join-row {
      display: flex;
      gap: 8px;
    }
    .code {
      font-size: 17px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .join-row .btn {
      min-height: 46px;
      padding: 0 16px;
      flex: none;
    }
    .create {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .create p {
      margin: 0;
      font-size: 13px;
    }
    .create-btn {
      min-height: 46px;
    }
  `,
})
export class HouseholdSetup {
  private readonly households = inject(HouseholdService);
  private readonly inventory = inject(InventoryStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly code = signal('');

  /** Live preview of the household behind the typed code. */
  protected readonly match = computed(() => {
    const household = this.households.findByCode(this.code());
    if (!household) return null;
    const members = plural(household.memberIds.length, 'miembro', 'miembros');
    const items = plural(this.inventory.countFor(household.id), 'ítem', 'ítems');
    return {
      name: household.name,
      summary: `${members} · ${items} · creado en ${formatMonthYear(household.createdAt)}`,
    };
  });

  protected onCode(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.code.set(normalizeInviteCode(input.value));
    // Keep the field in sync when normalization dropped characters.
    input.value = this.code();
  }

  protected async join(): Promise<void> {
    const household = this.households.join(this.code());
    if (!household) {
      if (!this.code()) this.code.set('XXXXXX');
      return;
    }
    await this.router.navigateByUrl('/stock');
    this.toast.show(`Te uniste a ${household.name}.`);
  }

  protected async create(): Promise<void> {
    const household = this.households.create();
    await this.router.navigateByUrl('/stock');
    this.toast.show(`Hogar creado. Código de invitación: ${household.inviteCode}.`);
  }
}
