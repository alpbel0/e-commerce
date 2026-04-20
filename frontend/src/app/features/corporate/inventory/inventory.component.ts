import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ProductService } from '../../../core/api/product.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-corporate-inventory',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, PaginationComponent],
  templateUrl: './inventory.component.html',
  styles: [
    `
      .inv-page { max-width: 1100px; margin: 0 auto; padding-bottom: 32px; }

      .inv-header { margin-bottom: 22px; }
      .inv-header__title {
        margin: 0 0 6px;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }
      .inv-header__sub {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .inv-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 18px;
      }
      @media (max-width: 900px) { .inv-stats { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .inv-stats { grid-template-columns: 1fr; } }

      .inv-stat {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 18px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
        background: #fff;
        box-shadow: var(--shadow-sm);
      }
      .inv-stat__icon {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
      }
      .inv-stat--neutral .inv-stat__icon { background: var(--clr-slate-100); color: var(--text-secondary); }
      .inv-stat--primary .inv-stat__icon { background: var(--clr-primary-100); color: var(--clr-primary-700); }
      .inv-stat--warn .inv-stat__icon { background: #ffedd5; color: #c2410c; }
      .inv-stat--danger .inv-stat__icon { background: #fee2e2; color: var(--clr-danger-600); }

      .inv-stat__body { min-width: 0; }
      .inv-stat__label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .inv-stat__value {
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }

      .inv-alert {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 18px;
        border-radius: var(--radius-md);
        border: 1px solid #fdba74;
        background: linear-gradient(90deg, #fff7ed, #ffedd5);
        color: #9a3412;
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .inv-alert svg { flex-shrink: 0; margin-top: 1px; }

      .inv-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 14px 18px;
        align-items: flex-end;
        padding: 16px 18px;
        margin-bottom: 18px;
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      .inv-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1 1 160px;
        min-width: 140px;
      }
      .inv-field--narrow { flex: 0 0 100px; min-width: 88px; }
      .inv-field__label {
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }
      .inv-input {
        height: 40px;
        padding: 0 12px;
        font-size: 0.875rem;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #fff;
        color: var(--text-primary);
        box-sizing: border-box;
        width: 100%;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .inv-input:focus {
        outline: none;
        border-color: var(--clr-primary-400, #38bdf8);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
      }
      .inv-input--select { cursor: pointer; }

      .inv-table-card {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: #fff;
        box-shadow: var(--shadow-sm);
        margin-bottom: 16px;
      }
      .inv-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      .inv-table thead { background: var(--clr-slate-50, #f8fafc); }
      .inv-table th {
        text-align: left;
        padding: 11px 16px;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border-default);
      }
      .inv-table td {
        padding: 13px 16px;
        border-bottom: 1px solid var(--clr-slate-100, #f1f5f9);
        color: var(--text-secondary);
        vertical-align: middle;
      }
      .inv-table tbody tr:last-child td { border-bottom: none; }
      .inv-table tbody tr:hover td { background: var(--clr-primary-50, #f0f9ff); }
      .inv-table__num { text-align: center; width: 88px; }
      .inv-table__title { font-weight: 600; color: var(--text-primary); max-width: 360px; }

      .inv-sku {
        font-family: ui-monospace, monospace;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        background: var(--clr-slate-100);
        color: var(--text-secondary);
      }

      .inv-qty { font-weight: 800; font-variant-numeric: tabular-nums; }
      .inv-qty.low { color: #c2410c; }
      .inv-qty.danger { color: var(--clr-danger-600); }

      .inv-badge {
        display: inline-block;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
      .inv-badge--ok { background: #dcfce7; color: #166534; }
      .inv-badge--low { background: #ffedd5; color: #c2410c; }
      .inv-badge--out { background: #fee2e2; color: #991b1b; }
    `
  ]
})
export class CorporateInventoryComponent {
  private readonly products = inject(ProductService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<ProductSummaryResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly query = signal('');
  readonly lowStockOnly = signal(false);
  readonly threshold = signal(10);

  constructor() {
    effect(() => {
      const storeId = this.ctx.selectedStoreId();
      const page = this.page();
      const query = this.query();
      const lowStockOnly = this.lowStockOnly();
      const threshold = this.threshold();
      if (!storeId) {
        this.items.set([]);
        this.totalPages.set(0);
        return;
      }
      this.fetch(storeId, page, query, lowStockOnly, threshold);
    });
  }

  fetch(storeId: string, page: number, query: string, lowStockOnly: boolean, threshold: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.products.list({ storeId, page, size: 15, sort: 'stockQuantity,asc', q: query || undefined }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const rows = lowStockOnly
          ? response.items.filter((item) => item.stockQuantity <= threshold)
          : response.items;
        this.items.set(rows);
        this.totalPages.set(response.totalPages);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  onQueryChange(value: string): void {
    this.page.set(0);
    this.query.set(value);
  }

  onLowStockOnlyChange(value: string): void {
    this.page.set(0);
    this.lowStockOnly.set(value === 'true');
  }

  onThresholdChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.threshold.set(Number.isFinite(parsed) ? parsed : 10);
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  totalUnits(): number {
    return this.items().reduce((sum, item) => sum + item.stockQuantity, 0);
  }

  lowStockCount(): number {
    return this.items().filter((item) => item.stockQuantity <= this.threshold()).length;
  }

  outOfStockCount(): number {
    return this.items().filter((item) => item.stockQuantity === 0).length;
  }

  stockClass(stockQuantity: number): string {
    if (stockQuantity === 0) return 'danger';
    if (stockQuantity <= this.threshold()) return 'low';
    return '';
  }

  statusLabel(item: ProductSummaryResponse): string {
    if (item.stockQuantity === 0) return 'Stok yok';
    if (item.stockQuantity <= this.threshold()) return 'Düşük stok';
    return 'Normal';
  }

  statusBadgeClass(item: ProductSummaryResponse): string {
    if (item.stockQuantity === 0) return 'inv-badge--out';
    if (item.stockQuantity <= this.threshold()) return 'inv-badge--low';
    return 'inv-badge--ok';
  }
}
