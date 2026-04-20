import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartConfiguration,
  type ChartData,
  type ChartOptions,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';

type SupportedChartType = 'bar' | 'line';

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-chart-wrapper',
  standalone: true,
  template: `
    <div class="chart-shell">
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [
    `
      .chart-shell {
        position: relative;
        min-height: 320px;
        width: 100%;
      }

      canvas {
        width: 100%;
        height: 100%;
      }
    `
  ]
})
export class ChartWrapperComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  @Input() type: SupportedChartType = 'bar';
  @Input() data: ChartData<SupportedChartType> = { labels: [], datasets: [] };
  @Input() options: ChartOptions<SupportedChartType> = {};

  private chart: Chart<SupportedChartType> | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.canvasRef) {
      return;
    }

    if (changes['data'] || changes['options'] || changes['type']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private renderChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    this.chart?.destroy();

    const config: ChartConfiguration<SupportedChartType> = {
      type: this.type,
      data: this.data,
      options: this.options
    };

    this.chart = new Chart(canvas, config);
  }
}
