import { Module } from '@nestjs/common';
import { HealthController, InstanciaController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController, InstanciaController],
  providers: [HealthService],
})
export class HealthModule {}
