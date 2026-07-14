import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { TranscricaoService } from './transcricao.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        baseURL: config.get('docserviceUrl', { infer: true }),
        timeout: 30_000,
      }),
    }),
  ],
  providers: [TranscricaoService],
  exports: [TranscricaoService],
})
export class TranscricaoModule {}
