import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CorporateService } from '../../../core/api/corporate.service';
import { StoreService } from '../../../core/api/store.service';
import { AuthStore } from '../../../core/auth/auth.store';
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
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; }
      .page-sub { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 24px; }

      .settings-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        margin-bottom: 20px;
        max-width: 640px;
      }
      .settings-card__header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .settings-card__icon {
        width: 34px; height: 34px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-sm);
        display: flex; align-items: center; justify-content: center;
        color: var(--clr-primary-600);
      }
      .settings-card__title { font-size: 0.95rem; font-weight: 700; margin: 0; }
      .settings-card__body { padding: 20px; }

      .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 520px) { .field-grid { grid-template-columns: 1fr; } }
      .field { display: flex; flex-direction: column; gap: 5px; }
      .field-full { grid-column: 1 / -1; }
      label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
      input, textarea, select {
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      input:focus, textarea:focus, select:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
      }
      textarea { min-height: 80px; resize: vertical; }

      .warn-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: var(--radius-md);
        color: #92400e;
        font-size: 0.82rem;
        margin-bottom: 14px;
      }

      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 40px;
        padding: 0 18px;
        border-radius: var(--radius-md);
        border: none;
        background: var(--clr-primary-600);
        color: #fff;
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        margin-top: 16px;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .save-btn:hover:not(:disabled) { background: var(--clr-primary-700); box-shadow: 0 4px 12px rgba(2,132,199,.3); }
      .save-btn:disabled { opacity: .55; cursor: not-allowed; }
      .save-btn.secondary { background: var(--clr-slate-700); }
      .save-btn.secondary:hover:not(:disabled) { background: var(--clr-slate-900); box-shadow: none; }
    `
  ]
})
export class StoreSettingsComponent {
  private readonly corpApi = inject(CorporateService);
  private readonly storeApi = inject(StoreService);
  private readonly authStore = inject(AuthStore);
  readonly ctx = inject(CorporateContextService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly error = signal(false);
  readonly statusLocked = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: [''],
    status: ['OPEN' as string, Validators.required]
  });

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: [''],
    address: ['']
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
        const status = detail.status.toUpperCase();
        const locked = status === 'SUSPENDED';
        this.statusLocked.set(locked);
        this.form.patchValue({
          name: detail.name,
          description: detail.description ?? '',
          contactEmail: detail.contactEmail,
          contactPhone: detail.contactPhone ?? '',
          status: locked ? 'OPEN' : status === 'CLOSED' ? 'CLOSED' : 'OPEN'
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

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.corpApi
      .updateStore(sid, {
        name: value.name.trim(),
        description: value.description.trim() || null,
        contactEmail: value.contactEmail.trim(),
        contactPhone: value.contactPhone.trim() || null,
        status: this.statusLocked() ? undefined : value.status
      })
      .subscribe({
        next: (detail) => {
          this.saving.set(false);
          const status = detail.status.toUpperCase();
          const locked = status === 'SUSPENDED';
          this.statusLocked.set(locked);
          this.form.patchValue({
            name: detail.name,
            description: detail.description ?? '',
            contactEmail: detail.contactEmail,
            contactPhone: detail.contactPhone ?? '',
            status: locked ? 'OPEN' : status === 'CLOSED' ? 'CLOSED' : 'OPEN'
          });
          if (locked) {
            this.form.controls.status.disable({ emitEvent: false });
          } else {
            this.form.controls.status.enable({ emitEvent: false });
          }
          this.toast.showInfo('Magaza guncellendi');
        },
        error: () => this.saving.set(false)
      });
  }

  createStore(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.corpApi.createStore({
      name: value.name.trim(),
      description: value.description.trim() || null,
      contactEmail: value.contactEmail.trim() || null,
      contactPhone: value.contactPhone.trim() || null,
      address: value.address.trim() || null
    }).subscribe({
      next: (store) => {
        this.creating.set(false);
        this.authStore.loadScope().subscribe({
          next: () => {
            this.ctx.setSelectedStoreId(store.id);
            this.fetch(store.id);
          },
          error: () => {
            this.ctx.setSelectedStoreId(store.id);
            this.fetch(store.id);
          }
        });
        this.createForm.reset({
          name: '',
          description: '',
          contactEmail: '',
          contactPhone: '',
          address: ''
        });
        this.toast.showInfo('Yeni magaza olusturuldu');
      },
      error: () => {
        this.creating.set(false);
        this.toast.showError('Magaza olusturulamadi');
      }
    });
  }
}
