import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly variant = signal<'error' | 'info'>('error');

  showError(text: string): void {
    this.variant.set('error');
    this.message.set(text);
    window.setTimeout(() => this.clear(), 6000);
  }

  showInfo(text: string): void {
    this.variant.set('info');
    this.message.set(text);
    window.setTimeout(() => this.clear(), 5000);
  }

  clear(): void {
    this.message.set(null);
  }
}
