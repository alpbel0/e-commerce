import { Injectable, signal } from '@angular/core';

/** Navbar + alt sayfalar arasında seçili mağaza (layout ile senkron) */
@Injectable({ providedIn: 'root' })
export class CorporateContextService {
  readonly selectedStoreId = signal<string | null>(null);

  setSelectedStoreId(id: string | null): void {
    this.selectedStoreId.set(id);
  }
}
