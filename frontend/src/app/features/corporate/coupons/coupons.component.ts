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
      h2 {
        margin: 0 0 1rem;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .form-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
      }
      .form-card h3 {
        margin: 0 0 1rem;
        font-size: 1.1rem;
      }
      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 12px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .form-group label {
        font-size: 0.85rem;
        color: #475569;
        font-weight: 500;
      }
      .form-group input {
        padding: 0.5rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.9rem;
      }
      .form-group input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
      .btn-primary {
        padding: 0.5rem 1rem;
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        margin-right: 8px;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .table-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th {
        background: #f8fafc;
        text-align: left;
        padding: 12px 16px;
        font-weight: 600;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
      }
      td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
      }
      tr:last-child td {
        border-bottom: none;
      }
      .status {
        display: inline-flex;
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .status.active {
        background: #dcfce7;
        color: #166534;
      }
      .status.inactive {
        background: #fee2e2;
        color: #991b1b;
      }
      .btn-delete {
        padding: 0.3rem 0.65rem;
        background: #fee2e2;
        color: #991b1b;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .btn-delete:hover {
        background: #fecaca;
      }
      .discount-badge {
        background: #eff6ff;
        color: #1d4ed8;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
      }
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
