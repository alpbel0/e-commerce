import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../../core/api/cart.service';
import { OrderService } from '../../../core/api/order.service';
import type { CheckoutPaymentMethod } from '../../../core/models/order.models';
import { ToastService } from '../../../core/notify/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './checkout.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .warn {
        padding: 12px;
        background: #fffbeb;
        border-radius: 10px;
        color: #92400e;
        margin-bottom: 1rem;
      }
      form {
        max-width: 520px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field label {
        display: block;
        font-size: 0.8rem;
        margin-bottom: 4px;
        color: #475569;
      }
      .field input,
      .field select,
      .field textarea {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      .row2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 520px) {
        .row2 {
          grid-template-columns: 1fr;
        }
      }
      button[type='submit'] {
        margin-top: 8px;
        padding: 0.55rem 1rem;
        border-radius: 10px;
        border: none;
        background: #0f172a;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `
  ]
})
export class CheckoutComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cartApi = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly empty = signal(false);
  readonly submitting = signal(false);

  readonly paymentMethods: { value: CheckoutPaymentMethod; label: string }[] = [
    { value: 'CREDIT_CARD', label: 'Kredi kartı' },
    { value: 'DEBIT_CARD', label: 'Banka kartı' },
    { value: 'PAYPAL', label: 'PayPal' },
    { value: 'WIRE_TRANSFER', label: 'Havale / EFT' },
    { value: 'CASH_ON_DELIVERY', label: 'Kapıda ödeme' }
  ];

  readonly form = this.fb.nonNullable.group({
    paymentMethod: this.fb.nonNullable.control<CheckoutPaymentMethod>('CREDIT_CARD'),
    shippingAddressLine1: ['', Validators.required],
    shippingAddressLine2: [''],
    shippingCity: ['', Validators.required],
    shippingState: [''],
    shippingPostalCode: [''],
    shippingCountry: ['', Validators.required],
    customerPhone: [''],
    notes: ['']
  });

  ngOnInit(): void {
    this.cartApi.getMyCart().subscribe({
      next: (c) => this.empty.set(c.totalItemCount === 0),
      error: () => this.empty.set(true)
    });
  }

  submit(): void {
    if (this.form.invalid || this.empty()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.orders
      .checkout({
        paymentMethod: v.paymentMethod,
        shippingAddressLine1: v.shippingAddressLine1.trim(),
        shippingAddressLine2: v.shippingAddressLine2.trim() || undefined,
        shippingCity: v.shippingCity.trim(),
        shippingState: v.shippingState.trim() || undefined,
        shippingPostalCode: v.shippingPostalCode.trim() || undefined,
        shippingCountry: v.shippingCountry.trim(),
        customerPhone: v.customerPhone.trim() || undefined,
        notes: v.notes.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.showInfo('Sipariş oluşturuldu');
          void this.router.navigate(['/app/orders']);
        },
        error: () => {
          this.submitting.set(false);
        }
      });
  }
}
