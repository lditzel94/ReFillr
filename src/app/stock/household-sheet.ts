import { Component, computed, inject, output } from '@angular/core';
import { AuthService } from '../core/auth';
import { initials } from '../core/format';
import { HouseholdService } from '../core/household';
import { ToastService } from '../core/toast';
import { BottomSheet } from '../shared/bottom-sheet';

@Component({
  selector: 'app-household-sheet',
  imports: [BottomSheet],
  template: `
    <app-bottom-sheet label="Hogar" (closed)="closed.emit()">
      @let household = households.current();
      <div class="head">
        <h2>{{ household?.name }}</h2>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cerrar</button>
      </div>

      <div class="field">
        <span class="label">Código de invitación</span>
        <div class="code-row">
          <span class="code">{{ household?.inviteCode }}</span>
          <button type="button" class="btn btn-secondary" (click)="share()">Compartir</button>
        </div>
        <p class="hint muted">Quien se una con este código ve y edita el mismo stock.</p>
      </div>

      <div class="field">
        <span class="label">Miembros</span>
        <ul class="members">
          @for (m of members(); track m.id) {
            <li>
              <span class="avatar">{{ m.initial }}</span>
              <span class="truncate">{{ m.name }}</span>
              <span class="muted email truncate">{{ m.email }}</span>
            </li>
          }
        </ul>
      </div>

      <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="signOut()">
        Cerrar sesión
      </button>
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
    .code-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .code {
      flex: 1;
      font-size: 22px;
      letter-spacing: 0.18em;
      color: var(--color-accent-soft);
    }
    .hint {
      margin: 6px 0 0;
      font-size: 12px;
    }
    .members {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-size: 14px;
    }
    .email {
      font-size: 12px;
      margin-left: auto;
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

  protected readonly households = inject(HouseholdService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly members = computed(() =>
    this.households
      .members()
      .map((u) => ({
        id: u.id,
        name: u.displayName,
        email: u.email,
        initial: initials(u.displayName),
      })),
  );

  protected async share(): Promise<void> {
    const household = this.households.current();
    if (!household) return;
    const text = `Unite a ${household.name} en ReFillr con el código ${household.inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(household.inviteCode);
      this.toast.show('Código copiado.');
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  }

  protected signOut(): void {
    this.auth.signOut();
    this.signedOut.emit();
  }
}
