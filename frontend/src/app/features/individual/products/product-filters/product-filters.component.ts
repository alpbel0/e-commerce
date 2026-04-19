import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';

import type { CategoryResponse } from '../../../../core/models/category.models';
import type { StoreSummaryResponse } from '../../../../core/models/store.models';

export interface ProductFilterValues {
  categoryId: string | null;
  storeId: string | null;
  q: string;
  sort: string;
}

@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './product-filters.component.html',
  styles: [
    `
      .filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 14px 16px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm);
      }

      /* Search */
      .search-wrap {
        position: relative;
        flex: 1;
        min-width: 200px;
      }
      .search-icon {
        position: absolute;
        left: 11px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
      .search-input {
        padding-left: 36px !important;
        height: 40px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        background: var(--clr-slate-50);
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .search-input:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
        background: #fff;
      }

      /* Selects */
      .selects-group {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .select-wrap {
        position: relative;
      }
      .select-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
      .select-wrap select {
        height: 40px;
        padding: 0 12px 0 30px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--text-primary);
        background: var(--clr-slate-50);
        min-width: 150px;
        width: auto;
        cursor: pointer;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
        appearance: auto;
      }
      .select-wrap select:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
        background: #fff;
      }

      @media (max-width: 640px) {
        .filter-bar { flex-direction: column; align-items: stretch; }
        .selects-group { flex-direction: column; }
        .select-wrap select { width: 100%; }
      }
    `
  ]
})
export class ProductFiltersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) categories: CategoryResponse[] = [];
  @Input({ required: true }) stores: StoreSummaryResponse[] = [];

  @Output() readonly filtersChange = new EventEmitter<ProductFilterValues>();

  readonly form = this.fb.nonNullable.group({
    categoryId: [''],
    storeId: [''],
    q: [''],
    sort: ['createdAt,desc']
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(debounceTime(350)).subscribe(() => {
      this.emit();
    });
    this.emit();
  }

  private emit(): void {
    const v = this.form.getRawValue();
    this.filtersChange.emit({
      categoryId: v.categoryId || null,
      storeId: v.storeId || null,
      q: v.q.trim(),
      sort: v.sort || 'createdAt,desc'
    });
  }
}
