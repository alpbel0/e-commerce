import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { ProductService } from '../../../core/api/product.service';
import { StoreService } from '../../../core/api/store.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import type { StoreDetailResponse } from '../../../core/models/store.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-store-public',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <a routerLink="/app/products" style="display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none"><- Urunlere don</a>
    @if (loading()) {
      <app-loading-spinner />
    } @else if (error()) {
      <app-error-state message="Magaza yuklenemedi." (retry)="load()" />
    } @else {
      @if (store(); as item) {
        <h2>{{ item.name }}</h2>
        <p>{{ item.description || 'Aciklama yok.' }}</p>
        <p><strong>Iletisim:</strong> {{ item.contactEmail }}</p>
        <p><strong>Adres:</strong> {{ item.address || '-' }}</p>
        <h3>Urunler</h3>
        <div class="grid">
          @for (product of products(); track product.id) {
            <a class="card" [routerLink]="['/app/products', product.id]">
              <strong>{{ product.title }}</strong>
              <div>{{ formatMoney(product.unitPrice, product.currency) }}</div>
            </a>
          }
        </div>
        @if (products().length === 0) {
          <p>Bu magazada listelenecek aktif urun yok.</p>
        }
      }
    }
  `,
  styles: [`
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
    .card{display:block;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;text-decoration:none;color:inherit}
  `]
})
export class StorePublicComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly stores = inject(StoreService);
  private readonly productsApi = inject(ProductService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly store = signal<StoreDetailResponse | null>(null);
  readonly products = signal<ProductSummaryResponse[]>([]);
  readonly formatMoney = formatMoney;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.stores.getBySlug(slug).subscribe({
      next: (store) => {
        this.store.set(store);
        this.productsApi.list({ storeId: store.id, active: true, page: 0, size: 24, sort: 'title,asc' }).subscribe({
          next: (response) => {
            this.loading.set(false);
            this.products.set(response.items);
          },
          error: () => {
            this.loading.set(false);
            this.error.set(true);
          }
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
