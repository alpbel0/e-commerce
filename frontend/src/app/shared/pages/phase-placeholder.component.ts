import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-phase-placeholder',
  standalone: true,
  template: `
    <section class="ph">
      <h2>{{ title() }}</h2>
      <p>İçerik Phase 9+ roadmap görevleriyle doldurulacak.</p>
    </section>
  `,
  styles: [
    `
      .ph {
        padding: 0.5rem 0;
      }
      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
      }
      p {
        margin: 0;
        color: #64748b;
        font-size: 0.95rem;
      }
    `
  ]
})
export class PhasePlaceholderComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private sub!: Subscription;

  readonly title = signal('Sayfa');

  constructor() {
    this.sub = this.route.data.subscribe((d) => {
      this.title.set(typeof d['title'] === 'string' ? d['title'] : 'Sayfa');
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
