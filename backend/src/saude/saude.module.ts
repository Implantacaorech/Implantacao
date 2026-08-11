import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';
import { EmailPasso } from '../database/entities/email-passo.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import { TranscricaoModule } from '../transcricao/transcricao.module';
import { DocserviceSaudeRepository } from './repositories/docservice-saude.repository';
import { OperacaoArquivosRepository } from './repositories/operacao-arquivos.repository';
import { SaudeBancoRepository } from './repositories/saude-banco.repository';
import { SaudeController } from './saude.controller';
import { SaudeService } from './saude.service';

@Module({
  imports: [
    // Leitura apenas: o diagnóstico nunca escreve nessas tabelas.
    TypeOrmModule.forFeature([EmailPasso, Protocolo]),
    // HttpModule PRÓPRIO, com a mesma baseURL do docservice: o do TranscricaoModule tem
    // timeout de 30 s, dimensionado para transcrição, e aqui a pergunta é "está no ar?" —
    // esperar 30 s por um serviço caído transformaria o diagnóstico numa espera.
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        baseURL: config.get('docserviceUrl', { infer: true }),
        timeout: 4000,
      }),
    }),
    // Para conferir se o job de uma transcrição existe do lado de lá.
    TranscricaoModule,
  ],
  controllers: [SaudeController],
  providers: [
    SaudeService,
    OperacaoArquivosRepository,
    SaudeBancoRepository,
    DocserviceSaudeRepository,
  ],
  // O DigestService consome daqui: o diagnóstico precisa chegar a quem NÃO abre a tela.
  exports: [SaudeService],
})
export class SaudeModule {}
