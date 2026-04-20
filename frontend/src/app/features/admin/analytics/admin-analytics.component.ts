import { FormsModule } from '@angular/forms';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { forkJoin } from 'rxjs';

import { AnalyticsService } from '../../../core/api/analytics.service';
import type {
  AnalyticsCategoryPerformanceResponse,
  AnalyticsFilterOptionResponse,
  AnalyticsStoreComparisonResponse,
  AnalyticsTrendPointResponse,
  RankedProductResponse
} from '../../../core/models/analytics.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

type DashboardCurrency = 'TRY' | 'USD' | 'EUR';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, ChartWrapperComponent],
  templateUrl: './admin-analytics.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding: 24px;
        margin-bottom: 20px;
        border-radius: 22px;
        background:
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 34%),
          radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.12), transparent 28%),
          linear-gradient(135deg, #ffffff, #f5f9ff);
        border: 1px solid rgba(148, 163, 184, 0.24);
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.05);
      }

      .hero__eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(14, 165, 233, 0.08);
        color: #0369a1;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-bottom: 12px;
      }

      .hero__title {
        margin: 0;
        font-size: clamp(1.9rem, 3vw, 2.8rem);
        line-height: 1.02;
        letter-spacing: -0.03em;
        color: #0f172a;
      }

      .hero__sub {
        margin: 10px 0 0;
        max-width: 720px;
        color: #475569;
        font-size: 0.98rem;
        line-height: 1.6;
      }

      .hero__actions {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }

      .filters {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        padding: 20px;
        margin-bottom: 20px;
        border-radius: 20px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .field--wide {
        grid-column: span 2;
      }

      .field label,
      .field__label {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #475569;
        text-transform: uppercase;
      }

      .field input,
      .field select {
        min-height: 44px;
      }

      .filters__actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }

      .filters__summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: #eef6ff;
        color: #0f4c81;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .filters__buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.9fr);
        gap: 20px;
      }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .panel {
        padding: 20px;
        border-radius: 20px;
      }

      .panel__head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .panel__title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #0f172a;
      }

      .panel__sub {
        margin: 6px 0 0;
        color: #64748b;
        font-size: 0.87rem;
        line-height: 1.5;
      }

      .metric-note {
        display: inline-flex;
        align-items: center;
        padding: 7px 12px;
        border-radius: 999px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .chart-shell {
        min-height: 320px;
      }

      .trend-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .trend-card {
        padding: 16px;
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff, #f8fbff);
        border: 1px solid #dbe7f5;
      }

      .trend-card__title {
        margin: 0 0 4px;
        font-size: 0.92rem;
        font-weight: 800;
        color: #0f172a;
      }

      .trend-card__sub {
        margin: 0 0 12px;
        color: #64748b;
        font-size: 0.8rem;
      }

      .trend-card__chart {
        min-height: 220px;
      }

      .comparison-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .compare-card {
        padding: 18px;
        border-radius: 18px;
        background: linear-gradient(180deg, #fbfdff, #f8fbff);
        border: 1px solid #dbe7f5;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      .compare-card__name {
        margin: 0 0 12px;
        font-size: 0.95rem;
        font-weight: 800;
        color: #0f172a;
      }

      .compare-card__meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .compare-stat {
        padding: 10px 12px;
        border-radius: 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
      }

      .compare-stat__label {
        display: block;
        margin-bottom: 4px;
        font-size: 0.72rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .compare-stat__value {
        font-size: 0.96rem;
        font-weight: 800;
        color: #0f172a;
      }

      .table-wrap {
        overflow: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th, td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }

      th {
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
      }

      td {
        color: #1e293b;
      }

      .rank {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.8rem;
        font-weight: 800;
      }

      .empty {
        padding: 28px 20px;
        border: 1px dashed #cbd5e1;
        border-radius: 18px;
        color: #64748b;
        text-align: center;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
      }

      @media (max-width: 1200px) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .grid {
          grid-template-columns: 1fr;
        }

        .trend-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .hero {
          padding: 20px;
          flex-direction: column;
        }

        .filters {
          grid-template-columns: 1fr;
        }

        .field--wide {
          grid-column: span 1;
        }

        .compare-card__meta {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class AdminAnalyticsComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly storeOptions = signal<AnalyticsFilterOptionResponse[]>([]);
  readonly categoryOptions = signal<AnalyticsFilterOptionResponse[]>([]);
  readonly comparison = signal<AnalyticsStoreComparisonResponse[]>([]);
  readonly trends = signal<AnalyticsTrendPointResponse[]>([]);
  readonly categoryPerformance = signal<AnalyticsCategoryPerformanceResponse[]>([]);
  readonly products = signal<RankedProductResponse[]>([]);
  readonly formatMoney = formatMoney;
  readonly selectedCurrency = signal<DashboardCurrency>('TRY');

  readonly currencyOptions: Array<{ code: DashboardCurrency; label: string }> = [
    { code: 'TRY', label: 'TL' },
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' }
  ];

  readonly productStatusOptions = [
    { value: '', label: 'Tümü' },
    { value: 'ACTIVE', label: 'Aktif ürünler' },
    { value: 'INACTIVE', label: 'Pasif ürünler' }
  ];

  readonly stockStatusOptions = [
    { value: '', label: 'Tüm stoklar' },
    { value: 'IN_STOCK', label: 'Stokta olanlar' },
    { value: 'LOW_STOCK', label: 'Düşük stok' },
    { value: 'OUT_OF_STOCK', label: 'Stokta olmayanlar' }
  ];

  storeFilterA = '';
  storeFilterB = '';
  storeFilterC = '';
  categoryFilter = '';
  productStatusFilter = '';
  stockStatusFilter = '';
  dateFrom = this.defaultFrom();
  dateTo = this.defaultTo();

  readonly activeFilterLabels = computed(() => {
    const labels: string[] = [];
    const stores = this.selectedStoreIds()
      .map((storeId) => this.storeOptions().find((option) => option.id === storeId)?.label)
      .filter((value): value is string => Boolean(value));

    if (stores.length > 0) {
      labels.push(`Mağaza: ${stores.join(', ')}`);
    }

    if (this.categoryFilter) {
      const categoryLabel = this.categoryOptions().find((option) => option.id === this.categoryFilter)?.label;
      if (categoryLabel) {
        labels.push(`Kategori: ${categoryLabel}`);
      }
    }

    if (this.productStatusFilter) {
      const label = this.productStatusOptions.find((item) => item.value === this.productStatusFilter)?.label;
      if (label) labels.push(label);
    }

    if (this.stockStatusFilter) {
      const label = this.stockStatusOptions.find((item) => item.value === this.stockStatusFilter)?.label;
      if (label) labels.push(label);
    }

    labels.push(`${this.dateFrom} - ${this.dateTo}`);
    labels.push(`Para birimi: ${this.selectedCurrency()}`);

    return labels;
  });

  readonly revenueTrendChartData = computed<ChartData<'line'>>(() => ({
    labels: this.trends().map((item) => item.label),
    datasets: [
      {
        label: 'Ciro',
        data: this.trends().map((item) => Number.parseFloat(item.totalRevenue)),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.12)',
        pointBackgroundColor: '#0f766e',
        pointRadius: 3,
        tension: 0.35
      }
    ]
  }));

  readonly orderTrendChartData = computed<ChartData<'line'>>(() => ({
    labels: this.trends().map((item) => item.label),
    datasets: [
      {
        label: 'Sipariş',
        data: this.trends().map((item) => item.totalOrders),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        pointBackgroundColor: '#2563eb',
        pointRadius: 3,
        tension: 0.35
      }
    ]
  }));

  readonly unitsTrendChartData = computed<ChartData<'line'>>(() => ({
    labels: this.trends().map((item) => item.label),
    datasets: [
      {
        label: 'Satılan adet',
        data: this.trends().map((item) => item.totalUnitsSold),
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        pointBackgroundColor: '#d97706',
        pointRadius: 3,
        tension: 0.35
      }
    ]
  }));

  readonly revenueTrendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => formatMoney(String(ctx.raw ?? 0), this.selectedCurrency())
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#475569' }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#0f766e',
          callback: (value) => formatMoney(String(value), this.selectedCurrency())
        }
      }
    }
  };

  readonly countTrendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#475569' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#475569' }
      }
    }
  };

  readonly comparisonChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.comparison().map((item) => item.storeName),
    datasets: [
      {
        label: 'Ciro',
        data: this.comparison().map((item) => Number.parseFloat(item.totalRevenue)),
        backgroundColor: ['#0f766e', '#2563eb', '#d97706'],
        borderRadius: 10,
        maxBarThickness: 48
      }
    ]
  }));

  readonly comparisonChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => formatMoney(String(ctx.raw ?? 0), this.selectedCurrency())
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569' } },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#475569',
          callback: (value) => formatMoney(String(value), this.selectedCurrency())
        }
      }
    }
  };

  readonly categoryChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.categoryPerformance().map((item) => item.categoryName),
    datasets: [
      {
        label: 'Kategori cirosu',
        data: this.categoryPerformance().map((item) => Number.parseFloat(item.totalRevenue)),
        backgroundColor: '#38bdf8',
        borderRadius: 10,
        maxBarThickness: 42
      }
    ]
  }));

  readonly categoryChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => formatMoney(String(ctx.raw ?? 0), this.selectedCurrency())
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569' } },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#475569',
          callback: (value) => formatMoney(String(value), this.selectedCurrency())
        }
      }
    }
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);

    const filters = this.analyticsFilters();
    forkJoin({
      options: this.analytics.adminFilterOptions(),
      comparison: this.analytics.adminStoreComparison({ ...filters, limit: 3 }),
      trends: this.analytics.adminTrends(filters),
      categories: this.analytics.adminCategoryPerformance({ ...filters, limit: 8 }),
      products: this.analytics.adminTopProducts({ ...filters, limit: 8 })
    }).subscribe({
      next: ({ options, comparison, trends, categories, products }) => {
        this.storeOptions.set(options.stores);
        this.categoryOptions.set(options.categories);
        this.comparison.set(comparison.items);
        this.trends.set(trends.items);
        this.categoryPerformance.set(categories.items);
        this.products.set(products.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  applyFilters(): void {
    this.load();
  }

  resetFilters(): void {
    this.selectedCurrency.set('TRY');
    this.storeFilterA = '';
    this.storeFilterB = '';
    this.storeFilterC = '';
    this.categoryFilter = '';
    this.productStatusFilter = '';
    this.stockStatusFilter = '';
    this.dateFrom = this.defaultFrom();
    this.dateTo = this.defaultTo();
    this.load();
  }

  onCurrencyChange(currency: string): void {
    if (currency === 'TRY' || currency === 'USD' || currency === 'EUR') {
      this.selectedCurrency.set(currency);
    }
  }

  selectedStoreIds(): string[] {
    return [this.storeFilterA, this.storeFilterB, this.storeFilterC]
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
  }

  private analyticsFilters(): {
    currency: DashboardCurrency;
    storeIds?: string[];
    categoryId?: string;
    productStatus?: string;
    stockStatus?: string;
    from: string;
    to: string;
  } {
    const storeIds = this.selectedStoreIds();
    return {
      currency: this.selectedCurrency(),
      storeIds: storeIds.length > 0 ? storeIds : undefined,
      categoryId: this.categoryFilter || undefined,
      productStatus: this.productStatusFilter || undefined,
      stockStatus: this.stockStatusFilter || undefined,
      from: this.dateFrom,
      to: this.dateTo
    };
  }

  private defaultFrom(): string {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().slice(0, 10);
  }

  private defaultTo(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
