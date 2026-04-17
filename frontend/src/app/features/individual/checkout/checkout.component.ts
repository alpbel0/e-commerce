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
        max-width: 560px;
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
      .stripe-box {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 12px;
        background: #fff;
      }
      .stripe-field {
        min-height: 38px;
        display: flex;
        align-items: center;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0 0.55rem;
        background: #fff;
      }
      .stripe-field--error {
        border-color: #ef4444;
      }
      .error {
        margin: 4px 0 0;
        color: #dc2626;
        font-size: 0.78rem;
      }
      #stripe-card-number,
      #stripe-card-expiry,
      #stripe-card-cvc {
        width: 100%;
        min-height: 24px;
      }
      .help {
        margin: 6px 0 0;
        color: #64748b;
        font-size: 0.8rem;
      }
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
