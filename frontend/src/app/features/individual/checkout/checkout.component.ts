import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  loadStripe,
  type Stripe,
  type StripeCardCvcElement,
  type StripeCardExpiryElement,
  type StripeCardNumberElement,
  type StripeElements
} from '@stripe/stripe-js';

import { CartService } from '../../../core/api/cart.service';
import { OrderService } from '../../../core/api/order.service';
import { PaymentService } from '../../../core/api/payment.service';
import type { CheckoutPaymentMethod } from '../../../core/models/order.models';
import { ToastService } from '../../../core/notify/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './checkout.component.html',
  styles: [
    `
      .page-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 24px; }

      .warn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: var(--radius-md);
        color: #92400e;
        font-size: 0.875rem;
        margin-bottom: 20px;
      }

      .checkout-layout {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 24px;
        align-items: start;
        max-width: 900px;
      }
      @media (max-width: 768px) { .checkout-layout { grid-template-columns: 1fr; } }

      .checkout-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        margin-bottom: 16px;
      }
      .checkout-card__header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .checkout-card__icon {
        width: 32px; height: 32px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--clr-primary-600);
        flex-shrink: 0;
      }
      .checkout-card__title { font-size: 0.95rem; font-weight: 700; margin: 0; }
      .checkout-card__body { padding: 20px; }

      form { display: contents; }
      .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
      .field label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
      .field input,
      .field select,
      .field textarea {
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .field input:focus, .field select:focus, .field textarea:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
      }
      .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 520px) { .row2 { grid-template-columns: 1fr; } }

      /* Stripe */
      .stripe-box {
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 16px;
        background: var(--clr-slate-50);
        margin-bottom: 12px;
      }
      .stripe-field {
        min-height: 40px;
        display: flex;
        align-items: center;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0 12px;
        background: #fff;
        transition: border-color var(--trans-fast);
      }
      .stripe-field:focus-within { border-color: var(--clr-primary-500); }
      .stripe-field--error { border-color: var(--clr-danger-500); }
      #stripe-card-number, #stripe-card-expiry, #stripe-card-cvc { width: 100%; min-height: 24px; }
      .help { margin: 6px 0 0; color: var(--text-muted); font-size: 0.78rem; }
      .error { margin: 4px 0 0; color: var(--clr-danger-500); font-size: 0.78rem; }

      /* Submit */
      .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 0.75rem 1rem;
        border: none;
        border-radius: var(--radius-md);
        background: var(--clr-primary-600);
        color: #fff;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
        box-shadow: 0 4px 12px rgba(2,132,199,.3);
      }
      .submit-btn:hover:not(:disabled) { background: var(--clr-primary-700); }
      .submit-btn:disabled { opacity: .55; cursor: not-allowed; }

      /* Order info sidebar */
      .order-info {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 20px;
        box-shadow: var(--shadow-sm);
        position: sticky;
        top: calc(var(--navbar-h) + var(--topnav-h) + 16px);
      }
      .order-info h3 { font-size: 0.95rem; font-weight: 800; margin: 0 0 12px; }
      .order-info-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-secondary);
        padding: 6px 0;
        border-bottom: 1px solid var(--border-default);
      }
      .order-info-row:last-child { border: none; font-weight: 700; color: var(--text-primary); font-size: 1rem; }
    `
  ]
})
export class CheckoutComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly cartApi = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  @ViewChild('stripeCardNumberElement') private stripeCardNumberElement?: ElementRef<HTMLDivElement>;
  @ViewChild('stripeCardExpiryElement') private stripeCardExpiryElement?: ElementRef<HTMLDivElement>;
  @ViewChild('stripeCardCvcElement') private stripeCardCvcElement?: ElementRef<HTMLDivElement>;

  readonly empty = signal(false);
  readonly submitting = signal(false);
  readonly stripeReady = signal(false);
  readonly stripeError = signal<string | null>(null);
  readonly cardNumberComplete = signal(false);
  readonly cardExpiryComplete = signal(false);
  readonly cardCvcComplete = signal(false);

  readonly paymentMethods: { value: CheckoutPaymentMethod; label: string }[] = [
    { value: 'STRIPE_CARD', label: 'Stripe test kart' },
    { value: 'CREDIT_CARD', label: 'Kredi karti' },
    { value: 'DEBIT_CARD', label: 'Banka karti' },
    { value: 'PAYPAL', label: 'PayPal' },
    { value: 'WIRE_TRANSFER', label: 'Havale / EFT' },
    { value: 'CASH_ON_DELIVERY', label: 'Kapida odeme' }
  ];

  readonly form = this.fb.nonNullable.group({
    paymentMethod: this.fb.nonNullable.control<CheckoutPaymentMethod>('STRIPE_CARD'),
    shippingAddressLine1: ['Demo Mah. Test Sok. No:1', Validators.required],
    shippingAddressLine2: [''],
    shippingCity: ['Istanbul', Validators.required],
    shippingState: [''],
    shippingPostalCode: [''],
    shippingCountry: ['Turkey', Validators.required],
    customerPhone: [''],
    notes: ['']
  });

  private stripe: Stripe | null = null;
  private stripeElements: StripeElements | null = null;
  private cardNumber: StripeCardNumberElement | null = null;
  private cardExpiry: StripeCardExpiryElement | null = null;
  private cardCvc: StripeCardCvcElement | null = null;

  ngOnInit(): void {
    this.cartApi.getMyCart().subscribe({
      next: (c) => this.empty.set(c.totalItemCount === 0),
      error: () => this.empty.set(true)
    });
  }

  ngAfterViewInit(): void {
    void this.setupStripeCard();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.empty()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();

    try {
      const checkout = await firstValueFrom(
        this.orders.checkout({
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
      );

      if (v.paymentMethod === 'STRIPE_CARD') {
        await this.confirmStripePayments(checkout.createdOrders.map((order) => order.orderId));
        this.toast.showInfo('Stripe odemesi tamamlandi');
      } else {
        this.toast.showInfo('Siparis olusturuldu');
      }

      void this.router.navigate(['/app/orders']);
    } catch (err) {
      this.toast.showError(this.checkoutErrorMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }

  isStripeSelected(): boolean {
    return this.form.controls.paymentMethod.value === 'STRIPE_CARD';
  }

  private async setupStripeCard(): Promise<void> {
    if (!environment.stripePublishableKey) {
      this.stripeError.set('Stripe publishable key tanimli degil.');
      return;
    }
    this.stripe = await loadStripe(environment.stripePublishableKey);
    if (
      !this.stripe ||
      !this.stripeCardNumberElement ||
      !this.stripeCardExpiryElement ||
      !this.stripeCardCvcElement
    ) {
      this.stripeError.set('Stripe yuklenemedi.');
      return;
    }
    this.stripeElements = this.stripe.elements();
    const elementOptions = {
      style: {
        base: {
          fontSize: '15px',
          color: '#0f172a',
          '::placeholder': {
            color: '#94a3b8'
          }
        }
      }
    };
    this.cardNumber = this.stripeElements.create('cardNumber', {
      ...elementOptions,
      showIcon: true,
      placeholder: '4242 4242 4242 4242'
    });
    this.cardExpiry = this.stripeElements.create('cardExpiry', {
      ...elementOptions,
      placeholder: '12 / 28'
    });
    this.cardCvc = this.stripeElements.create('cardCvc', {
      ...elementOptions,
      placeholder: '020'
    });

    this.cardNumber.on('change', (event) => this.cardNumberComplete.set(event.complete));
    this.cardExpiry.on('change', (event) => this.cardExpiryComplete.set(event.complete));
    this.cardCvc.on('change', (event) => this.cardCvcComplete.set(event.complete));

    this.cardNumber.mount(this.stripeCardNumberElement.nativeElement);
    this.cardExpiry.mount(this.stripeCardExpiryElement.nativeElement);
    this.cardCvc.mount(this.stripeCardCvcElement.nativeElement);
    this.stripeReady.set(true);
  }

  private async confirmStripePayments(orderIds: string[]): Promise<void> {
    if (!this.stripe || !this.cardNumber || !this.stripeReady()) {
      throw new Error('Stripe card element is not ready');
    }
    if (!this.cardNumberComplete() || !this.cardExpiryComplete() || !this.cardCvcComplete()) {
      throw new Error('Kart bilgilerini eksiksiz girin');
    }

    for (const orderId of orderIds) {
      const intent = await firstValueFrom(this.payments.createStripePaymentIntent({ orderId }));
      const result = await this.stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: {
          card: this.cardNumber
        }
      });
      if (result.error) {
        throw new Error(result.error.message || 'Stripe payment failed');
      }
      if (result.paymentIntent?.status !== 'succeeded') {
        throw new Error(`Stripe payment status: ${result.paymentIntent?.status ?? 'unknown'}`);
      }
    }
  }

  private checkoutErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const error = err.error as { message?: string; fieldErrors?: { field: string; message: string }[] } | null;
      if (error?.fieldErrors?.length) {
        return error.fieldErrors.map((e) => `${e.field}: ${e.message}`).join(', ');
      }
      if (error?.message) {
        return error.message;
      }
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'Odeme tamamlanamadi';
  }
}
