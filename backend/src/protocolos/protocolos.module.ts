import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';
import { ClientesSiclaModule } from '../clientes-sicla/clientes-sicla.module';
import { Projeto } from '../database/entities/projeto.entity';
import { Protocolo } from '../database/entities/protocolo.entity';
import { IaModule } from '../ia/ia.module';
import { MatrizDetalhadaModule } from '../matriz-detalhada/matriz-detalhada.module';
import { TranscricaoModule } from '../transcricao/transcricao.module';
import { ProtocolosService } from './protocolos.service';
import { ProtocoloIaService } from './protocolo-ia.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { GravacaoProtocolosService } from './gravacao-protocolos.service';
import { RoboProtocolosService } from './robo-protocolos.service';
import { ProtocolosController } from './protocolos.controller';
import { ProtocolosMidiaController } from './protocolos-midia.controller';

@Module({
  // Projeto entra só para leitura (lista de clientes da gravação e nome do cliente no
  // registro) — o Protocolo não tem relação declarada com ele, ver protocolo.entity.ts.
  imports: [
    TypeOrmModule.forFeature([Protocolo, Projeto]),
    IaModule,
    TranscricaoModule,
    // Taxonomia de menus do SIGER (derivada do Dicionário) — é contra ela que a transcrição
    // é casada para descobrir quais menus foram citados na gravação. Ver menus-mencionados.ts.
    MatrizDetalhadaModule,
    // Busca de cliente no SICLA — a MESMA do passo 1 (Novo Cliente), reexposta sob a
    // permissão 'protocolos'. Ver GravacaoProtocolosService.buscarClientes.
    ClientesSiclaModule,
    // Assina o ticket curto que o player usa para buscar a mídia (o <video> não manda
    // cabeçalho Authorization) — mesmo segredo do login, ver ProtocolosMidiaController.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwtSecret', { infer: true }),
      }),
    }),
  ],
  controllers: [ProtocolosController, ProtocolosMidiaController],
  providers: [
    ProtocolosService,
    ProtocoloIaService,
    ProcessamentoProtocolosService,
    GravacaoProtocolosService,
    RoboProtocolosService,
  ],
  exports: [
    ProtocolosService,
    ProtocoloIaService,
    ProcessamentoProtocolosService,
    GravacaoProtocolosService,
  ],
})
export class ProtocolosModule {}
