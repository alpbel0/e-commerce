import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { forkJoin } from 'rxjs';

import { AnalyticsService } from '../../../core/api/analytics.service';
import type { RankedProductResponse, RankedStoreResponse } from '../../../core/models/analytics.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, ChartWrapperComponent],
  templateUrl: './admin-analytics.component.html',
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        gap: 16px;
      }
      .panel {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        background: #fff;
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
      @media (max-width: 960px) {
        .grid {
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
  readonly stores = signal<RankedStoreResponse[]>([]);
  readonly products = signal<RankedProductResponse[]>([]);
  readonly formatMoney = formatMoney;

  readonly storeChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.stores().map((item) => item.storeName),
    datasets: [
      {
        label: 'Store revenue',
        data: this.stores().map((item) => Number.parseFloat(item.totalRevenue)),
        backgroundColor: '#0f766e',
        borderRadius: 8
      }
    ]
  }));

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => formatMoney(String(value)) }
      }
    }
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      stores: this.analytics.adminTopStores(10),
      products: this.analytics.adminTopProducts(10)
    }).subscribe({
      next: ({ stores, products }) => {
        this.loading.set(false);
        this.stores.set(stores.items);
        this.products.set(products.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
