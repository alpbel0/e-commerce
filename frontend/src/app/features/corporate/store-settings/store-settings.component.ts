import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CorporateService } from '../../../core/api/corporate.service';
import { StoreService } from '../../../core/api/store.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import { ToastService } from '../../../core/notify/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './store-settings.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .field {
        margin-bottom: 12px;
        max-width: 480px;
      }
      label {
        display: block;
        font-size: 0.8rem;
        color: #475569;
        margin-bottom: 4px;
      }
      input,
      textarea,
      select {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      textarea {
        min-height: 80px;
        resize: vertical;
      }
      .meta {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 12px;
      }
      button {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
      }
      .warn {
        color: #b45309;
        font-size: 0.85rem;
        margin-bottom: 12px;
      }
    `
  ]
})
export class StoreSettingsComponent {
  private readonly corpApi = inject(CorporateService);
  private readonly storeApi = inject(StoreService);
  readonly ctx = inject(CorporateContextService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly statusLocked = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: [''],
    status: ['OPEN' as string, Validators.required]
  });

  constructor() {
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      if (!sid) {
        this.loading.set(false);
        return;
      }
      this.fetch(sid);
    });
  }

  fetch(storeId: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.storeApi.getById(storeId).subscribe({
      next: (detail) => {
        this.loading.set(false);
        const st = detail.status.toUpperCase();
        const locked = st === 'SUSPENDED';
        this.statusLocked.set(locked);
        this.form.patchValue({
          name: detail.name,
          description: detail.description ?? '',
          contactEmail: detail.contactEmail,
          contactPhone: detail.contactPhone ?? '',
          status: locked ? 'OPEN' : st === 'CLOSED' ? 'CLOSED' : 'OPEN'
        });
        if (locked) {
          this.form.controls.status.disable({ emitEvent: false });
        } else {
          this.form.controls.status.enable({ emitEvent: false });
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    if (sid) this.fetch(sid);
  }

  save(): void {
    const sid = this.ctx.selectedStoreId();
    if (!sid || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.corpApi
      .updateStore(sid, {
        name: v.name.trim(),
        description: v.description.trim() || null,
        contactEmail: v.contactEmail.trim(),
        contactPhone: v.contactPhone.trim() || null,
        status: this.statusLocked() ? undefined : v.status
      })
      .subscribe({
        next: (detail) => {
          this.saving.set(false);
          const st = detail.status.toUpperCase();
          const locked = st === 'SUSPENDED';
          this.statusLocked.set(locked);
          this.form.patchValue({
            name: detail.name,
            description: detail.description ?? '',
            contactEmail: detail.contactEmail,
            contactPhone: detail.contactPhone ?? '',
            status: locked ? 'OPEN' : st === 'CLOSED' ? 'CLOSED' : 'OPEN'
          });
          if (locked) {
            this.form.controls.status.disable({ emitEvent: false });
          } else {
            this.form.controls.status.enable({ emitEvent: false });
          }
          this.toast.showInfo('Mağaza güncellendi');
        },
        error: () => this.saving.set(false)
      });
  }
}
