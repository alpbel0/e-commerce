import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WishlistService } from '../../../core/api/wishlist.service';
import type { WishlistItemResponse } from '../../../core/models/wishlist.models';
import { ToastService } from '../../../core/notify/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney, effectiveUnitPrice, starsFromRating } from '../../../shared/util/money';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './wishlist.component.html',
  styles: [
    `
      .page-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
      .page-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; }
      .page-count { font-size: 0.85rem; color: var(--text-muted); }

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
        width: 100%;
        aspect-ratio: 1 / 1;
        background: var(--clr-slate-50);
        display: block;
        overflow: hidden;
        position: relative;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--trans-slow);
      }
      .card:hover .cover img { transform: scale(1.04); }
      .cover-empty {
        width: 100%; height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--clr-primary-50), #f8fafc);
        color: var(--text-muted);
      }
      .remove-btn {
        position: absolute;
        top: 10px; right: 10px;
        width: 34px; height: 34px;
        border-radius: var(--radius-full);
        background: rgba(255,255,255,.92);
        border: 1px solid var(--border-default);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--clr-danger-500);
        box-shadow: var(--shadow-sm);
        transition: background var(--trans-fast), color var(--trans-fast);
      }
      .remove-btn:hover { background: #fff; color: var(--clr-danger-600); }
      .content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }
      .card h3 { margin: 0; font-size: 0.88rem; font-weight: 600; line-height: 1.35; }
      .title { color: var(--text-primary); text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .title:hover { color: var(--clr-primary-600); }
      .meta { font-size: 0.73rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
      .price-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .old { text-decoration: line-through; color: var(--text-muted); font-size: 0.8rem; }
      .price { font-size: 1rem; font-weight: 800; color: var(--text-primary); }
      .stars { color: var(--clr-accent-500); letter-spacing: 1px; font-size: 0.78rem; }
      .quantity-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        border-top: 1px solid var(--border-default);
        margin-top: 4px;
      }
      .qty-btn {
        width: 30px; height: 30px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-sm);
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-secondary);
        transition: all var(--trans-fast);
      }
      .qty-btn:hover { background: var(--clr-primary-50); border-color: var(--clr-primary-300, #7dd3fc); color: var(--clr-primary-600); }
      .qty-btn:disabled { opacity: .4; cursor: not-allowed; }
      .qty-value { font-size: 0.9rem; font-weight: 700; min-width: 24px; text-align: center; }
      .actions { margin-top: auto; }
      .actions a.detail {
        display: block;
        text-align: center;
        padding: 0.5rem;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-default);
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 600;
        transition: all var(--trans-fast);
      }
      .actions a.detail:hover { border-color: var(--clr-primary-500); color: var(--clr-primary-600); background: var(--clr-primary-50); }
    `
  ]
})
export class WishlistComponent implements OnInit {
  private readonly wishlistApi = inject(WishlistService);
  private readonly toast = inject(ToastService);

  readonly items = signal<WishlistItemResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (p: WishlistItemResponse) =>
    effectiveUnitPrice(p.unitPrice, p.discountPercentage);
  readonly stars = (p: WishlistItemResponse) => starsFromRating(p.avgRating);
  readonly starString = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  readonly imageAlt = (p: WishlistItemResponse) => `${p.title} kapak gorseli`;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.wishlistApi.getWishlist().subscribe({
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

  removeFromWishlist(productId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.wishlistApi.removeFromWishlist(productId).subscribe({
      next: () => {
        this.items.update((items) => items.filter((i) => i.id !== productId));
        this.toast.showInfo('Ürün favorilerden çıkarıldı');
      },
      error: () => {
        this.toast.showError('Ürün favorilerden çıkarılamadı');
      }
    });
  }

  updateQuantity(productId: string, quantity: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (quantity < 1) return;
    this.wishlistApi.updateQuantity(productId, quantity).subscribe({
      next: (updated) => {
        this.items.update((items) =>
          items.map((i) => (i.id === productId ? updated : i))
        );
        this.toast.showInfo('Adet güncellendi');
      },
      error: () => {
        this.toast.showError('Adet güncellenemedi');
      }
    });
  }

  decrementQty(item: WishlistItemResponse, event: Event): void {
    if (item.quantity > 1) {
      this.updateQuantity(item.id, item.quantity - 1, event);
    }
  }

  incrementQty(item: WishlistItemResponse, event: Event): void {
    this.updateQuantity(item.id, item.quantity + 1, event);
  }

  hasImage(p: WishlistItemResponse): boolean {
    return !!p.imageUrl;
  }

  showDiscount(p: WishlistItemResponse): boolean {
    return parseFloat(p.discountPercentage || '0') > 0;
  }
}
