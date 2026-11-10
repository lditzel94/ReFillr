import { Component, computed, inject, output, signal } from '@angular/core';
import { AuthService } from '../core/auth';
import { initials } from '../core/format';
import { HouseholdError, HouseholdService } from '../core/household';
import { InventoryStore } from '../core/inventory-store';
import { plural } from '../core/format';
import { ToastService } from '../core/toast';
import { BottomSheet } from '../shared/bottom-sheet';
import { CategoryList } from './category-list';

@Component({
  selector: 'app-household-sheet',
  imports: [BottomSheet, CategoryList],
  template: `
    <app-bottom-sheet label="Hogar" (closed)="closed.emit()">
      @let household = households.current();
      <div class="head">
        <h2>{{ household?.name }}</h2>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cerrar</button>
      </div>

      <div class="field">
        <span class="label">Miembros</span>
        <ul class="members">
          @for (m of members(); track m.id) {
            <li>
              <span class="avatar">{{ m.initial }}</span>
              <span class="who">
                <span class="truncate">{{ m.name }}</span>
                <span class="muted email truncate">{{ m.email }}</span>
              </span>
              @if (m.removable) {
                @if (confirming() === m.id) {
                  <button type="button" class="btn btn-secondary" (click)="confirming.set(null)">
                    No
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="busy()"
                    (click)="remove(m.id, m.name)"
                  >
                    Sacar
                  </button>
                } @else {
                  <button type="button" class="btn btn-ghost" (click)="confirming.set(m.id)">
                    Sacar
                  </button>
                }
              }
            </li>
          }
        </ul>
        <p class="hint muted">Para sumar a alguien, pedíselo al administrador.</p>
      </div>

      <div class="field">
        <span class="label">Categorías</span>
        <app-category-list />
      </div>

      @if (confirming() === 'sign-out') {
        <div class="confirm">
          <p>
            Hay {{ pendingText() }} sin enviar porque no hay conexión. Si cerrás sesión ahora, se
            pierden.
          </p>
          <div class="actions">
            <button type="button" class="btn btn-secondary btn-lg" (click)="confirming.set(null)">
              Esperar
            </button>
            <button type="button" class="btn btn-primary btn-lg" (click)="signOut(true)">
              Cerrar sesión
            </button>
          </div>
        </div>
      } @else if (confirming() === 'leave') {
        <div class="confirm">
          <p>
            @if (members().length === 1) {
              Sos el último miembro: al salir se borran el hogar y todo su stock.
            } @else {
              Vas a dejar de ver este stock. Para volver, el administrador te tiene que sumar.
            }
          </p>
          <div class="actions">
            <button type="button" class="btn btn-secondary btn-lg" (click)="confirming.set(null)">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-lg"
              [disabled]="busy()"
              (click)="leave()"
            >
              Salir del hogar
            </button>
          </div>
        </div>
      } @else {
        <div class="actions">
          <button type="button" class="btn btn-secondary btn-lg" (click)="confirming.set('leave')">
            Salir del hogar
          </button>
          <button type="button" class="btn btn-secondary btn-lg" (click)="signOut()">
            Cerrar sesión
          </button>
        </div>
      }
    </app-bottom-sheet>
  `,
  styles: `
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
    .label {
      font-size: 12px;
      margin-bottom: 5px;
      color: color-mix(in srgb, var(--color-text) 70%, transparent);
    }
    .hint {
      margin: 8px 0 0;
      font-size: 12px;
    }
    .members {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-size: 14px;
    }
    .who {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .email {
      font-size: 12px;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    .actions .btn {
      flex: 1;
    }
    .confirm p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .avatar {
      width: 26px;
      height: 26px;
      flex: none;
      border-radius: 50%;
      background: var(--color-accent-800);
      color: var(--color-accent-200);
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `,
})
export class HouseholdSheet {
  readonly closed = output<void>();
  readonly signedOut = output<void>();
  /** Left the household: the page moves to the "no household" screen. */
  readonly left = output<void>();

  protected readonly households = inject(HouseholdService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly inventory = inject(InventoryStore);

  protected readonly confirming = signal<'leave' | 'sign-out' | string | null>(null);
  protected readonly pendingText = computed(() =>
    plural(this.inventory.pendingCount(), 'cambio', 'cambios'),
  );
  protected readonly busy = signal(false);

  protected readonly members = computed(() => {
    const me = this.auth.user()?.id;
    return this.households.members().map((m) => ({
      id: m.id,
      name: m.id === me ? `${m.displayName || m.email} (vos)` : m.displayName || m.email,
      email: m.email,
      initial: initials(m.displayName || m.email),
      // Nobody removes themselves (that's "Salir") or the admin.
      removable: m.id !== me && !m.isAdmin,
    }));
  });

  protected async remove(id: string, name: string): Promise<void> {
    await this.run(async () => {
      await this.households.remove(id);
      this.toast.show(`Sacaste a ${name} del hogar.`);
    });
  }

  protected async leave(): Promise<void> {
    await this.run(async () => {
      await this.households.leave();
      this.left.emit();
    });
  }

  protected async signOut(confirmed = false): Promise<void> {
    if (!confirmed && this.inventory.pendingCount() > 0) {
      this.confirming.set('sign-out');
      return;
    }
    await this.auth.signOut();
    this.signedOut.emit();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      this.toast.show(e instanceof HouseholdError ? e.message : 'Algo falló. Probá de nuevo.');
    } finally {
      this.busy.set(false);
      this.confirming.set(null);
    }
  }
}
