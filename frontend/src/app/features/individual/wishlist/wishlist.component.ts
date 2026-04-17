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
        position: relative;
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
      .remove-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #ef4444;
        transition: background 0.2s;
      }
      .remove-btn:hover {
        background: #fff;
        color: #dc2626;
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
      .quantity-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .qty-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        font-weight: 700;
        color: #334155;
      }
      .qty-btn:hover {
        background: #f1f5f9;
      }
      .qty-value {
        font-weight: 600;
        min-width: 24px;
        text-align: center;
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
