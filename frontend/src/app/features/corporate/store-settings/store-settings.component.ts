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
      h2 {
        margin: 0 0 1rem;
      }
      .section {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 18px;
      }
      .section h3 {
        margin: 0 0 0.75rem;
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
      .secondary {
        background: #0f766e;
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
