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
      /* Hero */
      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        background: linear-gradient(135deg, #0a2540 0%, #0e3460 100%);
        border-radius: var(--radius-xl);
        padding: 48px 40px;
        margin-bottom: 40px;
        overflow: hidden;
        position: relative;
      }
      .hero__content { position: relative; z-index: 1; max-width: 480px; }
      .hero__badge {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--clr-primary-500);
        background: rgba(14,165,233,.15);
        border: 1px solid rgba(14,165,233,.3);
        padding: 4px 12px;
        border-radius: var(--radius-full);
        margin-bottom: 16px;
      }
      .hero__title {
        font-size: 2.4rem;
        font-weight: 900;
        color: #fff;
        line-height: 1.1;
        letter-spacing: -.03em;
        margin-bottom: 12px;
      }
      .hero__sub { color: rgba(255,255,255,.55); font-size: 1rem; margin-bottom: 28px; }
      .hero__actions { display: flex; gap: 12px; flex-wrap: wrap; }
      .hero__cta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 22px;
        height: 44px;
        background: var(--clr-primary-600);
        color: #fff;
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        font-weight: 700;
        text-decoration: none;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
        box-shadow: 0 4px 14px rgba(2,132,199,.4);
      }
      .hero__cta:hover { background: var(--clr-primary-700); color: #fff; }
      .hero__cta-ghost {
        display: inline-flex;
        align-items: center;
        height: 44px;
        padding: 0 20px;
        border: 1.5px solid rgba(255,255,255,.2);
        border-radius: var(--radius-md);
        color: rgba(255,255,255,.8);
        font-size: 0.9rem;
        font-weight: 600;
        text-decoration: none;
        transition: border-color var(--trans-fast), color var(--trans-fast);
      }
      .hero__cta-ghost:hover { border-color: rgba(255,255,255,.5); color: #fff; }
      .hero__visual {
        position: relative;
        flex-shrink: 0;
        width: 160px; height: 160px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .hero__blob {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle, rgba(14,165,233,.25) 0%, transparent 70%);
        border-radius: 50%;
      }
      .hero__icon { color: rgba(255,255,255,.15); }
      @media (max-width: 640px) {
        .hero { padding: 32px 24px; }
        .hero__title { font-size: 1.7rem; }
        .hero__visual { display: none; }
      }

      /* Section header */
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      .section-title {
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -.02em;
      }
      .section-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--clr-primary-600);
        text-decoration: none;
      }
      .section-link:hover { color: var(--clr-primary-700); }

      /* Grid & Cards */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        gap: 18px;
      }
      .card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: box-shadow var(--trans-base), transform var(--trans-base);
      }
      .card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-3px); }
      .cover {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        background: var(--clr-slate-50);
        display: block;
        overflow: hidden;
      }
      .cover img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--trans-slow); }
      .card:hover .cover img { transform: scale(1.04); }
      .cover-empty {
        width: 100%; height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--clr-primary-50), #f8fafc);
      }
      .discount-pill {
        position: absolute;
        top: 10px; left: 10px;
        background: var(--clr-danger-500);
        color: #fff;
        font-size: 0.68rem;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: var(--radius-full);
      }
      .content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }
      .meta { font-size: 0.73rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .card h3 { margin: 0; font-size: 0.88rem; font-weight: 600; line-height: 1.35; }
      .title { color: var(--text-primary); text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .title:hover { color: var(--clr-primary-600); }
      .stars { font-size: 0.78rem; color: var(--clr-accent-500); letter-spacing: 1px; }
      .rc { color: var(--text-muted); font-size: 0.73rem; }
      .price-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .price { font-size: 1rem; font-weight: 800; color: var(--text-primary); }
      .old { text-decoration: line-through; color: var(--text-muted); font-size: 0.8rem; }
      .btn-detail {
        display: block;
        text-align: center;
        margin-top: auto;
        padding: 0.5rem;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-default);
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 600;
        transition: all var(--trans-fast);
      }
      .btn-detail:hover { border-color: var(--clr-primary-500); color: var(--clr-primary-600); background: var(--clr-primary-50); }
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
  readonly imageAlt = (p: ProductSummaryResponse) => `${p.title} kapak görseli`;
  readonly discountPct = (p: ProductSummaryResponse) =>
    Math.round(parseFloat(p.discountPercentage || '0'));

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
