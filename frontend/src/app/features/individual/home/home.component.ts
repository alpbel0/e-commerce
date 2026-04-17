import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HomeService } from '../../../core/api/home.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney, effectiveUnitPrice, starsFromRating } from '../../../shared/util/money';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './home.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        background: #fff;
        overflow: hidden;
      }
      .cover {
        width: 100%;
        aspect-ratio: 4 / 3;
        background: linear-gradient(135deg, #eff6ff, #f8fafc);
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cover-empty {
        color: #94a3b8;
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }
      .card h3 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.3;
      }
      .card a.title {
        color: #0f172a;
        text-decoration: none;
      }
      .card a.title:hover {
        text-decoration: underline;
      }
      .meta {
        font-size: 0.8rem;
        color: #64748b;
      }
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .old {
        text-decoration: line-through;
        color: #94a3b8;
        font-size: 0.85rem;
      }
      .price {
        font-weight: 700;
        color: #0f172a;
      }
      .stars {
        color: #f59e0b;
        letter-spacing: 1px;
        font-size: 0.85rem;
      }
      .actions {
        margin-top: auto;
        display: flex;
        gap: 8px;
      }
      .actions a.detail {
        flex: 1;
        text-align: center;
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        color: #334155;
        text-decoration: none;
        font-size: 0.85rem;
      }
    `
  ]
})
export class HomeComponent implements OnInit {
  private readonly homeService = inject(HomeService);

  readonly items = signal<ProductSummaryResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (p: ProductSummaryResponse) =>
    effectiveUnitPrice(p.unitPrice, p.discountPercentage);
  readonly stars = (p: ProductSummaryResponse) => starsFromRating(p.avgRating);
  readonly starString = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  readonly imageAlt = (p: ProductSummaryResponse) => `${p.title} kapak gorseli`;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.homeService.getFeatured(8).subscribe({
      next: (items) => {
        this.loading.set(false);
        this.items.set(items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  hasImage(p: ProductSummaryResponse): boolean {
    return !!p.primaryImageUrl;
  }

  showDiscount(p: ProductSummaryResponse): boolean {
    return parseFloat(p.discountPercentage || '0') > 0;
  }
}
