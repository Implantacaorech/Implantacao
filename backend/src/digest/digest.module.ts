import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { MetricasModule } from '../metricas/metricas.module';
import { EmailModule } from '../email/email.module';
import { DigestService } from './digest.service';
import { RoboDigestService } from './robo-digest.service';

@Module({
  imports: [TypeOrmModule.forFeature([Projeto, Documento]), MetricasModule, EmailModule],
  providers: [DigestService, RoboDigestService],
  exports: [DigestService],
})
export class DigestModule {}
