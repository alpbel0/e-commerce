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
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-end;
        margin-bottom: 1rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field label {
        font-size: 0.75rem;
        color: #64748b;
      }
      select,
      input {
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        min-width: 160px;
      }
      .q {
        min-width: 220px;
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
