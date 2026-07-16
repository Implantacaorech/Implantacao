import { Directive, ElementRef, inject, input, effect, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js/auto';

@Directive({
  selector: 'canvas[appChart]',
  standalone: true,
})
export class ChartDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLCanvasElement>);
  private instancia: Chart | null = null;

  readonly appChart = input<ChartConfiguration | null>(null);

  constructor() {
    effect(() => {
      const config = this.appChart();
      this.instancia?.destroy();
      this.instancia = config ? new Chart(this.el.nativeElement, config) : null;
    });
  }

  ngOnDestroy(): void {
    this.instancia?.destroy();
  }
}
