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
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 1rem;
      }
      h2 {
        margin: 0;
      }
      .new {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        text-decoration: none;
        font-size: 0.9rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .muted {
        color: #64748b;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .actions a,
      .actions button {
        font-size: 0.8rem;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        color: #2563eb;
        text-decoration: none;
      }
      .actions button.danger {
        color: #b91c1c;
        border-color: #fecaca;
      }
      .badge-off {
        color: #b91c1c;
        font-size: 0.72rem;
        font-weight: 600;
      }
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
