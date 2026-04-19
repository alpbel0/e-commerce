import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CorporateService, type CreateCouponRequest } from '../../../core/api/corporate.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { CouponResponse } from '../../../core/models/coupon.models';
import { ToastService } from '../../../core/notify/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './coupons.component.html',
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }

      /* Form card */
      .form-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        margin-bottom: 24px;
      }
      .form-card__header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .form-card__icon {
        width: 32px; height: 32px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-sm);
        display: flex; align-items: center; justify-content: center;
        color: var(--clr-primary-600);
      }
      .form-card__title { font-size: 0.95rem; font-weight: 700; margin: 0; }
      .form-card__body { padding: 20px; }

      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }
      .form-group { display: flex; flex-direction: column; gap: 5px; }
      .form-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
      .form-group input {
        height: 40px;
        padding: 0 12px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .form-group input:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
        outline: none;
      }
      .btn-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 38px;
        padding: 0 16px;
        background: var(--clr-primary-600);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .btn-primary:hover:not(:disabled) { background: var(--clr-primary-700); box-shadow: 0 4px 10px rgba(2,132,199,.25); }
      .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

      .btn-cancel {
        display: inline-flex;
        align-items: center;
        height: 38px;
        padding: 0 14px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #fff;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-cancel:hover { border-color: var(--clr-slate-400); background: var(--clr-slate-50); }

      /* Table card */
      .table-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }

      .status {
        display: inline-flex;
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .status.active  { background: #dcfce7; color: #166534; }
      .status.inactive { background: #fee2e2; color: #991b1b; }

      .discount-badge {
        background: var(--clr-primary-50);
        color: var(--clr-primary-700);
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-weight: 700;
        font-size: 0.8rem;
        border: 1px solid var(--clr-primary-200, #bae6fd);
      }

      .row-actions { display: flex; gap: 6px; }
      .btn-action {
        height: 30px;
        padding: 0 10px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--border-default);
        background: #fff;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-action--edit { color: var(--clr-primary-600); }
      .btn-action--edit:hover { border-color: var(--clr-primary-300, #7dd3fc); background: var(--clr-primary-50); }
      .btn-action--danger { color: var(--clr-danger-600); border-color: #fecaca; }
      .btn-action--danger:hover { background: #fef2f2; border-color: #fca5a5; }
    `
  ]
})
export class CouponsComponent implements OnInit {
  private readonly corporateApi = inject(CorporateService);
  private readonly corporateContext = inject(CorporateContextService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly coupons = signal<CouponResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly editingCouponId = signal<string | null>(null);
  private readonly currentStoreId = signal<string | null>(null);

  form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    discountPercentage: ['', [Validators.required, Validators.min(1), Validators.max(100)]],
    validUntil: [''],
    active: [true]
  });

  constructor() {
    effect(() => {
      const storeId = this.corporateContext.selectedStoreId();
      if (storeId && storeId !== this.currentStoreId()) {
        this.currentStoreId.set(storeId);
        this.load();
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.corporateApi.getCoupons(this.selectedStoreId()).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.coupons.set(page.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const storeId = this.selectedStoreId();
    if (!storeId) {
      this.toast.showError('Kupon olusturmak icin magaza secin.');
      return;
    }

    this.saving.set(true);
    const { code, discountPercentage, validUntil, active } = this.form.value;

    const body: CreateCouponRequest = {
      code: code!.trim(),
      discountPercentage: discountPercentage!,
      validUntil: validUntil ? `${validUntil}T23:59:59` : undefined,
      storeId,
      active: active ?? true
    };

    const editingId = this.editingCouponId();
    const request$ = editingId
      ? this.corporateApi.updateCoupon(editingId, body)
      : this.corporateApi.createCoupon(body);

    request$.subscribe({
      next: (savedCoupon) => {
        this.saving.set(false);
        if (editingId) {
          this.coupons.update((coupons) => coupons.map((coupon) => (coupon.id === editingId ? savedCoupon : coupon)));
          this.toast.showInfo('Kupon guncellendi');
        } else {
          this.coupons.update((coupons) => [savedCoupon, ...coupons]);
          this.toast.showInfo('Kupon olusturuldu');
        }
        this.resetForm();
      },
      error: () => {
        this.saving.set(false);
        this.toast.showError(editingId ? 'Kupon guncellenemedi' : 'Kupon olusturulamadi');
      }
    });
  }

  startEdit(coupon: CouponResponse): void {
    this.corporateApi.getCoupon(coupon.id).subscribe({
      next: (detail) => {
        this.editingCouponId.set(detail.id);
        this.form.reset({
          code: detail.code,
          discountPercentage: String(detail.discountPercentage),
          validUntil: detail.validUntil ? detail.validUntil.slice(0, 10) : '',
          active: detail.active
        });
      },
      error: () => {
        this.toast.showError('Kupon detayi yuklenemedi');
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  deleteCoupon(id: string): void {
    this.corporateApi.deleteCoupon(id).subscribe({
      next: () => {
        this.coupons.update((coupons) => coupons.filter((coupon) => coupon.id !== id));
        this.toast.showInfo('Kupon silindi');
      },
      error: () => {
        this.toast.showError('Kupon silinemedi');
      }
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  private selectedStoreId(): string | undefined {
    const storeId = this.corporateContext.selectedStoreId();
    return storeId && UUID_PATTERN.test(storeId) ? storeId : undefined;
  }

  private resetForm(): void {
    this.editingCouponId.set(null);
    this.form.reset({ code: '', discountPercentage: '', validUntil: '', active: true });
  }
}
