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
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 1rem;
      }
      .stat, .alert {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 14px;
        background: #fff;
      }
      .alert {
        margin-bottom: 1rem;
        background: #fff7ed;
        border-color: #fdba74;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 1rem;
      }
      .filters label {
        display: grid;
        gap: 4px;
        font-size: 0.8rem;
        color: #475569;
      }
      .filters input, .filters select {
        padding: 0.4rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .low {
        color: #b45309;
        font-weight: 700;
      }
      .danger {
        color: #b91c1c;
        font-weight: 700;
      }
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
}
