import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-stock-edit',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (open) {
      <div class="backdrop" (click)="onBackdrop()"></div>
      <div class="dialog" role="dialog" aria-modal="true">
        <h2 class="title">Stok güncelle</h2>
        <p class="sub">{{ productTitle }}</p>
        <label for="sq">Yeni stok adedi</label>
        <input id="sq" type="number" min="0" [formControl]="qty" />
        <div class="actions">
          <button type="button" class="cancel" (click)="cancel.emit()">Vazgeç</button>
          <button type="button" class="ok" [disabled]="qty.invalid" (click)="submit()">Kaydet</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 1040;
      }
      .dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 1050;
        background: #fff;
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        min-width: min(320px, 92vw);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
      }
      .title {
        margin: 0 0 0.35rem;
        font-size: 1.1rem;
      }
      .sub {
        margin: 0 0 1rem;
        color: #475569;
        font-size: 0.9rem;
      }
      label {
        display: block;
        font-size: 0.8rem;
        color: #64748b;
        margin-bottom: 4px;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        margin-bottom: 1rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .cancel {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
      }
      .ok {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
      }
      .ok:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `
  ]
})
export class ProductStockEditComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  readonly qty = this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]);

  @Input() productTitle = '';
  private _initial = 0;

  @Input()
  set initialStock(v: number) {
    this._initial = v;
  }
  get initialStock(): number {
    return this._initial;
  }

  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<number>();

  private _open = false;

  @Input()
  set open(v: boolean) {
    this._open = v;
  }
  get open(): boolean {
    return this._open;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true || (this._open && changes['initialStock'])) {
      this.qty.setValue(this._initial);
    }
  }

  onBackdrop(): void {
    this.cancel.emit();
  }

  submit(): void {
    if (this.qty.invalid) return;
    const n = Math.floor(Number(this.qty.value));
    if (Number.isNaN(n) || n < 0) return;
    this.saved.emit(n);
  }
}
