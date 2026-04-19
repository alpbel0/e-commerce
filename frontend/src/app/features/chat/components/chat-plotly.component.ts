import {
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import Plotly from 'plotly.js-dist-min';

import type { PlotlyFigureInput } from '../utils/plotly-figure.util';

@Component({
  selector: 'app-chat-plotly',
  standalone: true,
  template: `<div class="plotly-host" #host></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .plotly-host {
        width: 100%;
        min-height: 280px;
      }
    `,
  ],
})
export class ChatPlotlyComponent implements OnDestroy {
  readonly figure = input<PlotlyFigureInput | null>(null);

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');

  constructor() {
    effect((onCleanup) => {
      const fig = this.figure();
      const el = this.host()?.nativeElement;
      if (!el) {
        return;
      }
      if (!fig?.data?.length) {
        Plotly.purge(el);
        return;
      }
      try {
        void Plotly.newPlot(el, fig.data, fig.layout ?? {}, {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
        });
      } catch {
        /* Grafik hatası ana metni etkilemez */
      }
      onCleanup(() => {
        Plotly.purge(el);
      });
    });
  }

  ngOnDestroy(): void {
    const el = this.host()?.nativeElement;
    if (el) {
      Plotly.purge(el);
    }
  }
}
