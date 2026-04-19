import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductService } from '../../../core/api/product.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import { ToastService } from '../../../core/notify/toast.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { formatMoney, effectiveUnitPrice } from '../../../shared/util/money';
import { ProductStockEditComponent } from './product-stock-edit.component';

@Component({
  selector: 'app-product-management-list',
  standalone: true,
  imports: [
    RouterLink,
    LoadingSpinnerComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    PaginationComponent,
    ConfirmDialogComponent,
    ProductStockEditComponent
  ],
  templateUrl: './product-management-list.component.html',
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }
      .btn-new {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 18px;
        height: 40px;
        border-radius: var(--radius-md);
        background: var(--clr-primary-600);
        color: #fff;
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(2,132,199,.3);
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .btn-new:hover { background: var(--clr-primary-700); color: #fff; }

      .table-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }

      .muted { color: var(--text-muted); font-family: monospace; font-size: 0.8rem; }

      .status-pill {
        display: inline-block;
        padding: 2px 10px;
        border-radius: var(--radius-full);
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .status-pill--on  { background: #dcfce7; color: #166534; }
      .status-pill--off { background: #fee2e2; color: #991b1b; }

      .row-actions { display: flex; gap: 6px; }
      .btn-action {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 30px;
        padding: 0 10px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--border-default);
        background: #fff;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--clr-primary-600);
        text-decoration: none;
        cursor: pointer;
        transition: all var(--trans-fast);
        white-space: nowrap;
      }
      .btn-action:hover { border-color: var(--clr-primary-300, #7dd3fc); background: var(--clr-primary-50); }
      .btn-action--stock { color: var(--clr-slate-700); }
      .btn-action--stock:hover { border-color: var(--clr-slate-400); background: var(--clr-slate-50); }
      .btn-action--danger { color: var(--clr-danger-600); border-color: #fecaca; }
      .btn-action--danger:hover { background: #fef2f2; border-color: #fca5a5; }
    `
  ]
})
export class ProductManagementListComponent {
  private readonly products = inject(ProductService);
  readonly ctx = inject(CorporateContextService);
  private readonly toast = inject(ToastService);
  private storeIdForList: string | null = null;

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<ProductSummaryResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly deleteOpen = signal(false);
  readonly deleteTarget = signal<ProductSummaryResponse | null>(null);

  readonly stockOpen = signal(false);
  readonly stockTarget = signal<ProductSummaryResponse | null>(null);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = effectiveUnitPrice;

  constructor() {
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      if (!sid) {
        this.loading.set(false);
        this.items.set([]);
        this.storeIdForList = null;
        return;
      }
      if (this.storeIdForList !== sid) {
        this.storeIdForList = sid;
        untracked(() => this.page.set(0));
      }
      const pg = this.page();
      this.fetch(sid, pg);
    });
  }

  fetch(storeId: string, page: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.products.list({ storeId, page, size: 12, sort: 'title,asc' }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.items.set(res.items);
        this.totalPages.set(res.totalPages);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    if (sid) this.fetch(sid, this.page());
  }

  askDelete(p: ProductSummaryResponse): void {
    this.deleteTarget.set(p);
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const p = this.deleteTarget();
    if (!p) return;
    this.products.delete(p.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.toast.showInfo('Ürün silindi');
        const sid = this.ctx.selectedStoreId();
        if (sid) this.fetch(sid, this.page());
      },
      error: () => this.cancelDelete()
    });
  }

  openStock(p: ProductSummaryResponse): void {
    this.stockTarget.set(p);
    this.stockOpen.set(true);
  }

  closeStock(): void {
    this.stockOpen.set(false);
    this.stockTarget.set(null);
  }

  saveStock(qty: number): void {
    const p = this.stockTarget();
    if (!p) return;
    this.products.updateStock(p.id, { stockQuantity: qty }).subscribe({
      next: () => {
        this.closeStock();
        this.toast.showInfo('Stok güncellendi');
        const sid = this.ctx.selectedStoreId();
        if (sid) this.fetch(sid, this.page());
      },
      error: () => {}
    });
  }
}
