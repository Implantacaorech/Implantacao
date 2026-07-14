import { Module } from '@nestjs/common';
import { MetricasService } from './metricas.service';

@Module({
  providers: [MetricasService],
  exports: [MetricasService],
})
export class MetricasModule {}
